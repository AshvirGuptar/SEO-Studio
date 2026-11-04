import type { Metadata } from "next";
import { ContentClient } from "./ContentClient";

export const metadata: Metadata = { title: "Content Optimizer" };

export default function ContentPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Content Optimizer</h1>
      <p className="mt-1 text-muted">Draft a title, meta description and body copy against a target keyword. Scores update as you type.</p>
      <ContentClient />
    </div>
  );
}
