import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./test-db";
import { getDb } from "./index";
import { user } from "./schema";
import * as repo from "./repo";

async function addUser(id: string, email: string, status: "pending" | "active" | "disabled" = "pending", role: "admin" | "member" = "member") {
  await getDb().insert(user).values({ id, name: id, email, status, role });
}

beforeEach(async () => {
  await createTestDb();
  vi.unstubAllEnvs();
});

describe("access on sign-in", () => {
  it("activates env admins and auto-approved domains, leaves others pending", async () => {
    vi.stubEnv("ADMIN_EMAILS", "boss@acme.com");
    vi.stubEnv("AUTO_APPROVE_DOMAINS", "acme.com");
    await addUser("a", "boss@acme.com");
    await addUser("b", "jo@acme.com");
    await addUser("c", "stranger@gmail.com");
    expect(await repo.applyAccessOnSignIn("a")).toMatchObject({ role: "admin", status: "active" });
    expect(await repo.applyAccessOnSignIn("b")).toMatchObject({ role: "member", status: "active" });
    expect(await repo.applyAccessOnSignIn("c")).toMatchObject({ status: "pending" });
  });

  it("uses and consumes invites", async () => {
    await repo.createInvite("Free@Lancer.com", "member", null);
    await addUser("f", "free@lancer.com");
    expect(await repo.applyAccessOnSignIn("f")).toMatchObject({ status: "active" });
    expect(await repo.listInvites()).toEqual([]);
  });

  it("inviting someone already waiting lets them in immediately", async () => {
    await addUser("w", "wait@x.com");
    await repo.createInvite("wait@x.com", "admin", null);
    expect(await repo.getUser("w")).toMatchObject({ role: "admin", status: "active" });
  });
});

describe("projects and audits", () => {
  it("creates projects, saves audits, lists with summary and finds the previous audit", async () => {
    await addUser("u", "u@x.com", "active");
    const p = await repo.createProject({ name: " TrailCo ", domain: "https://Shop.TrailCo.com/path" }, "u");
    expect(p).toMatchObject({ name: "TrailCo", domain: "shop.trailco.com" });

    const first = await repo.createAudit({ projectId: p.id, kind: "page", url: "https://shop.trailco.com/boots", score: 60, issueCount: 9, data: { a: 1 } }, "u");
    await new Promise((r) => setTimeout(r, 5));
    const second = await repo.createAudit({ projectId: p.id, kind: "page", url: "https://shop.trailco.com/boots", score: 82, issueCount: 3, data: { a: 2 } }, "u");

    const [summary] = await repo.listProjects();
    expect(summary).toMatchObject({ auditCount: 2, lastScore: 82 });

    const list = await repo.listAudits(p.id);
    expect(list.map((a) => a.score)).toEqual([82, 60]);
    expect(list[0]).not.toHaveProperty("data");
    expect(list[0].createdByName).toBe("u");

    const full = await repo.getAudit(second.id);
    expect(full?.data).toEqual({ a: 2 });
    expect((await repo.getPreviousAudit(full!))?.id).toBe(first.id);
    expect(await repo.getPreviousAudit((await repo.getAudit(first.id))!)).toBeUndefined();
  });

  it("deleting a project deletes its audits", async () => {
    const p = await repo.createProject({ name: "X" }, null);
    const a = await repo.createAudit({ projectId: p.id, kind: "site", url: "https://x.com/", score: 70, issueCount: 1, data: {} }, null);
    await repo.deleteProject(p.id);
    expect(await repo.getAudit(a.id)).toBeUndefined();
  });

  it("rejects duplicate project names", async () => {
    await repo.createProject({ name: "Dup" }, null);
    await expect(repo.createProject({ name: "Dup" }, null)).rejects.toThrow();
  });
});
