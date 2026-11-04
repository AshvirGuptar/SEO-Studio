import { describe, expect, it } from "vitest";
import { classifyIntent, clusterKeywords, coreTerms, mapClustersToPages, parseKeywords, stem } from "./keywords";

describe("intent", () => {
  it.each([
    ["buy hiking boots", "transactional"],
    ["hiking boots near me", "transactional"],
    ["best hiking boots 2026", "commercial"],
    ["merrell vs salomon", "commercial"],
    ["how to clean hiking boots", "informational"],
    ["rei login", "navigational"],
    ["waterproof hiking boots", "commercial"],
  ])("%s → %s", (kw, intent) => expect(classifyIntent(kw)).toBe(intent));
});

describe("terms", () => {
  it("stems plurals and -ing", () => {
    expect(stem("boots")).toBe("boot");
    expect(stem("running")).toBe("run");
    expect(stem("accessories")).toBe("accessory");
    expect(stem("glass")).toBe("glass");
  });
  it("drops modifiers and stop words", () => {
    expect([...coreTerms("best waterproof hiking boots for women")]).toEqual(["waterproof", "hik", "boot", "women"]);
  });
});

describe("hyphenated spellings", () => {
  it("clusters wifi and wi-fi together", () => {
    const clusters = clusterKeywords(parseKeywords("wifi motherboard,500\nwi-fi motherboard,300\nmatx motherboard,200"), 0.7);
    expect(clusters.find((c) => c.name === "wifi motherboard")?.keywords.map((k) => k.keyword)).toContain("wi-fi motherboard");
    expect(clusters.find((c) => c.name === "matx motherboard")).toBeDefined();
  });
});

describe("competing pages", () => {
  it("ignores more specific pages that own a different cluster", () => {
    const clusters = clusterKeywords(parseKeywords("graphics card,900\nlow profile graphics card,300"), 0.7);
    const r = mapClustersToPages(clusters, [
      "https://s.com/graphics-cards | Graphics Cards",
      "https://s.com/collections/gpus | Graphics Cards & GPUs",
      "https://s.com/graphics-cards/low-profile | Low Profile Graphics Cards",
    ].join("\n"));
    expect(r.competing).toEqual([{ cluster: "graphics card", pages: ["https://s.com/graphics-cards", "https://s.com/collections/gpus"] }]);
    expect(r.clusters.find((c) => c.name === "low profile graphics card")?.page).toBe("https://s.com/graphics-cards/low-profile");
  });
});

describe("parseKeywords", () => {
  it("handles plain lines, CSV with volume, header row and duplicates", () => {
    const parsed = parseKeywords("Keyword,Volume\nhiking boots,12,000\nHiking Boots\ntrail shoes\t900\n");
    expect(parsed).toEqual([
      { keyword: "hiking boots", volume: 12000 },
      { keyword: "trail shoes", volume: 900 },
    ]);
  });
});

describe("clusterKeywords", () => {
  const kws = parseKeywords(`hiking boots,5000
best hiking boots,2000
buy hiking boots,800
hiking boot,300
how to clean hiking boots,400
hiking boot cleaning tips,100
trail running shoes,3000
best trail running shoes,900`);

  it("groups related keywords and names clusters by the strongest keyword", () => {
    const clusters = clusterKeywords(kws, 0.5);
    const boots = clusters.find((c) => c.name === "hiking boots")!;
    expect(boots.keywords.map((k) => k.keyword)).toEqual(
      expect.arrayContaining(["best hiking boots", "buy hiking boots", "hiking boot"]),
    );
    const trail = clusters.find((c) => c.name === "trail running shoes")!;
    expect(trail.keywords).toHaveLength(2);
    expect(clusters.find((c) => c.name.includes("clean"))?.keywords.length).toBe(2);
    expect(boots.suggestedSlug).toBe("hiking-boots");
  });

  it("higher thresholds produce more, tighter clusters", () => {
    const more = [...kws, { keyword: "waterproof hiking boots", volume: 600 }];
    const loose = clusterKeywords(more, 0.3);
    const strict = clusterKeywords(more, 0.9);
    expect(loose.find((c) => c.name === "hiking boots")!.keywords.map((k) => k.keyword)).toContain("waterproof hiking boots");
    expect(strict.find((c) => c.name === "waterproof hiking boots")).toBeDefined();
    expect(strict.length).toBeGreaterThan(loose.length);
  });
});

describe("mapClustersToPages", () => {
  it("maps clusters to pages and finds gaps", () => {
    const clusters = clusterKeywords(parseKeywords("hiking boots,500\nwaterproof hiking boots,300\ntrail running shoes,200\nrain jackets,100"), 0.7);
    const r = mapClustersToPages(clusters, "https://s.com/hiking-boots\nhttps://s.com/shoes/trail-running | Trail Running Shoes");
    const byName = Object.fromEntries(r.clusters.map((c) => [c.name, c.page]));
    expect(byName["trail running shoes"]).toBe("https://s.com/shoes/trail-running");
    expect(byName["hiking boots"]).toBe("https://s.com/hiking-boots");
    // The generic boots page doesn't target "waterproof", so that's a gap, not a match.
    expect(r.gaps).toEqual(expect.arrayContaining(["waterproof hiking boots", "rain jackets"]));
  });

  it("flags cannibalization when one page is the best match for several clusters", () => {
    const clusters = clusterKeywords(parseKeywords("hiking boots,500\ntrail shoes,300"), 0.7);
    const r = mapClustersToPages(clusters, "https://s.com/footwear | Hiking Boots and Trail Shoes");
    expect(r.cannibalized).toEqual([{ page: "https://s.com/footwear", clusters: ["hiking boots", "trail shoes"] }]);
  });

  it("flags several pages competing for the same cluster, mapping it to the most focused one", () => {
    const clusters = clusterKeywords(parseKeywords("hiking boots,500"), 0.7);
    const r = mapClustersToPages(clusters, "https://s.com/collections/boots | Hiking Boots & Outdoor Footwear\nhttps://s.com/hiking-boots | Hiking Boots");
    expect(r.competing).toEqual([{ cluster: "hiking boots", pages: ["https://s.com/collections/boots", "https://s.com/hiking-boots"] }]);
    expect(r.clusters[0].page).toBe("https://s.com/hiking-boots");
  });

  it("doesn't match on a single shared generic word, and prefers the most specific page", () => {
    const clusters = clusterKeywords(parseKeywords("hiking boots,500\nwomens hiking boots,400\nhiking socks,300\nwhat to wear hiking,200"), 0.7);
    const r = mapClustersToPages(clusters, "https://s.com/hiking-boots | Hiking Boots\nhttps://s.com/hiking-boots/womens | Women's Hiking Boots");
    const byName = Object.fromEntries(r.clusters.map((c) => [c.name, c.page]));
    expect(byName["hiking boots"]).toBe("https://s.com/hiking-boots");
    expect(byName["womens hiking boots"]).toBe("https://s.com/hiking-boots/womens");
    expect(byName["hiking socks"]).toBeUndefined();
    expect(r.gaps).toEqual(expect.arrayContaining(["hiking socks", "what to wear hiking"]));
    expect(r.cannibalized).toEqual([]);
  });

  it("maps how-to topics only to blog/guide pages, and product topics only to shop pages", () => {
    const clusters = clusterKeywords(parseKeywords("hiking boots,500\nhow to clean hiking boots,300\nhow to break in hiking boots,200"), 0.7);
    const r = mapClustersToPages(clusters, "https://s.com/hiking-boots\nhttps://s.com/blog/break-in-hiking-boots | How to Break In Hiking Boots");
    const byName = Object.fromEntries(r.clusters.map((c) => [c.name, c.page]));
    expect(byName["hiking boots"]).toBe("https://s.com/hiking-boots");
    expect(byName["how to break in hiking boots"]).toBe("https://s.com/blog/break-in-hiking-boots");
    expect(byName["how to clean hiking boots"]).toBeUndefined();
    expect(r.cannibalized).toEqual([]);
  });
});
