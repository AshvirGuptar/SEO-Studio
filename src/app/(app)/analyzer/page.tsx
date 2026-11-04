import type { Metadata } from "next";
import { AnalyzerClient } from "./AnalyzerClient";

export const metadata: Metadata = { title: "Page Analyzer" };

export default function AnalyzerPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Page Analyzer</h1>
      <p className="mt-1 text-muted">Audit a live URL or pasted HTML for on-page SEO. Add a target keyword for keyword-specific checks.</p>
      <AnalyzerClient />
    </div>
  );
}
