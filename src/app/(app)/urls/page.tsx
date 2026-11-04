import type { Metadata } from "next";
import { UrlsClient } from "./UrlsClient";

export const metadata: Metadata = { title: "URL Optimizer" };

export default function UrlsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">URL Optimizer</h1>
      <p className="mt-1 text-muted">Paste one URL (or path) per line to check it and get a cleaner, keyword-rich suggestion. Export the results as a redirect map.</p>
      <UrlsClient />
    </div>
  );
}
