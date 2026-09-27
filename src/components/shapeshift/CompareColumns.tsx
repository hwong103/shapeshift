"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Column = {
  label: string;
  intent: string | null;
  isCard: boolean;
  confidence: number | null;
  ms: number;
  note?: string;
};

const ACCENT: Record<string, string> = {
  regex: "bg-sky-500",
  jev: "bg-brand",
  "general LLM": "bg-violet-500",
};

/**
 * The three columns that sit under the explainer. Same input, three ways of
 * reaching an answer — so the differences are visible rather than asserted.
 */
export function CompareColumns({ text }: { text: string }) {
  const [result, setResult] = useState<{ key: string; columns: Column[] } | null>(null);
  const reqId = useRef(0);

  const key = text.trim();

  useEffect(() => {
    if (key.length < 2) return;
    const id = ++reqId.current;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: key }),
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { columns?: Column[] };
        if (id !== reqId.current) return;
        setResult({ key, columns: data.columns ?? [] });
      } catch {
        /* aborted or failed: leave the last good result alone */
      }
    }, 220);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [key]);

  // Don't show a result computed for text the user has since changed.
  if (!result || result.key !== key) return null;
  const columns = result.columns;
  // Only real card names count as an answer. A model that replied with prose
  // hasn't disagreed, it just failed to classify.
  const named = columns.filter((c) => c.intent && c.isCard).map((c) => c.intent);
  const distinct = new Set(named).size;
  const offCard = columns.filter((c) => c.intent && !c.isCard).length;

  return (
    <div className="mt-3 flex flex-col gap-1.5 rounded-xl border bg-card/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground">Three ways to answer</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {offCard > 0
            ? `${offCard} not a card type`
            : distinct === 1
              ? "all agree"
              : `${distinct} distinct answers`}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {columns.map((c) => (
          <div key={c.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-medium text-foreground">{c.label}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {c.intent ? (
                  <>
                    <span className={c.isCard ? "text-foreground" : "text-amber-600 dark:text-amber-400"}>
                      {c.intent}
                    </span>
                    {c.confidence !== null && ` · ${c.confidence.toFixed(2)}`}
                    {c.ms > 0 && ` · ${c.ms}ms`}
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full", ACCENT[c.label] ?? "bg-muted-foreground")}
                style={{ width: `${Math.max(2, (c.confidence ?? 0) * 100)}%` }}
              />
            </div>
            {c.note && <span className="text-[10px] leading-3 text-muted-foreground">{c.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
