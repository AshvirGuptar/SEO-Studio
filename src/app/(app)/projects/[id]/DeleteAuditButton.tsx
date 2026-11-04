"use client";

import { useRouter } from "next/navigation";

export function DeleteAuditButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="text-xs text-subtle hover:text-fail"
      onClick={async () => {
        if (!confirm("Delete this saved audit?")) return;
        const r = await fetch(`/api/audits/${id}`, { method: "DELETE" });
        if (r.ok) router.refresh();
        else alert((await r.json()).error ?? "Couldn't delete.");
      }}
    >
      Delete
    </button>
  );
}
