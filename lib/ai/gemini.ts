/**
 * Minimal Gemini client (generateContent over fetch). Server-side only: the API
 * key comes from GEMINI_API_KEY and must never reach the browser.
 *
 * Gemini only ever PARSES text into JSON or REPHRASES text. Anything it returns
 * is treated as untrusted input and validated by the caller.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Temporary server-side errors worth retrying, and how long to wait before each retry. */
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const RETRY_DELAYS_MS = [800, 2000];

export type GeminiErrorCode = "not_configured" | "timeout" | "network" | "http" | "blocked" | "empty";

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; code: GeminiErrorCode; message: string; status?: number };

export type GeminiRequest = {
  system: string;
  prompt: string;
  /** JSON Schema for the reply. When set, the reply is JSON matching it. */
  jsonSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
  timeoutMs?: number;
  // Injectable for tests:
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

export async function callGemini(req: GeminiRequest): Promise<GeminiResult> {
  const apiKey = req.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, code: "not_configured", message: "GEMINI_API_KEY is not set." };

  const model = req.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const doFetch = req.fetchImpl ?? fetch;

  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: "user", parts: [{ text: req.prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: req.maxOutputTokens ?? 2048,
      ...(req.jsonSchema
        ? { responseMimeType: "application/json", responseJsonSchema: req.jsonSchema }
        : {}),
    },
  };

  const sleep = req.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let response: Response | undefined;
  let data: GeminiResponse = {};
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      response = await doFetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        // The key goes in a header, never in the URL, so it can't leak into logs.
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(req.timeoutMs ?? 20_000),
      });
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      return {
        ok: false,
        code: timedOut ? "timeout" : "network",
        message: timedOut ? "Gemini took too long to answer." : "Couldn't reach Gemini.",
      };
    }

    data = {};
    try {
      data = (await response.json()) as GeminiResponse;
    } catch {
      // Non-JSON body: handled below via the status code.
    }

    // "Model overloaded" and similar blips are usually gone in a second or two.
    if (RETRYABLE_STATUS.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
    const status = response?.status;
    // Log the status and Google's error text (never the prompt or the key).
    console.error(`Gemini HTTP ${status}: ${data.error?.message ?? "no message"}`);
    return { ok: false, code: "http", status, message: `Gemini returned an error (${status}).` };
  }

  if (data.promptFeedback?.blockReason) {
    return { ok: false, code: "blocked", message: "Gemini declined to process that." };
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();

  if (!text) return { ok: false, code: "empty", message: "Gemini sent back nothing." };
  return { ok: true, text };
}
