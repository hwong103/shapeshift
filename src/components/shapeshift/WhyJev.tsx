"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type Row = {
  text: string;
  regex: string;
  regexConf: number;
  jev: string;
  jevConf: number;
  right: "jev" | "regex" | "neither";
  why: string;
};

const CASES: Row[] = [
  {
    text: "no meeting tomorrow",
    regex: "event",
    regexConf: 0.98,
    jev: "note",
    jevConf: 0.9,
    right: "jev",
    why: "It has the words 'meeting' and 'tomorrow', so the rule jumps in. The rule can't see that the 'no' changes everything.",
  },
  {
    text: "not a reminder",
    regex: "reminder",
    regexConf: 0.99,
    jev: "note",
    jevConf: 0.67,
    right: "jev",
    why: "Same trap. The word 'reminder' is right there, but the rule can't tell you actually don't want one.",
  },
  {
    text: "didn't split the bill",
    regex: "split",
    regexConf: 0.66,
    jev: "note",
    jevConf: 0.39,
    right: "jev",
    why: "The rule looks for 'split' near a number. This has both, so it fires — even though you didn't split anything.",
  },
  {
    text: "remember the milk",
    regex: "note",
    regexConf: 0.15,
    jev: "reminder",
    jevConf: 0.96,
    right: "jev",
    why: "The rule only knows the phrase 'remind me to'. You said 'remember', so nothing matched and it gave up.",
  },
  {
    text: "pay rent",
    regex: "none",
    regexConf: 0.09,
    jev: "reminder",
    jevConf: 0.53,
    right: "jev",
    why: "There are no special words here at all. Jev worked out that 'pay' means it's a job to remember.",
  },
  {
    text: "maybe grab lunch sometime",
    regex: "event",
    regexConf: 0.66,
    jev: "event",
    jevConf: 0.99,
    right: "regex",
    why: "Both got it right! But look at the bars — Jev is much more sure, and regex isn't.",
  },
  {
    text: "cancel my dentist appointment",
    regex: "event",
    regexConf: 0.66,
    jev: "event",
    jevConf: 0.39,
    right: "neither",
    why: "Tricky one. 'Cancel' is an action, not a plan. Jev isn't sure, so the app waits instead of showing a card.",
  },
  {
    text: "we should talk",
    regex: "note",
    regexConf: 0.15,
    jev: "note",
    jevConf: 0.34,
    right: "neither",
    why: "This one's genuinely unclear. Both are unsure, and that's the right answer — better to wait than show the wrong card.",
  },
];

function Verdict({ right }: { right: Row["right"] }) {
  const map = {
    jev: ["bg-brand/15 text-brand", "Jev was right"],
    regex: ["bg-sky-500/15 text-sky-600 dark:text-sky-400", "the rule was right"],
    neither: ["bg-secondary text-muted-foreground", "neither is sure"],
  } as const;
  const [cls, label] = map[right];
  return <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium", cls)}>{label}</span>;
}

function ConfidenceBar({ value, tone }: { value: number; tone: "sky" | "brand" }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={cn("h-full rounded-full", tone === "sky" ? "bg-sky-500" : "bg-brand")}
        style={{ width: `${Math.max(2, value * 100)}%` }}
      />
    </div>
  );
}

/**
 * ?why=1 - the case for the model, shown as measured cases rather than claims.
 *
 * The offline classifier is genuinely good. It also fails in one specific,
 * unfixable way: it cannot see negation, and it cannot infer a task from a verb
 * it was never taught. Every row below is a real recorded result.
 */
export function WhyJev({ bare = false }: { bare?: boolean }) {
  const [open, setOpen] = useState<string | null>(CASES[0].text);

  return (
    <div className={cn(bare ? "flex flex-col gap-2" : "mt-3 flex flex-col gap-2 rounded-xl border bg-card/60 p-3")}>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">When the simple rule gets it wrong</span>
        <span className="text-[11px] leading-4 text-muted-foreground">
          Two ways of reading your words. These are real results — tap any line to see why.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {CASES.map((row) => {
          const expanded = open === row.text;
          return (
            <button
              key={row.text}
              type="button"
              onClick={() => setOpen(expanded ? null : row.text)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-2 text-start transition-colors",
                expanded ? "border-brand/40 bg-accent/30" : "border-transparent hover:bg-accent/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <code className="truncate font-mono text-[11px] text-foreground">&quot;{row.text}&quot;</code>
                <Verdict right={row.right} />
              </div>

              <div className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-x-2 gap-y-1">
                <span className="text-[10px] text-muted-foreground">regex</span>
                <ConfidenceBar value={row.regexConf} tone="sky" />
                <span
                  className={cn(
                    "w-16 truncate text-end font-mono text-[10px] tabular-nums",
                    row.right === "regex" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {row.regex} {row.regexConf.toFixed(2)}
                </span>

                <span className="text-[10px] text-muted-foreground">jev</span>
                <ConfidenceBar value={row.jevConf} tone="brand" />
                <span
                  className={cn(
                    "w-16 truncate text-end font-mono text-[10px] tabular-nums",
                    row.right === "jev" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {row.jev} {row.jevConf.toFixed(2)}
                </span>
              </div>

              {expanded && <p className="pt-0.5 text-[11px] leading-4 text-muted-foreground">{row.why}</p>}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-4 text-muted-foreground">
        <span className="text-foreground">The short version:</span> the simple rule only knows the exact words it was
        given. Jev understands what you mean. And when Jev is unsure too, the app waits instead of showing you
        the wrong card.
      </p>
    </div>
  );
}
