/** Browser-side CSV download helper. */
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((v) => (typeof v === "number" ? String(v) : `"${String(v).replace(/"/g, '""')}"`)).join(","))
    .join("\n");
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
