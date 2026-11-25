import { describe, expect, it } from "vitest";
import { paginate } from "./pagination";

describe("paginate", () => {
  it("splits into pages and clamps bad input", () => {
    expect(paginate(60, "2", 25)).toEqual({ page: 2, pages: 3, start: 25, end: 50 });
    expect(paginate(60, "9", 25)).toMatchObject({ page: 3, start: 50, end: 60 });
    expect(paginate(60, "abc", 25)).toMatchObject({ page: 1, start: 0 });
    expect(paginate(0, undefined, 25)).toEqual({ page: 1, pages: 1, start: 0, end: 0 });
    expect(paginate(30, ["2"], 25)).toMatchObject({ page: 2, start: 25, end: 30 });
  });
});
