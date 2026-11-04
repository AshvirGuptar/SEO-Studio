import type { Metadata } from "next";
import { KeywordsClient } from "./KeywordsClient";

export const metadata: Metadata = { title: "Keyword Clusters" };

export default function KeywordsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Keyword Clusters</h1>
      <p className="mt-1 text-muted">
        Paste a keyword list to group it into topics, one cluster per page. Add your existing pages to find
        content gaps and pages competing for the same keywords.
      </p>
      <KeywordsClient />
    </div>
  );
}
