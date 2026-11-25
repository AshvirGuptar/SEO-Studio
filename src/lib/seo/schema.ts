/**
 * JSON-LD schema builder for GEO Optimization (pure, runs in the browser): builds Product,
 * Organization (with sameAs), Article and FAQPage markup from form fields, and validates it against
 * schema.org shapes and Google's documented required/recommended properties before export.
 */
import type { Check } from "./types";
import type { FaqItem } from "./geo-optimize";

export type SchemaKind = "Product" | "Organization" | "Article" | "FAQPage";

export interface ProductInput {
  name: string; description: string; url: string; image: string; brand: string; sku: string; gtin: string;
  price: string; currency: string; availability: string; condition: string;
}
export interface OrganizationInput {
  name: string; url: string; logo: string; description: string; email: string; telephone: string;
  /** One profile URL per line (LinkedIn, Wikipedia/Wikidata, social). */
  sameAs: string;
}
export interface ArticleInput {
  type: "Article" | "BlogPosting" | "NewsArticle";
  headline: string; description: string; url: string; image: string; authorName: string; authorUrl: string;
  publisher: string; publisherLogo: string; datePublished: string; dateModified: string;
}

export const AVAILABILITY = ["InStock", "OutOfStock", "PreOrder", "BackOrder", "LimitedAvailability", "Discontinued", "SoldOut", "OnlineOnly", "InStoreOnly"] as const;
export const CONDITIONS = ["NewCondition", "UsedCondition", "RefurbishedCondition", "DamagedCondition"] as const;
export const ARTICLE_TYPES = ["Article", "BlogPosting", "NewsArticle"] as const;

export const SCHEMA_LIMITS = { headlineMax: 110, faqAnswerMaxWords: 300 } as const;

export type JsonLd = Record<string, unknown>;

/** Drops empty strings, empty arrays and objects that end up with only "@type". */
function compact(o: JsonLd): JsonLd {
  const out: JsonLd = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") { if (v.trim()) out[k] = v.trim(); continue; }
    if (Array.isArray(v)) { if (v.length) out[k] = v; continue; }
    if (typeof v === "object") {
      const inner = compact(v as JsonLd);
      if (Object.keys(inner).some((key) => key !== "@type")) out[k] = inner;
      continue;
    }
    out[k] = v;
  }
  return out;
}

const lines = (s: string) => s.split(/[\r\n,]+/).map((l) => l.trim()).filter(Boolean);
const ctx = { "@context": "https://schema.org" };

export function buildProduct(i: ProductInput): JsonLd {
  const gtin = i.gtin.replace(/\s|-/g, "");
  return compact({
    ...ctx, "@type": "Product", name: i.name, description: i.description, url: i.url, image: i.image,
    sku: i.sku, ...(gtin ? { gtin } : {}),
    brand: { "@type": "Brand", name: i.brand },
    offers: !i.price.trim() && !i.availability ? undefined : {
      "@type": "Offer", price: i.price.replace(/[$€£,\s]/g, ""), priceCurrency: i.currency.toUpperCase(), url: i.url,
      availability: i.availability ? `https://schema.org/${i.availability}` : "",
      itemCondition: i.condition ? `https://schema.org/${i.condition}` : "",
    },
  });
}

export function buildOrganization(i: OrganizationInput): JsonLd {
  return compact({
    ...ctx, "@type": "Organization", name: i.name, url: i.url, logo: i.logo, description: i.description,
    email: i.email, telephone: i.telephone, sameAs: lines(i.sameAs),
  });
}

export function buildArticle(i: ArticleInput): JsonLd {
  return compact({
    ...ctx, "@type": i.type, headline: i.headline, description: i.description, image: i.image,
    mainEntityOfPage: i.url, datePublished: i.datePublished, dateModified: i.dateModified,
    author: { "@type": "Person", name: i.authorName, url: i.authorUrl },
    publisher: { "@type": "Organization", name: i.publisher, logo: i.publisherLogo ? { "@type": "ImageObject", url: i.publisherLogo } : undefined },
  });
}

export function buildFaqPage(faqs: FaqItem[]): JsonLd {
  return {
    ...ctx, "@type": "FAQPage",
    mainEntity: faqs.filter((f) => f.question.trim() && f.answer.trim()).map((f) => ({
      "@type": "Question", name: f.question.trim(), acceptedAnswer: { "@type": "Answer", text: f.answer.trim() },
    })),
  };
}

/** A paste-ready <script> tag. "<" is escaped so text like "</script>" can't end the tag early. */
export function jsonLdScript(data: JsonLd): string {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n</script>`;
}

// ---------- Validation ----------

const isAbsUrl = (v: unknown) => typeof v === "string" && /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as JsonLd) : {});
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const CURRENCY = /^[A-Z]{3}$/;
const PRICE = /^\d+(\.\d{1,2})?$/;

type Rule = Omit<Check, "category"> & { category?: Check["category"] };
const check = (r: Rule): Check => ({ category: "entity", ...r });

function required(id: string, label: string, ok: boolean, fix: string, weight = 10): Check {
  return check(ok
    ? { id, label, weight, severity: "pass", message: `${label} is set.` }
    : { id, label, weight, severity: "fail", message: `${label} is required.`, fix });
}
function recommended(id: string, label: string, ok: boolean, why: string, fix: string, weight = 3): Check {
  return check(ok
    ? { id, label, weight, severity: "pass", message: `${label} is set.` }
    : { id, label, weight, severity: "warn", message: `${label} is missing. ${why}`, fix });
}
function urlCheck(id: string, label: string, v: unknown, weight = 4): Check | null {
  if (v === undefined || v === "") return null;
  return check(isAbsUrl(v)
    ? { id, label, weight, severity: "pass", message: `${label} is a full URL.` }
    : { id, label, weight, severity: "fail", message: `${label} "${str(v)}" isn't a full URL.`, fix: "Use an absolute URL starting with https://." });
}

/**
 * Validates JSON-LD before export. Failures break the markup (missing required properties, invalid
 * values); warnings are recommended properties that help search and AI engines understand the entity.
 */
export function validateJsonLd(data: JsonLd): Check[] {
  const type = str(data["@type"]);
  const checks: Check[] = [
    required("schema-context", "@context schema.org", data["@context"] === "https://schema.org", "Set @context to https://schema.org.", 5),
  ];
  const push = (c: Check | null) => { if (c) checks.push(c); };

  if (type === "Product") {
    const offers = obj(data.offers);
    checks.push(required("schema-product-name", "Product name", !!str(data.name), "Add the product's name."));
    checks.push(required("schema-product-offer", "Offer, review or rating", Object.keys(offers).length > 0 || !!data.review || !!data.aggregateRating,
      "Add a price and currency (an Offer). Google needs an offer, review or rating to show product results."));
    if (Object.keys(offers).length) {
      checks.push(check(PRICE.test(str(offers.price))
        ? { id: "schema-product-price", label: "Price", weight: 6, severity: "pass", message: `Price ${str(offers.price)}.` }
        : { id: "schema-product-price", label: "Price", weight: 6, severity: "fail", message: offers.price ? `Price "${str(offers.price)}" isn't a plain number.` : "The offer has no price.", fix: "Write the price as a number like 549 or 549.99 (no currency symbol)." }));
      checks.push(check(CURRENCY.test(str(offers.priceCurrency))
        ? { id: "schema-product-currency", label: "Currency", weight: 6, severity: "pass", message: `Currency ${str(offers.priceCurrency)}.` }
        : { id: "schema-product-currency", label: "Currency", weight: 6, severity: "fail", message: "The currency must be a 3-letter ISO 4217 code.", fix: "Use a code like USD, EUR or GBP." }));
      checks.push(recommended("schema-product-availability", "Availability", !!offers.availability, "Shopping and AI answers show stock status.", "Choose an availability (In stock, Out of stock…)."));
    }
    checks.push(recommended("schema-product-image", "Image", !!data.image, "Product results usually need an image.", "Add a product image URL."));
    checks.push(recommended("schema-product-description", "Description", !!data.description, "AI answers quote it to describe the product.", "Add a one- or two-sentence description."));
    checks.push(recommended("schema-product-brand", "Brand", !!obj(data.brand).name, "Connects the product to its maker.", "Add the brand name."));
    checks.push(recommended("schema-product-id", "SKU or GTIN", !!data.sku || !!data.gtin, "Identifiers let engines match the same product across stores.", "Add a SKU, or a GTIN/UPC/EAN barcode number.", 2));
    if (data.gtin !== undefined) {
      checks.push(check(/^(\d{8}|\d{12,14})$/.test(str(data.gtin))
        ? { id: "schema-product-gtin", label: "GTIN format", weight: 3, severity: "pass", message: "GTIN has a valid length." }
        : { id: "schema-product-gtin", label: "GTIN format", weight: 3, severity: "fail", message: "A GTIN is 8, 12, 13 or 14 digits.", fix: "Copy the barcode number exactly, digits only." }));
    }
    push(urlCheck("schema-url", "Page URL", data.url));
    push(urlCheck("schema-image-url", "Image URL", data.image));
  } else if (type === "Organization") {
    const sameAs = Array.isArray(data.sameAs) ? data.sameAs : [];
    const bad = sameAs.filter((u) => !isAbsUrl(u));
    checks.push(required("schema-org-name", "Organization name", !!str(data.name), "Add the organization's name."));
    checks.push(required("schema-org-url", "Website URL", !!str(data.url), "Add the homepage URL."));
    push(urlCheck("schema-url", "Website URL", data.url));
    checks.push(recommended("schema-org-logo", "Logo", !!data.logo, "Used in knowledge panels and AI answers.", "Add a logo image URL."));
    push(urlCheck("schema-logo-url", "Logo URL", data.logo));
    checks.push(check(sameAs.length === 0
      ? { id: "schema-org-sameas", label: "sameAs profiles", weight: 6, severity: "warn", message: "No sameAs links. They tell AI engines which brand this is.", fix: "Add official profile URLs: LinkedIn, Wikipedia or Wikidata, social accounts." }
      : bad.length
        ? { id: "schema-org-sameas", label: "sameAs profiles", weight: 6, severity: "fail", message: `Not full URLs: ${bad.map(String).join(", ")}.`, fix: "Each sameAs entry must be a full https:// URL." }
        : { id: "schema-org-sameas", label: "sameAs profiles", weight: 6, severity: "pass", value: `${sameAs.length} profiles`, message: "Links to official profiles connect the site to your brand entity." }));
  } else if ((ARTICLE_TYPES as readonly string[]).includes(type)) {
    const headline = str(data.headline);
    checks.push(required("schema-article-headline", "Headline", !!headline, "Add the article's headline."));
    if (headline) {
      checks.push(check(headline.length <= SCHEMA_LIMITS.headlineMax
        ? { id: "schema-article-headline-length", label: "Headline length", weight: 3, severity: "pass", value: `${headline.length} chars`, message: "Headline fits." }
        : { id: "schema-article-headline-length", label: "Headline length", weight: 3, severity: "warn", value: `${headline.length} chars`, message: `Headlines over ${SCHEMA_LIMITS.headlineMax} characters may be cut.`, fix: "Shorten the headline." }));
    }
    checks.push(recommended("schema-article-author", "Author", !!obj(data.author).name, "A named author is a trust signal for AI engines.", "Add the author's name (and a profile URL).", 5));
    const pub = str(data.datePublished);
    const mod = str(data.dateModified);
    checks.push(check(!pub
      ? { id: "schema-article-date", label: "Published date", weight: 5, severity: "warn", message: "No datePublished. AI engines favor dated, current content.", fix: "Add the publish date (YYYY-MM-DD)." }
      : ISO_DATE.test(pub) && !Number.isNaN(Date.parse(pub))
        ? { id: "schema-article-date", label: "Published date", weight: 5, severity: "pass", message: `Published ${pub}.` }
        : { id: "schema-article-date", label: "Published date", weight: 5, severity: "fail", message: `"${pub}" isn't an ISO 8601 date.`, fix: "Use YYYY-MM-DD (optionally with a time)." }));
    if (mod) {
      const valid = ISO_DATE.test(mod) && !Number.isNaN(Date.parse(mod));
      const order = !pub || !valid || Date.parse(mod) >= Date.parse(pub);
      checks.push(check(!valid
        ? { id: "schema-article-modified", label: "Updated date", weight: 3, severity: "fail", message: `"${mod}" isn't an ISO 8601 date.`, fix: "Use YYYY-MM-DD." }
        : !order
          ? { id: "schema-article-modified", label: "Updated date", weight: 3, severity: "fail", message: "dateModified is before datePublished.", fix: "Check the dates." }
          : { id: "schema-article-modified", label: "Updated date", weight: 3, severity: "pass", message: `Updated ${mod}.` }));
    }
    checks.push(recommended("schema-article-image", "Image", !!data.image, "Article results usually need an image.", "Add an image URL."));
    push(urlCheck("schema-image-url", "Image URL", data.image));
    push(urlCheck("schema-url", "Page URL", data.mainEntityOfPage));
    push(urlCheck("schema-author-url", "Author URL", obj(data.author).url));
  } else if (type === "FAQPage") {
    const qs = Array.isArray(data.mainEntity) ? (data.mainEntity as JsonLd[]) : [];
    const incomplete = qs.filter((q) => !str(q.name) || !str(obj(q.acceptedAnswer).text));
    const notQuestions = qs.filter((q) => str(q.name) && !/\?\s*$/.test(str(q.name)));
    const long = qs.filter((q) => str(obj(q.acceptedAnswer).text).split(/\s+/).length > SCHEMA_LIMITS.faqAnswerMaxWords);
    checks.push(required("schema-faq-questions", "Questions", qs.length > 0, "Add at least one question with an answer."));
    if (qs.length) {
      checks.push(check(incomplete.length
        ? { id: "schema-faq-complete", label: "Every question answered", weight: 8, severity: "fail", message: `${incomplete.length} question(s) have no answer text.`, fix: "Give each question an answer, or remove it." }
        : { id: "schema-faq-complete", label: "Every question answered", weight: 8, severity: "pass", message: `${qs.length} question(s), each with an answer.` }));
      checks.push(check(notQuestions.length
        ? { id: "schema-faq-phrasing", label: "Phrased as questions", weight: 2, severity: "warn", message: `${notQuestions.length} item(s) don't end with "?".`, fix: "Write each one the way a person would ask it." }
        : { id: "schema-faq-phrasing", label: "Phrased as questions", weight: 2, severity: "pass", message: "Each item is a real question." }));
      checks.push(check(long.length
        ? { id: "schema-faq-length", label: "Answer length", weight: 2, severity: "warn", message: `${long.length} answer(s) run over ${SCHEMA_LIMITS.faqAnswerMaxWords} words.`, fix: "Keep answers short and direct; link to the full page for detail." }
        : { id: "schema-faq-length", label: "Answer length", weight: 2, severity: "pass", message: "Answers are concise." }));
    }
    checks.push(check({ id: "schema-faq-visible", label: "Matches visible content", weight: 1, severity: "info",
      message: "The questions and answers must also appear on the page. Google shows FAQ rich results only for some sites (mainly government and health), but the markup still spells out your Q&A for AI engines." }));
  } else {
    checks.push(check({ id: "schema-type", label: "Schema type", weight: 10, severity: "fail", message: `Unsupported @type "${type}".`, fix: "Choose Product, Organization, Article or FAQPage." }));
  }
  return checks;
}
