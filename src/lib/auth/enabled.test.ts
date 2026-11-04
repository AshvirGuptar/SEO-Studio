import { describe, expect, it } from "vitest";
import { isPublicToolPath, publicToolsEnabled } from "./enabled";

describe("demo mode", () => {
  it("parses PUBLIC_TOOLS", () => {
    expect(publicToolsEnabled({ PUBLIC_TOOLS: "true" })).toBe(true);
    expect(publicToolsEnabled({ PUBLIC_TOOLS: "1" })).toBe(true);
    expect(publicToolsEnabled({ PUBLIC_TOOLS: "false" })).toBe(false);
    expect(publicToolsEnabled({})).toBe(false);
  });
  it("opens only the tools, never saved data or admin", () => {
    for (const p of ["/", "/analyzer", "/audit", "/api/analyze", "/api/audit/page", "/guide"]) expect(isPublicToolPath(p)).toBe(true);
    for (const p of ["/projects", "/projects/x", "/admin", "/api/projects", "/api/admin/users", "/api/audits/x", "/analyzerx"]) expect(isPublicToolPath(p)).toBe(false);
  });
});
