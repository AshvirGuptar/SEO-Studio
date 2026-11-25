/** Page math for long lists (pure). Pages are 1-based; out-of-range input is clamped. */
export function paginate(total: number, rawPage: unknown, size: number): { page: number; pages: number; start: number; end: number } {
  const pages = Math.max(1, Math.ceil(total / size));
  const n = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage);
  const page = Number.isInteger(n) ? Math.min(Math.max(n, 1), pages) : 1;
  const start = (page - 1) * size;
  return { page, pages, start, end: Math.min(start + size, total) };
}
