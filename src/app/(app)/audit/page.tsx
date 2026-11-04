import type { Metadata } from "next";
import { AuditClient } from "./AuditClient";

export const metadata: Metadata = { title: "Site Audit" };

export default function AuditPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Site Audit</h1>
      <p className="mt-1 text-muted">
        Crawl a website like a search engine would. Finds broken pages and links, redirects, duplicate titles,
        thin content, orphan pages and more across the whole site.
      </p>
      <AuditClient />
    </div>
  );
}
