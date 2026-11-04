import { Logo } from "./Logo";

/** Logo + "SEO & GEO Studio" with the accent on "Studio". */
export function Wordmark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 whitespace-nowrap font-semibold tracking-tight ${className}`}>
      <Logo size={size} />
      <span>SEO <span className="text-subtle">&amp;</span> GEO <span className="text-accent">Studio</span></span>
    </span>
  );
}
