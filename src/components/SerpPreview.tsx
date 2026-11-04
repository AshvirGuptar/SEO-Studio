import { approxPixelWidth } from "@/lib/seo/text";
import { LIMITS } from "@/lib/seo/copy";

function truncateToPx(text: string, maxPx: number) {
  if (approxPixelWidth(text) <= maxPx) return text;
  let out = text;
  while (out.length > 0 && approxPixelWidth(out + "…") > maxPx) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

/** Approximate Google desktop result snippet (Google's dark-mode colors to match the app). */
export function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  let host = "example.com";
  let crumbs = "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url || "example.com"}`);
    host = u.hostname;
    crumbs = u.pathname.split("/").filter(Boolean).map(decodeURIComponent).join(" › ");
  } catch { /* keep defaults */ }
  const desc = description.length > LIMITS.metaMaxChars ? description.slice(0, LIMITS.metaMaxChars - 3).trimEnd() + "…" : description;

  return (
    <div className="rounded-xl border border-border bg-[#1f1f1f] p-4 text-left font-[arial,sans-serif]">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#303134] text-xs text-[#bdc1c6]">
          {host[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-sm text-[#dadce0]">{host}</div>
          <div className="truncate text-xs text-[#bdc1c6]">https://{host}{crumbs && ` › ${crumbs}`}</div>
        </div>
      </div>
      <div className="mt-1.5 text-xl leading-snug text-[#99c3ff]">{truncateToPx(title || "Untitled page", LIMITS.titleMaxPx)}</div>
      <div className="mt-1 text-sm leading-snug text-[#bdc1c6]">
        {desc || "No meta description — Google will pull text from the page."}
      </div>
    </div>
  );
}
