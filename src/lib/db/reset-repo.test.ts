import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./test-db";
import { getDb } from "./index";
import { passwordReset, user } from "./schema";
import * as r from "./reset-repo";
import { eq } from "drizzle-orm";

async function addUser(id: string, email: string, status: "pending" | "active" | "disabled" = "active") {
  await getDb().insert(user).values({ id, name: id, email, status, role: "member" });
}

beforeEach(async () => {
  await createTestDb();
  await addUser("pat", "pat@x.com");
  await addUser("admin", "admin@x.com");
});

describe("password reset requests", () => {
  it("full flow: request → pending → approve → consume once", async () => {
    const req = await r.createResetRequest("PAT@x.com");
    if (!req || req === "limited") throw new Error("expected a request");
    expect(req.code).toHaveLength(4);
    expect(await r.getResetStatus(req.token)).toBe("pending");
    const [p] = await r.listPendingResets();
    expect(p).toMatchObject({ email: "pat@x.com", code: req.code });
    expect(await r.consumeReset(req.token)).toBeNull(); // not approved yet
    expect(await r.decideReset(p.id, true, "admin")).toBe("ok");
    expect(await r.getResetStatus(req.token)).toBe("approved");
    expect(await r.listPendingResets()).toEqual([]);
    expect(await r.consumeReset("wrong-token")).toBeNull();
    expect(await r.consumeReset(req.token)).toEqual({ userId: "pat", email: "pat@x.com" });
    expect(await r.consumeReset(req.token)).toBeNull(); // only once
    expect(await r.getResetStatus(req.token)).toBe("used");
  });

  it("unknown or disabled accounts get no request; unknown tokens look pending", async () => {
    await addUser("gone", "gone@x.com", "disabled");
    expect(await r.createResetRequest("nobody@x.com")).toBeNull();
    expect(await r.createResetRequest("gone@x.com")).toBeNull();
    expect(await r.getResetStatus("made-up")).toBe("pending");
  });

  it("denies, blocks self-approval, replaces older requests and limits per day", async () => {
    await addUser("boss", "boss@x.com");
    const own = await r.createResetRequest("boss@x.com");
    const [p] = await r.listPendingResets();
    expect(await r.decideReset(p.id, true, "boss")).toBe("own");
    expect(await r.decideReset(p.id, false, "admin")).toBe("ok");
    if (!own || own === "limited") throw new Error();
    expect(await r.getResetStatus(own.token)).toBe("denied");

    const a = await r.createResetRequest("pat@x.com");
    const b = await r.createResetRequest("pat@x.com");
    if (!a || a === "limited" || !b || b === "limited") throw new Error();
    expect(await r.getResetStatus(a.token)).toBe("denied"); // replaced
    expect((await r.listPendingResets()).filter((x) => x.userId === "pat")).toHaveLength(1);
    expect(await r.createResetRequest("pat@x.com")).not.toBe("limited"); // 3rd today
    expect(await r.createResetRequest("pat@x.com")).toBe("limited");
  });

  it("expires unanswered requests", async () => {
    const req = await r.createResetRequest("pat@x.com");
    if (!req || req === "limited") throw new Error();
    await getDb().update(passwordReset).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(passwordReset.userId, "pat"));
    expect(await r.getResetStatus(req.token)).toBe("expired");
    expect(await r.listPendingResets()).toEqual([]);
  });
});
