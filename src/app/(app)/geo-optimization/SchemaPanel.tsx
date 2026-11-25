"use client";

import { useMemo, useState } from "react";
import { CheckList } from "@/components/CheckList";
import { ScoreRing } from "@/components/ScoreRing";
import { summarize } from "@/lib/seo/score";
import {
  ARTICLE_TYPES, AVAILABILITY, buildArticle, buildOrganization, buildProduct, CONDITIONS, jsonLdScript, validateJsonLd,
  type ArticleInput, type OrganizationInput, type ProductInput,
} from "@/lib/seo/schema";
import { CodeBlock, CopyButton, DownloadButton } from "./ui";

type Kind = "Product" | "Organization" | "Article";

const EMPTY_PRODUCT: ProductInput = { name: "", description: "", url: "", image: "", brand: "", sku: "", gtin: "", price: "", currency: "USD", availability: "InStock", condition: "NewCondition" };
const EMPTY_ORG: OrganizationInput = { name: "", url: "", logo: "", description: "", email: "", telephone: "", sameAs: "" };
const EMPTY_ARTICLE: ArticleInput = { type: "Article", headline: "", description: "", url: "", image: "", authorName: "", authorUrl: "", publisher: "", publisherLogo: "", datePublished: "", dateModified: "" };

const label = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/ Condition$/, "");

/** Product, Organization (with sameAs) and Article JSON-LD from a form, validated before export. */
export function SchemaPanel() {
  const [kind, setKind] = useState<Kind>("Product");
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [org, setOrg] = useState(EMPTY_ORG);
  const [article, setArticle] = useState(EMPTY_ARTICLE);

  const data = useMemo(() => (kind === "Product" ? buildProduct(product) : kind === "Organization" ? buildOrganization(org) : buildArticle(article)), [kind, product, org, article]);
  const checks = useMemo(() => validateJsonLd(data), [data]);
  const fails = checks.filter((c) => c.severity === "fail").length;
  const script = jsonLdScript(data);

  const P = (k: keyof ProductInput) => ({ value: product[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setProduct({ ...product, [k]: e.target.value }) });
  const O = (k: keyof OrganizationInput) => ({ value: org[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setOrg({ ...org, [k]: e.target.value }) });
  const A = (k: keyof ArticleInput) => ({ value: article[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setArticle({ ...article, [k]: e.target.value } as ArticleInput) });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Schema type">
          {(["Product", "Organization", "Article"] as const).map((k) => (
            <button key={k} className={`pill ${kind === k ? "pill-on" : "pill-off"}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>
          ))}
        </div>
        <p className="text-sm text-muted">
          {kind === "Product" && "For product pages: tells search and AI shopping answers the price, stock and brand."}
          {kind === "Organization" && "Site-wide (usually on the homepage): sameAs links connect your site to your brand's profiles, so AI engines know who you are."}
          {kind === "Article" && "For blog posts and guides: a named author and dates are trust signals AI engines look for."}
        </p>

        <div className="card grid gap-4 sm:grid-cols-2">
          {kind === "Product" && (
            <>
              <Field id="p-name" label="Product name *" className="sm:col-span-2"><input id="p-name" className="input" placeholder="Aurora 12GB Graphics Card" {...P("name")} /></Field>
              <Field id="p-desc" label="Description" className="sm:col-span-2"><textarea id="p-desc" className="input h-20" {...P("description")} /></Field>
              <Field id="p-url" label="Page URL"><input id="p-url" className="input" type="url" placeholder="https://…" {...P("url")} /></Field>
              <Field id="p-img" label="Image URL"><input id="p-img" className="input" type="url" placeholder="https://…/image.jpg" {...P("image")} /></Field>
              <Field id="p-brand" label="Brand"><input id="p-brand" className="input" {...P("brand")} /></Field>
              <Field id="p-sku" label="SKU"><input id="p-sku" className="input" {...P("sku")} /></Field>
              <Field id="p-gtin" label="GTIN / UPC / EAN"><input id="p-gtin" className="input" inputMode="numeric" {...P("gtin")} /></Field>
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <Field id="p-price" label="Price *"><input id="p-price" className="input" inputMode="decimal" placeholder="549.99" {...P("price")} /></Field>
                <Field id="p-cur" label="Currency"><input id="p-cur" className="input uppercase" maxLength={3} {...P("currency")} /></Field>
              </div>
              <Field id="p-avail" label="Availability">
                <select id="p-avail" className="input" {...P("availability")}>
                  <option value="">Not set</option>
                  {AVAILABILITY.map((a) => <option key={a} value={a}>{label(a)}</option>)}
                </select>
              </Field>
              <Field id="p-cond" label="Condition">
                <select id="p-cond" className="input" {...P("condition")}>
                  <option value="">Not set</option>
                  {CONDITIONS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
                </select>
              </Field>
            </>
          )}
          {kind === "Organization" && (
            <>
              <Field id="o-name" label="Organization name *"><input id="o-name" className="input" {...O("name")} /></Field>
              <Field id="o-url" label="Website URL *"><input id="o-url" className="input" type="url" placeholder="https://…" {...O("url")} /></Field>
              <Field id="o-logo" label="Logo URL"><input id="o-logo" className="input" type="url" {...O("logo")} /></Field>
              <Field id="o-email" label="Contact email"><input id="o-email" className="input" type="email" {...O("email")} /></Field>
              <Field id="o-tel" label="Phone"><input id="o-tel" className="input" type="tel" {...O("telephone")} /></Field>
              <Field id="o-desc" label="Description"><input id="o-desc" className="input" {...O("description")} /></Field>
              <Field id="o-same" label="sameAs profiles (one URL per line)" className="sm:col-span-2">
                <textarea id="o-same" className="input h-28 font-mono text-xs" placeholder={"https://www.linkedin.com/company/…\nhttps://en.wikipedia.org/wiki/…\nhttps://www.wikidata.org/wiki/Q…\nhttps://www.instagram.com/…"} {...O("sameAs")} />
              </Field>
            </>
          )}
          {kind === "Article" && (
            <>
              <Field id="a-type" label="Type">
                <select id="a-type" className="input" {...A("type")}>{ARTICLE_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
              </Field>
              <Field id="a-url" label="Page URL"><input id="a-url" className="input" type="url" {...A("url")} /></Field>
              <Field id="a-head" label="Headline *" className="sm:col-span-2"><input id="a-head" className="input" {...A("headline")} /></Field>
              <Field id="a-desc" label="Description" className="sm:col-span-2"><input id="a-desc" className="input" {...A("description")} /></Field>
              <Field id="a-author" label="Author name"><input id="a-author" className="input" {...A("authorName")} /></Field>
              <Field id="a-aurl" label="Author profile URL"><input id="a-aurl" className="input" type="url" {...A("authorUrl")} /></Field>
              <Field id="a-pub" label="Published"><input id="a-pub" className="input" type="date" {...A("datePublished")} /></Field>
              <Field id="a-mod" label="Updated"><input id="a-mod" className="input" type="date" {...A("dateModified")} /></Field>
              <Field id="a-img" label="Image URL"><input id="a-img" className="input" type="url" {...A("image")} /></Field>
              <Field id="a-publisher" label="Publisher"><input id="a-publisher" className="input" {...A("publisher")} /></Field>
              <Field id="a-plogo" label="Publisher logo URL" className="sm:col-span-2"><input id="a-plogo" className="input" type="url" {...A("publisherLogo")} /></Field>
            </>
          )}
        </div>
      </div>

      <aside className="min-w-0 space-y-4">
        <div className="card space-y-3">
          <ScoreRing summary={summarize(checks)} size={96} label={`${kind} markup`} />
          <CodeBlock code={script} label={`${kind} JSON-LD`} />
          {fails > 0 && <p className="text-sm text-fail" role="status">✕ {fails} problem{fails === 1 ? "" : "s"} to fix before this markup is valid.</p>}
          <div className="flex flex-wrap gap-2">
            <CopyButton text={script} label={fails ? "Copy anyway" : "Copy markup"} className={fails ? "btn-ghost" : "btn"} />
            <DownloadButton text={JSON.stringify(data, null, 2)} filename={`${kind.toLowerCase()}-schema.json`} type="application/ld+json" label="Download .json" />
          </div>
        </div>
        <div className="card"><CheckList checks={checks} groupByCategory={false} /></div>
      </aside>
    </div>
  );
}

function Field({ id, label, className = "", children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
