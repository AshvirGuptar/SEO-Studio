import { describe, expect, it } from "vitest";
import { buildArticle, buildFaqPage, buildOrganization, buildProduct, jsonLdScript, validateJsonLd, type ArticleInput, type OrganizationInput, type ProductInput } from "./schema";
import { analyzeGeo } from "./geo";
import { extractFacts } from "./extract";

const sev = (checks: { id: string; severity: string }[], id: string) => checks.find((c) => c.id === id)?.severity;

const product: ProductInput = {
  name: "Aurora 12GB", description: "A 1440p graphics card with 12 GB of GDDR6X.", url: "https://example.com/p/aurora-12gb",
  image: "https://example.com/img/aurora.jpg", brand: "Example PC", sku: "AUR-12", gtin: "0123-4567-8901-2",
  price: "$549.00", currency: "usd", availability: "InStock", condition: "NewCondition",
};
const org: OrganizationInput = {
  name: "Example PC", url: "https://example.com", logo: "https://example.com/logo.png", description: "", email: "", telephone: "",
  sameAs: "https://www.linkedin.com/company/example-pc\nhttps://en.wikipedia.org/wiki/Example_PC",
};
const article: ArticleInput = {
  type: "BlogPosting", headline: "How to choose a 1440p graphics card", description: "", url: "https://example.com/blog/1440p",
  image: "https://example.com/img/1440p.jpg", authorName: "Jo Rivers", authorUrl: "https://example.com/authors/jo",
  publisher: "Example PC", publisherLogo: "", datePublished: "2026-10-01", dateModified: "2026-11-20",
};

describe("schema builder", () => {
  it("builds a Product with a normalized offer and drops empty fields", () => {
    const p = buildProduct(product);
    expect(p).toMatchObject({ "@context": "https://schema.org", "@type": "Product", gtin: "0123456789012", brand: { name: "Example PC" },
      offers: { "@type": "Offer", price: "549.00", priceCurrency: "USD", availability: "https://schema.org/InStock" } });
    const bare = buildProduct({ ...product, price: "", availability: "", brand: "", sku: "", gtin: "", image: "" });
    expect(bare).not.toHaveProperty("offers");
    expect(bare).not.toHaveProperty("brand");
  });

  it("passes a complete Product and fails one without an offer", () => {
    const good = validateJsonLd(buildProduct(product));
    expect(good.filter((c) => c.severity === "fail")).toEqual([]);
    const bad = validateJsonLd(buildProduct({ ...product, price: "", availability: "" }));
    expect(sev(bad, "schema-product-offer")).toBe("fail");
    expect(sev(validateJsonLd(buildProduct({ ...product, price: "about 500" })), "schema-product-price")).toBe("fail");
    expect(sev(validateJsonLd(buildProduct({ ...product, currency: "dollars" })), "schema-product-currency")).toBe("fail");
    expect(sev(validateJsonLd(buildProduct({ ...product, gtin: "12345" })), "schema-product-gtin")).toBe("fail");
  });

  it("checks Organization sameAs links", () => {
    const o = buildOrganization(org);
    expect(o.sameAs).toEqual(["https://www.linkedin.com/company/example-pc", "https://en.wikipedia.org/wiki/Example_PC"]);
    expect(sev(validateJsonLd(o), "schema-org-sameas")).toBe("pass");
    expect(sev(validateJsonLd(buildOrganization({ ...org, sameAs: "" })), "schema-org-sameas")).toBe("warn");
    expect(sev(validateJsonLd(buildOrganization({ ...org, sameAs: "linkedin.com/company/x" })), "schema-org-sameas")).toBe("fail");
    expect(sev(validateJsonLd(buildOrganization({ ...org, url: "" })), "schema-org-url")).toBe("fail");
  });

  it("checks Article dates and headline", () => {
    expect(validateJsonLd(buildArticle(article)).filter((c) => c.severity === "fail")).toEqual([]);
    expect(sev(validateJsonLd(buildArticle({ ...article, datePublished: "Nov 1st" })), "schema-article-date")).toBe("fail");
    expect(sev(validateJsonLd(buildArticle({ ...article, dateModified: "2026-01-01" })), "schema-article-modified")).toBe("fail");
    expect(sev(validateJsonLd(buildArticle({ ...article, headline: "x".repeat(120) })), "schema-article-headline-length")).toBe("warn");
  });

  it("builds FAQPage and flags incomplete items", () => {
    const f = buildFaqPage([{ question: "Does it fit a mid tower?", answer: "Yes, it is 2.5 slots wide." }, { question: "", answer: "dropped" }]);
    expect((f.mainEntity as unknown[]).length).toBe(1);
    expect(sev(validateJsonLd(f), "schema-faq-complete")).toBe("pass");
    expect(sev(validateJsonLd(buildFaqPage([])), "schema-faq-questions")).toBe("fail");
    expect(sev(validateJsonLd({ ...f, mainEntity: [{ "@type": "Question", name: "Q?", acceptedAnswer: { text: "" } }] }), "schema-faq-complete")).toBe("fail");
  });

  it("escapes < so the script tag can't be closed early", () => {
    const s = jsonLdScript({ name: "</script><b>" });
    expect(s).not.toContain("</script><b>");
    expect(JSON.parse(s.replace(/^<script[^>]*>|<\/script>$/g, ""))).toEqual({ name: "</script><b>" });
  });

  it("round-trips: the Page Analyzer's entity checks pass on a page with the generated markup", () => {
    const scripts = [buildArticle(article), buildOrganization(org), buildFaqPage([{ question: "Q one?", answer: "A." }, { question: "Q two?", answer: "B." }])].map(jsonLdScript).join("\n");
    const html = `<html><head>${scripts}</head><body><h1>t</h1><h2>What is it?</h2><p>a</p><h2>How does it work?</h2><p>b</p></body></html>`;
    const { checks } = analyzeGeo(extractFacts(html), { now: new Date("2026-11-25") });
    expect(sev(checks, "geo-schema")).toBe("pass");
    expect(sev(checks, "geo-entity")).toBe("pass");
    expect(sev(checks, "geo-faq-schema")).toBe("pass");
    expect(sev(checks, "geo-author")).toBe("pass");
    expect(sev(checks, "geo-freshness")).toBe("pass");
  });
});
