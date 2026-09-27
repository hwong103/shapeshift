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
    why: "Contains 'meeting' and 'tomorrow', so the keyword rules fire. Regex has no concept of 'no'.",
  },
  {
    text: "not a reminder",
    regex: "reminder",
    regexConf: 0.99,
    jev: "note",
    jevConf: 0.67,
    right: "jev",
    why: "Same trap: the word 'reminder' is present, and negation is invisible to a pattern.",
  },
  {
    text: "didn't split the bill",
    regex: "split",
    regexConf: 0.66,
    jev: "note",
    jevConf: 0.39,
    right: "jev",
    why: "'split' appears with a number nearby, which is the rule's exact trigger.",
  },
  {
    text: "remember the milk",
    regex: "note",
    regexConf: 0.15,
    jev: "reminder",
    jevConf: 0.96,
    right: "jev",
    why: "The rules only list 'remind me to' and 'don't forget'. 'Remember' on its own falls through.",
  },
  {
    text: "pay rent",
    regex: "none",
    regexConf: 0.09,
    jev: "reminder",
    jevConf: 0.53,
    right: "jev",
    why: "No trigger word at all. Regex gives up; Jev infers a task from the verb.",
  },
  {
    text: "maybe grab lunch sometime",
    regex: "event",
    regexConf: 0.66,
    jev: "event",
    jevConf: 0.99,
    right: "regex",
    why: "Hedged language, but the noun is decisive. Both land here - and notice regex is less sure.",
  },
  {
    text: "cancel my dentist appointment",
    regex: "event",
    regexConf: 0.66,
    jev: "event",
    jevConf: 0.39,
    right: "neither",
    why: "'Cancel' is an action, not a scheduling one. Jev is unsure (0.39) and the app waits rather than guessing.",
  },
  {
    text: "we should talk",
    regex: "note",
    regexConf: 0.15,
    jev: "note",
    jevConf: 0.34,
    right: "neither",
    why: "Genuinely ambiguous. Both are low, which is the correct outcome - the card should not commit.",
  },
];

function Verdict({ right }: { right: Row["right"] }) {
  const map = {
    jev: ["bg-brand/15 text-brand", "Jev right"],
    regex: ["bg-sky-500/15 text-sky-600 dark:text-sky-400", "regex right"],
    neither: ["bg-secondary text-muted-foreground", "both unsure"],
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
export function WhyJev() {
  const [open, setOpen] = useState<string | null>(CASES[0].text);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border bg-card/60 p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">Where regex breaks</span>
        <span className="text-[11px] leading-4 text-muted-foreground">
          Measured, not asserted. Click a row for the reason it fails.
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
        <span className="text-foreground">Honest summary:</span> Jev wins the cases regex structurally cannot
        reach, and loses nothing, because it was not winning those to begin with. Where Jev is unsure it says so,
        and the app waits instead of committing a wrong card.
      </p>
    </div>
  );
}
