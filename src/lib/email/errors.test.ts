import { describe, expect, it } from "vitest";
import { describeEmailError } from "./errors";

describe("describeEmailError", () => {
  it("explains a rejected Gmail login", () => {
    expect(describeEmailError({ code: "EAUTH", responseCode: 535 })).toMatch(/rejected the login.*App password/);
    expect(describeEmailError({ responseCode: 534 })).toMatch(/rejected the login/);
  });
  it("explains connection problems and unknown errors", () => {
    expect(describeEmailError({ code: "ETIMEDOUT" })).toMatch(/Couldn't connect/);
    expect(describeEmailError({ code: "EWEIRD" })).toBe("Sending failed (EWEIRD).");
    expect(describeEmailError(new Error("x"))).toBe("Sending failed.");
    expect(describeEmailError(null)).toBe("Sending failed.");
  });
});
