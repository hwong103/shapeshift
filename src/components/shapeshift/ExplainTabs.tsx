"use client";

import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DecideMemory } from "@/lib/decide";
import type { IntentResult } from "@/lib/jev/types";

import { CompareColumns } from "./CompareColumns";
import { JevExplainer } from "./JevExplainer";
import { JevQuestions } from "./JevQuestions";
import { WhyJev } from "./WhyJev";

const TABS = [
  { id: "now", label: "What happened" },
  { id: "questions", label: "The questions" },
  { id: "compare", label: "Three ways" },
  { id: "rule", label: "When rules fail" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * The three explainer sections stacked into one panel, because reading all of
 * them at once meant a lot of scrolling past content you didn't need yet.
 */
export function ExplainTabs({ result, mem, text }: { result: IntentResult; mem: DecideMemory; text: string }) {
  const [tab, setTab] = useState<TabId>("now");

  return (
    <section className="mt-3 flex flex-col gap-2">
      <ToggleGroup
        type="single"
        value={tab}
        onValueChange={(v) => {
          if (v) setTab(v as TabId);
        }}
        variant="outline"
        size="sm"
        spacing={0}
        className="w-full"
        aria-label="Explainer sections"
      >
        {TABS.map((t) => (
          <ToggleGroupItem key={t.id} value={t.id} className="flex-1 justify-center text-[12px]">
            {t.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="rounded-xl border bg-card/60 p-3">
        {tab === "now" && <JevExplainer result={result} mem={mem} text={text} bare />}
        {tab === "questions" && <JevQuestions result={result} />}
        {tab === "compare" && <CompareColumns text={text} bare />}
        {tab === "rule" && <WhyJev bare />}
      </div>
    </section>
  );
}
