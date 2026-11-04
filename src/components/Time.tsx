"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Renders a timestamp in the viewer's timezone (server renders a stable UTC date to avoid hydration mismatches). */
export function Time({ iso, relative = false }: { iso: string | Date; relative?: boolean }) {
  const d = new Date(iso);
  const text = useSyncExternalStore(
    noop,
    () => (relative ? relativeTime(d) : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })),
    () => d.toISOString().slice(0, 10),
  );
  return <time dateTime={d.toISOString()} title={d.toISOString()}>{text}</time>;
}

export function relativeTime(d: Date, now = Date.now()): string {
  const s = Math.round((now - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const units: [number, string][] = [[60, "minute"], [3600, "hour"], [86400, "day"], [604800, "week"], [2592000, "month"], [31536000, "year"]];
  let unit = units[0];
  for (const u of units) if (s >= u[0]) unit = u;
  const n = Math.floor(s / unit[0]);
  return `${n} ${unit[1]}${n === 1 ? "" : "s"} ago`;
}
