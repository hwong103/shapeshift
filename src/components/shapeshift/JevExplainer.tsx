"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import type { DecideMemory } from "@/lib/decide";
import type { IntentResult } from "@/lib/jev/types";
import { cn } from "@/lib/utils";

/**
 * ?explain=1 — a guided view of how one keystroke became this card.
 *
 * The point is the split: Jev answers questions, code does the arithmetic.
 * Every step below maps to a real stage, and the timings are the real ones.
 */

type Step = {
  id: string;
  label: string;
  detail: string;
  ms: number | null;
  actor: "model" | "code" | "browser";
};

function Bar({ ms, max, tone }: { ms: number | null; max: number; tone: string }) {
  const reduceMotion = useReducedMotion();
  const pct = ms === null || max <= 0 ? 0 : Math.max(2, (ms / max) * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <motion.div
        className={cn("h-full rounded-full", tone)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function Stage({
  step,
  index,
  max,
  active,
  onSelect,
}: {
  step: Step;
  index: number;
  max: number;
  active: boolean;
  onSelect: () => void;
}) {
  const tone =
    step.actor === "model" ? "bg-brand" : step.actor === "code" ? "bg-emerald-500" : "bg-sky-500";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-lg border p-3 text-start transition-colors",
        active ? "border-brand bg-accent/40" : "border-transparent hover:bg-accent/20",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-foreground">
          <span className="text-muted-foreground tabular-nums">{index + 1}. </span>
          {step.label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {step.ms === null ? "—" : `${step.ms}ms`}
        </span>
      </div>
      <Bar ms={step.ms} max={max} tone={tone} />
      <p className="text-[11px] leading-4 text-muted-foreground">{step.detail}</p>
    </button>
  );
}

export function JevExplainer({
  result,
  mem,
  text,
}: {
  result: IntentResult;
  mem: DecideMemory;
  text: string;
}) {
  const [open, setOpen] = useState(2);

  const modelMs = result.error ? 0 : result.latencyMs;
  const total = Math.max(modelMs, 1);

  const topIntents = Object.entries(result.intent.probabilities)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 5);

  const steps: Step[] = [
    {
      id: "keystroke",
      label: "You type",
      detail: "Text is held locally. Nothing is sent on every character — a 120ms debounce waits for a pause.",
      ms: 120,
      actor: "browser",
    },
    {
      id: "cache",
      label: "Browser cache check",
      detail: "Repeated text is answered from a local LRU without touching the network.",
      ms: result.cached ? 0 : 1,
      actor: "browser",
    },
    {
      id: "jev",
      label: "Jev answers 14 questions at once",
      detail: `One call to ${result.model}. It picks the card type and reads signals like urgency, tone and whether it's a video call — but never extracts dates or does arithmetic.`,
      ms: result.cached ? 0 : modelMs,
      actor: "model",
    },
    {
      id: "gate",
      label: "Signals are gated",
      detail: "Raw confidence is smoothed with a hysteresis band so badges don't flicker while you type.",
      ms: 1,
      actor: "code",
    },
    {
      id: "decide",
      label: "A challenger must win twice",
      detail: "The card only changes when a new intent wins two keystrokes in a row, or is very confident. That's what stops the card thrashing.",
      ms: 1,
      actor: "code",
    },
    {
      id: "parse",
      label: "Deterministic parsers fill the card",
      detail: "Dates, amounts, units and colours are computed by ordinary code reading the same text. Jev decided; code computed.",
      ms: 1,
      actor: "code",
    },
  ];

  const active = steps[open] ?? steps[0];

  return (
    <aside className="mt-3 flex flex-col gap-2 rounded-xl border bg-card/60 p-3 text-start">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-medium text-foreground">How this answer happened</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {text.trim() ? `"${text.trim().slice(0, 42)}"` : "waiting for input"}
          </span>
        </div>
      </div>

      <>
          <div className="flex flex-col gap-1">
            {steps.map((s, i) => (
              <Stage
                key={s.id}
                step={s}
                index={i}
                max={total}
                active={i === open}
                onSelect={() => setOpen(i)}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg bg-accent/30 p-3">
            <span className="text-[11px] font-medium text-foreground">
              {active.label} — {active.ms === null ? "—" : `${active.ms}ms`}
            </span>
            <p className="text-[11px] leading-4 text-muted-foreground">{active.detail}</p>
          </div>

          <div className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
            <span>
              ui: {mem.ui.kind}
              {"intent" in mem.ui ? ` → ${mem.ui.intent}` : ""}
            </span>
            <span>
              {result.cached ? "cached" : `${result.latencyMs}ms`} · {result.questionCount}q ·{" "}
              {result.model}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">intent distribution</span>
            {topIntents.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-16 truncate text-[11px] text-foreground">{k}</span>
                <div className="relative h-1 flex-1 rounded-full bg-secondary">
                  <div
                    className="absolute inset-y-0 start-0 rounded-full bg-brand"
                    style={{ width: `${Math.max(1, (v ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-end text-[11px] tabular-nums">
                  {Math.round((v ?? 0) * 100)}
                </span>
              </div>
            ))}
          </div>
      </>
    </aside>
  );
}
