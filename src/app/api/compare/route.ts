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
/** Cheapest useful text model on Workers AI - it's a demo column, not the product. */
const DEFAULT_LLM_MODEL = "@cf/meta/llama-3.2-1b-instruct";

/** The `AI` binding declared in wrangler.jsonc. */
type AiBinding = {
  run: (model: string, input: unknown, options?: unknown) => Promise<unknown>;
};

/** Workers AI returns a string from text models, but some return a content array. */
function normaliseResponse(response: unknown): string {
  if (typeof response === "string") return response;
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
  confidence: number | null;
  ms: number;
  note?: string;
};

type JevOutcome =
  | { ok: true; value: IntentResult }
  | { ok: false; error: string };

async function runLlm(text: string, signal: AbortSignal, ai?: AiBinding, model?: string): Promise<Column> {
  const offline = {
    label: "general LLM",
    intent: null,
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
    )) as { response?: string };

    // Text models return a string; some newer ones return a content array.
    const raw = normaliseResponse(res?.response);
    const match = raw.match(/\{[\s\S]*\}/);
    let intent: string | undefined;
    let confidence: number | undefined;
    try {
      const parsed = JSON.parse(match?.[0] ?? raw) as { intent?: string; confidence?: number };
      intent = parsed.intent;
      confidence = typeof parsed.confidence === "number" ? parsed.confidence : undefined;
    } catch {
      // Small models often answer in prose. Falling back to the raw text keeps
      // the column informative instead of blank.
      intent = raw.trim().slice(0, 40) || undefined;
    }
    // Snap a near-miss onto a real card name so the three columns line up.
    const known = intent?.toLowerCase().trim();
    const snapped = known ? INTENT_KEYS.find((k) => k === known) : undefined;
    return {
      label: "general LLM",
      intent: snapped ?? intent ?? "unparsed",
      confidence: confidence ?? null,
      ms: Math.round(performance.now() - started),
      note: `Workers AI · ${modelId}`,
    };
  } catch (err) {
    return {
      label: "general LLM",
      intent: null,
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
        confidence: regex.intent.confidence,
        ms: 0,
        note: "offline keyword classifier",
      } as Column,
      {
        label: "jev",
        intent: jev.ok ? jev.value.intent.value : null,
        confidence: jev.ok ? jev.value.intent.confidence : null,
        ms: jev.ok ? jev.value.latencyMs : 0,
        note: jev.ok ? `${jev.value.questionCount} questions, one call` : `failed: ${jev.error}`,
      } as Column,
      llm,
    ],
  });
}
