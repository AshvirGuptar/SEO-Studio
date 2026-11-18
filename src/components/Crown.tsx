/** Gold crown marking premium (AI-powered, sign-in required) tools. */
export function Crown({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`shrink-0 text-premium ${className}`}>
      <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19 18H5L3 7.5Z" />
      <rect x="5" y="19.5" width="14" height="2" rx="1" />
    </svg>
  );
}

/** "Premium" label with crown, for cards and headers. */
export function PremiumBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-premium-soft px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-premium ${className}`}>
      <Crown size={12} /> Premium
    </span>
  );
}
