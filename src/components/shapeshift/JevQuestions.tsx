"use client";

import { useState } from "react";

import type { Answer, IntentResult } from "@/lib/jev/types";
import { cn } from "@/lib/utils";

type Q = {
  key: string;
  ask: string;
  kind: "choice" | "yes/no" | "scale";
  choices?: string[];
};

const QUESTIONS: Q[] = [
  {
    key: "intent",
    kind: "choice",
    ask: "What is the person trying to create with this text?",
    choices: ["event", "reminder", "todo", "timer", "habit", "color", "split", "expense", "convert", "calc", "travel", "poll", "contact", "link", "countdown", "timezone", "random", "goal", "note", "none"],
  },
  { key: "readiness", kind: "scale", ask: "How complete is this input for what the person is creating?", choices: ["just started", "partly there", "ready to go"] },
  { key: "isQuestion", kind: "yes/no", ask: "Is this a question rather than a statement?" },
  { key: "recurring", kind: "yes/no", ask: "Does this repeat on a schedule?" },
  { key: "urgency", kind: "scale", ask: "How urgent does this feel?", choices: ["not urgent", "somewhat", "urgent"] },
  { key: "tone", kind: "choice", ask: "What is the mood of the text?", choices: ["neutral", "positive", "excited", "stressed", "reflective"] },
  { key: "eventMode", kind: "choice", ask: "How would the meeting happen?", choices: ["in person", "video call", "phone call", "not said"] },
  { key: "transport", kind: "choice", ask: "How would they travel?", choices: ["plane", "train", "bus", "car", "not said"] },
  { key: "tripType", kind: "choice", ask: "What is the trip for?", choices: ["work", "holiday", "not said"] },
  { key: "expenseCategory", kind: "choice", ask: "What was the money spent on?", choices: ["food", "getting around", "shopping", "bills", "fun", "health", "other"] },
  { key: "colorMood", kind: "choice", ask: "What is the feel of the colour?", choices: ["warm", "cool", "plain", "bright", "soft", "dark"] },
  { key: "timerKind", kind: "choice", ask: "What kind of timer?", choices: ["countdown", "focus", "break", "stopwatch"] },
  { key: "hasExplicitOptions", kind: "yes/no", ask: "Are two or more options named?" },
  { key: "isShoppingList", kind: "yes/no", ask: "Is this a list of things to buy?" },
];

type Answered = { text: string; confidence: number | null; probs: [string, number][] };

function answerFor(q: Q, r: IntentResult): Answered {
  const s = r.signals;
  const fromChoice = (a: Answer<string>, show: (k: string) => string): Answered => ({
    text: show(a.value),
    confidence: a.confidence,
    probs: Object.entries(a.probabilities)
      .sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0))
      .slice(0, 4)
      .map(([k, v]) => [show(k), v ?? 0] as [string, number]),
  });
  const yesNo = (n: number): Answered => ({ text: n > 0.5 ? "yes" : "no", confidence: n, probs: [] });

  switch (q.key) {
    case "intent": return fromChoice(r.intent, (k) => k);
    case "readiness": return { text: q.choices?.[Math.round(r.readiness)] ?? r.readiness.toFixed(2), confidence: null, probs: [] };
    case "isQuestion": return yesNo(s.isQuestion);
    case "recurring": return yesNo(s.recurring);
    case "urgency":
      return {
        text: s.urgency.score > 1.2 ? "urgent" : s.urgency.score > 0.5 ? "somewhat" : "not urgent",
        confidence: s.urgency.confidence,
        probs: [],
      };
    case "tone": return fromChoice(s.tone, (k) => k);
    case "eventMode": return fromChoice(s.eventMode, (k) => ({ in_person: "in person", video_call: "video call", phone_call: "phone call", unspecified: "not said" })[k] ?? k);
    case "transport": return fromChoice(s.transport, (k) => (k === "unspecified" ? "not said" : k));
    case "tripType": return fromChoice(s.tripType, (k) => ({ unspecified: "not said", leisure: "holiday" })[k] ?? k);
    case "expenseCategory": return fromChoice(s.expenseCategory, (k) => ({ transport: "getting around", entertainment: "fun" })[k] ?? k);
    case "colorMood": return fromChoice(s.colorMood, (k) => (k === "neutral" ? "plain" : k));
    case "timerKind": return fromChoice(s.timerKind, (k) => k);
    case "hasExplicitOptions": return yesNo(s.hasExplicitOptions);
    case "isShoppingList": return yesNo(s.isShoppingList);
    default: return { text: "-", confidence: null, probs: [] };
  }
}

const KIND_LABEL: Record<Q["kind"], string> = {
  choice: "pick one",
  "yes/no": "yes or no",
  scale: "how much",
};

export function JevQuestions({ result }: { result: IntentResult }) {
  const [open, setOpen] = useState<string | null>("intent");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">The {QUESTIONS.length} questions</span>
        <span className="text-[11px] leading-4 text-muted-foreground">
          All asked at once, in a single trip to {result.model}. Tap one to see every option it weighed.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {QUESTIONS.map((q, i) => {
          const a = answerFor(q, result);
          const expanded = open === q.key;
          return (
            <button
              key={q.key}
              type="button"
              onClick={() => setOpen(expanded ? null : q.key)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-2 text-start transition-colors",
                expanded ? "border-brand/40 bg-accent/30" : "border-transparent hover:bg-accent/20",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] leading-4 text-foreground">
                  <span className="text-muted-foreground tabular-nums">{i + 1}. </span>
                  {q.ask}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {a.text}
                  {a.confidence !== null && <span className="text-foreground"> {a.confidence.toFixed(2)}</span>}
                </span>
              </div>

              <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full",
                    a.confidence === null ? "bg-muted-foreground" : a.confidence > 0.85 ? "bg-brand" : "bg-brand/50",
                  )}
                  style={{ width: `${Math.max(2, (a.confidence ?? 0.5) * 100)}%` }}
                />
              </div>

              {expanded && (
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    kind: {KIND_LABEL[q.kind]}
                    {q.choices?.length ? ` · ${q.choices.length} options` : ""}
                  </span>
                  {a.probs.length > 1 ? (
                    a.probs.map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="w-16 truncate text-[10px] text-muted-foreground">{k}</span>
                        <div className="relative h-1 flex-1 rounded-full bg-secondary">
                          <div
                            className="absolute inset-y-0 start-0 rounded-full bg-brand/70"
                            style={{ width: `${Math.max(1, v * 100)}%` }}
                          />
                        </div>
                        <span className="w-7 text-end text-[10px] tabular-nums text-muted-foreground">
                          {Math.round(v * 100)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {q.choices?.length ? `Options: ${q.choices.join(", ")}` : "This one is a single number."}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-4 text-muted-foreground">
        Jev answers every question every time, even for a shopping list. Most go unused - the code only reads the
        ones that matter for the card it chose.
      </p>
    </div>
  );
}
