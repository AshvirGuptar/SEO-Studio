import { useId } from "react";

/** Brand mark: orange gradient tile with a rising trend line. */
export function Logo({ size = 28 }: { size?: number }) {
  // Unique gradient id per instance: the logo renders twice (mobile header + desktop sidebar) and a
  // shared id makes the visible copy reference the hidden copy's gradient, so it draws nothing.
  const gradientId = `logo-g-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a45" />
          <stop offset="0.55" stopColor="#f15a29" />
          <stop offset="1" stopColor="#c9441a" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <path d="M8 21.5l5-5 4 3.5 7-8" fill="none" stroke="#0b0b0c" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 12H24v4.5" fill="none" stroke="#0b0b0c" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
