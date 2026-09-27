import { classifyWithJev } from "@/lib/jev/client";
import { mockClassify } from "@/lib/jev/mock";
import { INTENT_KEYS, type IntentResult } from "@/lib/jev/types";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";

/**
 * ?compare=1 — run the same text through all three classifiers side by side.
 *
 * regex and Jev work anywhere. The general-LLM column needs an
 * OpenAI-compatible endpoint, which is usually a local one (codex-router on
 * 127.0.0.1) and therefore only available when this app runs on your machine.
 * It reports why it is unavailable rather than silently dropping a column.
 */

/** Workers AI model ids are namespaced; the bare name returns 5007. */
/**
 * The 1B model is too small to hold the output format - it echoes the prompt
 * or returns the object of the sentence instead of a card name. The 3B holds
 * it reliably and is still cheap (and, in practice, no slower). It's a demo
 * column, not the product, so cost is not the constraint - fairness is.
 */
const DEFAULT_LLM_MODEL = "@cf/meta/llama-3.2-3b-instruct";

/** The `AI` binding declared in wrangler.jsonc. */
type AiBinding = {
  run: (model: string, input: unknown, options?: unknown) => Promise<unknown>;
};

/**
 * Workers AI shapes text-model output differently per model family: some return
 * a bare string, some a content array, and some nest the answer under
 * `choices[0].message.content` like an OpenAI chat response. Normalise all of
 * them, otherwise a perfectly good answer is read as empty.
 */
function normaliseResponse(response: unknown): string {
  if (typeof response === "string") return response;
  // When Workers AI can parse the model's output it hands back an object. The
   // model DID answer; returning "{}" here would silently discard it.
  if (response && typeof response === "object" && !Array.isArray(response)) {
    return JSON.stringify(response);
  }
  if (Array.isArray(response)) {
    return response
      .map((part) =>
        typeof part === "string" ? part : ((part as { text?: unknown })?.text ?? ""),
      )
      .join("");
  }
  if (response && typeof response === "object" && "text" in response) {
    return String((response as { text: unknown }).text);
  }
  const choices = (response as { choices?: unknown } | null)?.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as { message?: { content?: unknown }; text?: unknown };
    if (typeof first?.message?.content === "string") return first.message.content;
    if (typeof first?.text === "string") return first.text;
  }
  return "{}";
}

/**
 * Next validates route handlers against `{ params }` only, so the context
 * argument can't be widened to carry `env`. OpenNext exposes the bindings
 * through its async context instead.
 */
function getAi(): AiBinding | undefined {
  try {
    // OpenNext's CloudflareEnv only lists its own bindings; `AI` is ours.
    const env = getCloudflareContext().env as { AI?: AiBinding };
    return env.AI;
  } catch {
    return undefined;
  }
}

type Column = {
  label: string;
  intent: string | null;
  /** False when the model returned prose instead of one of the card names. */
  isCard: boolean;
  confidence: number | null;
  ms: number;
  note?: string;
  raw?: string;
};

type JevOutcome =
  | { ok: true; value: IntentResult }
  | { ok: false; error: string };

async function runLlm(text: string, signal: AbortSignal, ai?: AiBinding, model?: string): Promise<Column> {
  const offline = {
    label: "general LLM",
    intent: null,
    isCard: false,
    confidence: null,
    ms: 0,
    note: "AI binding unavailable (running locally?)",
  } satisfies Column;
  if (!ai) return offline;
  const modelId = model || DEFAULT_LLM_MODEL;

  const started = performance.now();
  try {
    const res = (await ai.run(
      modelId,
      {
        messages: [
          {
            role: "system",
            content:
              "Classify what UI card this text should become.\n" +
              `Reply ONLY with JSON: {"intent": one of [${INTENT_KEYS.join(", ")}], "confidence": number between 0 and 1}.\n` +
              "Use exactly one of those words for intent. No other text.",
          },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 64,
      },
      { signal },
    )) as { response?: unknown };

    // Text models return a string; some newer ones return a content array.
    const raw = normaliseResponse(res?.response);
    if (process.env.COMPARE_DEBUG) console.log("[shape]", JSON.stringify(res).slice(0, 700));
    const match = raw.match(/\{[\s\S]*\}/);
    let intent: string | undefined;
    let confidence: number | undefined;
    try {
      const parsed = JSON.parse(match?.[0] ?? raw) as { intent?: string; confidence?: number };
      intent = parsed.intent;
      confidence = typeof parsed.confidence === "number" ? parsed.confidence : undefined;
    } catch {
      // Small models often answer in prose. Show a short excerpt so the column
      // still says something, but mark it as prose rather than a label.
      const prose = raw.trim().replace(/\s+/g, " ").slice(0, 48);
      intent = prose && prose !== text.trim() ? prose : undefined;
    }
    // Small models often echo the prompt instead of classifying it. That isn't
    // a wrong answer, it's no answer at all, so don't dress it up as one.
    const echoed = typeof intent === "string" && intent.trim().toLowerCase() === text.trim().toLowerCase();
    if (echoed) intent = undefined;

    // Snap a near-miss onto a real card name so the three columns line up.
    const known = intent?.toLowerCase().trim();
    const snapped = known ? INTENT_KEYS.find((k) => k === known) : undefined;
    return {
      label: "general LLM",
      intent: snapped ?? intent ?? null,
      isCard: Boolean(snapped),
      confidence: confidence ?? null,
      ms: Math.round(performance.now() - started),
      note: echoed
        ? `Workers AI · ${modelId} · echoed the prompt back instead of answering`
        : `Workers AI · ${modelId}`,
      raw: raw.slice(0, 200),
    };
  } catch (err) {
    return {
      label: "general LLM",
      intent: null,
      isCard: false,
      confidence: null,
      ms: Math.round(performance.now() - started),
      note: `unavailable: ${err instanceof Error ? err.message : "error"}`,
    };
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: string; model?: string } | null;
  const text = body?.text ?? "";
  if (!text.trim()) return Response.json({ error: "Expected { text: string }" }, { status: 400 });

  const [jev, llm] = await Promise.all([
    classifyWithJev(text, request.signal)
      .then((value): JevOutcome => ({ ok: true, value }))
      .catch((err: unknown): JevOutcome => ({
        ok: false,
        error: err instanceof Error ? err.message : "failed",
      })),
    runLlm(text, request.signal, getAi(), body?.model),
  ]);

  const regex = mockClassify(text);

  return Response.json({
    columns: [
      {
        label: "regex",
        intent: regex.intent.value,
        isCard: true,
        confidence: regex.intent.confidence,
        ms: 0,
        note: "offline keyword classifier",
      } as Column,
      {
        label: "jev",
        intent: jev.ok ? jev.value.intent.value : null,
        isCard: jev.ok,
        confidence: jev.ok ? jev.value.intent.confidence : null,
        ms: jev.ok ? jev.value.latencyMs : 0,
        note: jev.ok ? `${jev.value.questionCount} questions, one call` : `failed: ${jev.error}`,
      } as Column,
      llm,
    ],
  });
}
