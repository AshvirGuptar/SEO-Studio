import { describe, expect, it } from "vitest";
import { checkFacts, describeFactCheck, extractClaims, extractNumbers } from "./facts";

const SOURCE = "Aurora 12GB graphics card: 12 GB GDDR6X, 2,610 MHz boost, 650 W PSU recommended, 3-year warranty. $549.00.";

describe("fact extraction", () => {
  it("normalizes numbers and keeps currency on prices", () => {
    expect(extractNumbers(SOURCE).sort()).toEqual(["$549", "12", "2610", "3", "650", "6"].sort());
    expect(extractNumbers("Was $129.99, PCIe 4.0")).toEqual(["$129.99", "4"]);
  });
  it("finds marketing claims", () => {
    expect(extractClaims("Free shipping and a lifetime guarantee!")).toEqual(["free shipping", "guarantee", "lifetime"]);
  });
});

describe("checkFacts", () => {
  it("passes a faithful title that leaves facts out (no-invent)", () => {
    // The target keyword counts as source, so "1440p" from the keyword is allowed.
    expect(checkFacts(`${SOURCE} 1440p graphics card`, "Aurora 12GB Graphics Card for 1440p | Example PC", { mode: "no-invent" }).ok).toBe(true);
    expect(checkFacts(SOURCE, "Aurora 12GB Graphics Card for 1440p", { mode: "no-invent" }).inventedNumbers).toEqual(["1440"]);
  });
  it("catches invented prices, numbers and claims", () => {
    const c = checkFacts(SOURCE, "Aurora 12GB, now $499 with free shipping and 16 GB memory", { mode: "no-invent" });
    expect(c.ok).toBe(false);
    expect(c.inventedNumbers.sort()).toEqual(["$499", "16"]);
    expect(c.inventedClaims).toEqual(["free shipping"]);
    expect(describeFactCheck(c)).toMatch(/^Adds numbers not in the original/);
  });
  it("preserve mode: requires every source number and the listed facts", () => {
    const good = "The Aurora 12GB pairs 12 GB of GDDR6X with a 2,610 MHz boost. Use a 650 W PSU. 3-year warranty. $549.";
    expect(checkFacts(SOURCE, good, { mode: "preserve", requiredFacts: ["12 GB GDDR6X", "$549"] }).missingFacts).toEqual(["12 GB GDDR6X"]);
    expect(checkFacts(SOURCE, good, { mode: "preserve", requiredFacts: ["GDDR6X", "650 W"] }).ok).toBe(true);
    const dropped = checkFacts(SOURCE, "The Aurora 12GB is fast and quiet. $549.", { mode: "preserve" });
    expect(dropped.droppedNumbers.sort()).toEqual(["2610", "3", "6", "650"].sort());
  });
});

describe("preserveFrom", () => {
  it("only requires the description's own numbers, while specs may still be used", () => {
    const body = "A 12 GB card for 1440p.";
    const specs = "Boost clock: 2,610 MHz\nPrice: $549";
    const c = checkFacts(`${body}\n${specs}`, "This 12 GB card handles 1440p and boosts to 2,610 MHz.", { mode: "preserve", preserveFrom: body });
    expect(c.ok).toBe(true);
    expect(checkFacts(`${body}\n${specs}`, "A great card for 1440p.", { mode: "preserve", preserveFrom: body }).droppedNumbers).toEqual(["12"]);
  });
});
