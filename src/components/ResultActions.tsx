"use client";

import { useState } from "react";

/** Clears a tool back to its blank state. */
export function StartOverButton({ onClick, label = "Start over" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn-ghost" onClick={onClick} title="Clear the inputs and results">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
      </svg>
      {label}
    </button>
  );
}

/**
 * Builds a file on click (the PDF library is loaded only then) and downloads it.
 * `build` returns the file contents.
 */
export function DownloadReportButton({ build, filename, label = "Download PDF report" }: { build: () => Promise<Blob>; filename: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        setError(false);
        try {
          const blob = await build();
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } catch (e) {
          console.error(e);
          setError(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
      </svg>
      {busy ? "Building PDF…" : error ? "Couldn't build PDF, retry" : label}
    </button>
  );
}

/** Safe filename fragment from a URL or title. */
export function fileSlug(s: string): string {
  return s.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase() || "report";
}
