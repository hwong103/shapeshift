"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import type { DecideMemory } from "@/lib/decide";
import type { Answer, IntentResult } from "@/lib/jev/types";
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

function SignalRow({ label, text }: { label: string; text: string }) {
  return (
    <>
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
      <span className="text-end text-[11px] tabular-nums text-foreground">{text}</span>
    </>
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
  bare = false,
}: {
  result: IntentResult;
  mem: DecideMemory;
  text: string;
  /** True when a parent already provides the card frame. */
  bare?: boolean;
}) {
  const [open, setOpen] = useState(2);

  const modelMs = result.error ? 0 : result.latencyMs;
  const total = Math.max(modelMs, 1);

  const topIntents = Object.entries(result.intent.probabilities)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 5);

  // The other 13 answers from the same call. Nouls (is this a question?) and
  // scores (how urgent?) arrive as plain numbers; the choice questions carry a
 // full probability spread, which is where the useful detail lives.
  const nouls: [string, number][] = [
    ["is it a question?", result.signals.isQuestion],
    ["does it repeat?", result.signals.recurring],
    ["are there choices?", result.signals.hasExplicitOptions],
    ["is it a shopping list?", result.signals.isShoppingList],
  ];
  const choices: [string, Answer<string>][] = [
    ["mood", result.signals.tone],
    ["in person or online?", result.signals.eventMode],
    ["how?", result.signals.transport],
    ["kind of trip?", result.signals.tripType],
    ["what kind of cost?", result.signals.expenseCategory],
    ["what colour?", result.signals.colorMood],
    ["counting up or down?", result.signals.timerKind],
  ];

  const steps: Step[] = [
    {
      id: "keystroke",
      label: "You type",
      detail: "Nothing happens yet. The app waits 120ms after you stop typing, so it doesn't ask about half-words.",
      ms: 120,
      actor: "browser",
    },
    {
      id: "cache",
      label: "Seen this before?",
      detail: "If you typed this exact thing earlier, the answer is already saved on your device. No asking needed.",
      ms: result.cached ? 0 : 1,
      actor: "browser",
    },
    {
      id: "jev",
      label: "Jev reads it",
      detail: `One quick trip to ${result.model}. Jev only decides WHICH card to show. It never works out dates or does sums.`,
      ms: result.cached ? 0 : modelMs,
      actor: "model",
    },
    {
      id: "gate",
      label: "Calm things down",
      detail: "Jev's answer gets smoothed out, so little tags don't flicker on and off while you type.",
      ms: 1,
      actor: "code",
    },
    {
      id: "decide",
      label: "Wait, are you sure?",
      detail: "A different card has to win TWICE in a row before the screen changes. That's what stops it jumping around.",
      ms: 1,
      actor: "code",
    },
    {
      id: "parse",
      label: "Fill in the card",
      detail: "Ordinary computer code works out the details, like what \"8pm\" means. Jev picks the card; the code fills it in.",
      ms: 1,
      actor: "code",
    },
  ];

  const active = steps[open] ?? steps[0];

  return (
    <aside className={cn(bare ? "flex flex-col gap-2 text-start" : "mt-3 flex flex-col gap-2 rounded-xl border bg-card/60 p-3 text-start")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-medium text-foreground">What happened just now</span>
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
            <span className="text-[11px] text-muted-foreground">how sure each card is</span>
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

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              other things Jev noticed
            </span>

            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <span className="text-[11px] text-muted-foreground">readiness</span>
              <span className="text-end text-[11px] tabular-nums text-foreground">
                {result.readiness.toFixed(2)}
              </span>

              <span className="text-[11px] text-muted-foreground">urgency</span>
              <span className="text-end text-[11px] tabular-nums text-foreground">
                {result.signals.urgency.score.toFixed(2)}{" "}
                <span className="text-muted-foreground">
                  ±{result.signals.urgency.confidence.toFixed(2)}
                </span>
              </span>

              {nouls.map(([label, v]) => (
                <SignalRow key={label} label={label} text={v.toFixed(2)} />
              ))}

              {choices.map(([label, a]) => (
                <SignalRow key={label} label={label} text={`${a.value} ${a.confidence.toFixed(2)}`} />
              ))}
            </div>
          </div>
      </>
    </aside>
  );
}
