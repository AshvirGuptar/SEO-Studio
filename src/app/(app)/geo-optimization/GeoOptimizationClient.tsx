"use client";

import { useState } from "react";
import { StartOverButton } from "@/components/ResultActions";
import { Crown } from "@/components/Crown";
import { AnswerFirstPanel } from "./AnswerFirstPanel";
import { FaqPanel } from "./FaqPanel";
import { SchemaPanel } from "./SchemaPanel";
import { AccessKitPanel } from "./AccessKitPanel";
import type { AiAccess } from "./ui";

const TABS = [
  { id: "answer", label: "Answer-first rewrite", ai: true },
  { id: "faq", label: "FAQ", ai: true },
  { id: "schema", label: "Schema", ai: false },
  { id: "access", label: "AI access kit", ai: false },
] as const;
type Tab = (typeof TABS)[number]["id"];

/**
 * GEO Optimization: fixes what the GEO score flags. The rewrite and FAQ generator use Claude
 * (Premium); the schema builder and AI access kit are rule-based and work for everyone.
 * Panels stay mounted while hidden so switching tabs keeps their work; Start over remounts them.
 */
export function GeoOptimizationClient({ ai }: { ai: AiAccess }) {
  const [tab, setTab] = useState<Tab>("answer");
  const [keyword, setKeyword] = useState("");
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  function startOver() {
    setKeyword(""); setDraft(""); setTouched(false); setTab("answer"); setResetKey((k) => k + 1);
  }

  return (
    <div className="mt-6 space-y-5" onInputCapture={() => setTouched(true)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="GEO Optimization tools">
          {TABS.map((t) => (
            <button key={t.id} role="tab" id={`geo-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`geo-panel-${t.id}`}
              className={`pill gap-1.5 ${tab === t.id ? "pill-on" : "pill-off"}`} onClick={() => setTab(t.id)}>
              {t.ai && <Crown size={12} className={tab === t.id ? "" : "text-premium"} />}{t.label}
            </button>
          ))}
        </div>
        {(touched || draft || keyword) && <div className="ml-auto"><StartOverButton onClick={startOver} /></div>}
      </div>

      <div key={resetKey}>
        <Panel id="answer" tab={tab}>
          <AnswerFirstPanel ai={ai} keyword={keyword} setKeyword={setKeyword} draft={draft} setDraft={setDraft} />
        </Panel>
        <Panel id="faq" tab={tab}><FaqPanel ai={ai} keyword={keyword} draft={draft} setDraft={setDraft} /></Panel>
        <Panel id="schema" tab={tab}><SchemaPanel /></Panel>
        <Panel id="access" tab={tab}><AccessKitPanel /></Panel>
      </div>
    </div>
  );
}

function Panel({ id, tab, children }: { id: Tab; tab: Tab; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`geo-panel-${id}`} aria-labelledby={`geo-tab-${id}`} hidden={tab !== id}>
      {children}
    </div>
  );
}
