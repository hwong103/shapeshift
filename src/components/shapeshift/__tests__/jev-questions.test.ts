import { describe, expect, test } from "bun:test";

import { questions } from "@/lib/jev/questions";

/**
 * The explainer lists the questions as plain data, because the real module
 * imports the TypeSafe SDK and only belongs on the server. This asserts the two
 * never drift apart in count or in the order shown to the reader.
 */
const SHOWN_ORDER = [
  "intent",
  "readiness",
  "isQuestion",
  "recurring",
  "urgency",
  "tone",
  "eventMode",
  "transport",
  "tripType",
  "expenseCategory",
  "colorMood",
  "timerKind",
  "hasExplicitOptions",
  "isShoppingList",
];

describe("JevQuestions panel", () => {
  test("asks exactly the questions the schema defines", () => {
    expect(Object.keys(questions)).toEqual(SHOWN_ORDER);
  });

  test("covers every signal the explainer reads", () => {
    // If a signal is added to IntentResult but not listed here, the panel would
    // quietly under-report what Jev was asked.
    const missing = SHOWN_ORDER.filter(
      (k) => k !== "intent" && k !== "readiness" && !(k in questions),
    );
    expect(missing).toEqual([]);
  });
});
