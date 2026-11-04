import { describe, expect, it } from "vitest";
import { checkBasicAuth } from "./basic-auth";

const header = (u: string, p: string) => "Basic " + Buffer.from(`${u}:${p}`).toString("base64");

describe("checkBasicAuth", () => {
  it("accepts correct credentials, including colons in the password", () => {
    expect(checkBasicAuth(header("team", "s3cret"), "team", "s3cret")).toBe(true);
    expect(checkBasicAuth(header("team", "a:b"), "team", "a:b")).toBe(true);
  });
  it("rejects wrong or missing credentials", () => {
    expect(checkBasicAuth(header("team", "nope"), "team", "s3cret")).toBe(false);
    expect(checkBasicAuth(header("admin", "s3cret"), "team", "s3cret")).toBe(false);
    expect(checkBasicAuth(null, "team", "s3cret")).toBe(false);
    expect(checkBasicAuth("Bearer abc", "team", "s3cret")).toBe(false);
  });
});
