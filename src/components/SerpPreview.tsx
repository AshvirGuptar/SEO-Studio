import { approxPixelWidth } from "@/lib/seo/text";
import { LIMITS } from "@/lib/seo/copy";

function truncateToPx(text: string, maxPx: number) {
  if (approxPixelWidth(text) <= maxPx) return text;
  let out = text;
  while (out.length > 0 && approxPixelWidth(out + "…") > maxPx) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

/** Approximate Google desktop result snippet. */
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
    <div className="rounded-lg border border-border bg-white p-4 font-[arial,sans-serif] text-left dark:bg-[#202124]">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gray-100 text-xs text-gray-500 dark:bg-gray-700">
          {host[0]?.toUpperCase()}
        </span>
        <div className="leading-tight">
          <div className="text-sm text-[#202124] dark:text-[#dadce0]">{host}</div>
          <div className="text-xs text-[#4d5156] dark:text-[#bdc1c6]">https://{host}{crumbs && ` › ${crumbs}`}</div>
        </div>
      </div>
      <div className="mt-1 text-xl leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
        {truncateToPx(title || "Untitled page", LIMITS.titleMaxPx) }
      </div>
      <div className="mt-1 text-sm leading-snug text-[#4d5156] dark:text-[#bdc1c6]">
        {desc || "No meta description — Google will pull text from the page."}
      </div>
    </div>
  );
}
