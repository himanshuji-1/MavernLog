import { afterEach, describe, expect, it, vi } from "vitest";
import { callGemini } from "../gemini";

const KEY = "test-key-123456";

function mockFetch(body: unknown, init: { status?: number } = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: init.status ?? 200 }));
}

const ok = (text: string) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });

afterEach(() => vi.restoreAllMocks());

describe("callGemini", () => {
  it("is 'not configured' without a key, and makes no request", async () => {
    const fetchImpl = mockFetch(ok("x"));
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const r = await callGemini({ system: "s", prompt: "p", fetchImpl });
    if (original !== undefined) process.env.GEMINI_API_KEY = original;
    expect(r).toMatchObject({ ok: false, code: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns the text of a successful reply", async () => {
    const r = await callGemini({ system: "s", prompt: "p", apiKey: KEY, fetchImpl: mockFetch(ok('{"a":1}')) });
    expect(r).toEqual({ ok: true, text: '{"a":1}' });
  });

  it("sends the key in a header, never in the URL or body", async () => {
    const fetchImpl = mockFetch(ok("hi"));
    await callGemini({
      system: "SYSTEM",
      prompt: "PROMPT",
      jsonSchema: { type: "object" },
      apiKey: KEY,
      model: "some-model",
      fetchImpl,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/some-model:generateContent");
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
    expect(init.body as string).not.toContain(KEY);
  });

  it("asks for JSON matching the schema, deterministically", async () => {
    const fetchImpl = mockFetch(ok("{}"));
    await callGemini({ system: "SYS", prompt: "PROMPT", jsonSchema: { type: "object" }, apiKey: KEY, fetchImpl });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig).toMatchObject({
      temperature: 0,
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object" },
    });
    expect(body.systemInstruction.parts[0].text).toBe("SYS");
    expect(body.contents[0].parts[0].text).toBe("PROMPT");
  });

  it("asks for plain text when there's no schema", async () => {
    const fetchImpl = mockFetch(ok("hello"));
    await callGemini({ system: "s", prompt: "p", apiKey: KEY, fetchImpl });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.responseMimeType).toBeUndefined();
  });

  it("joins text parts and skips 'thought' parts", async () => {
    const body = {
      candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: "{" }, { text: "}" }] } }],
    };
    expect(await callGemini({ system: "s", prompt: "p", apiKey: KEY, fetchImpl: mockFetch(body) })).toEqual({
      ok: true,
      text: "{}",
    });
  });

  it("reports an HTTP error without leaking the prompt, and logs only the status and Google's message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await callGemini({
      system: "s",
      prompt: "my secret sentence",
      apiKey: KEY,
      fetchImpl: mockFetch({ error: { message: "API key not valid" } }, { status: 400 }),
    });
    expect(r).toMatchObject({ ok: false, code: "http" });
    expect(JSON.stringify(r)).not.toContain("my secret sentence");
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("400");
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain("my secret sentence");
  });

  it("reports a blocked prompt", async () => {
    const r = await callGemini({
      system: "s",
      prompt: "p",
      apiKey: KEY,
      fetchImpl: mockFetch({ promptFeedback: { blockReason: "SAFETY" } }),
    });
    expect(r).toMatchObject({ ok: false, code: "blocked" });
  });

  it("reports an empty reply", async () => {
    expect(await callGemini({ system: "s", prompt: "p", apiKey: KEY, fetchImpl: mockFetch({ candidates: [] }) })).toMatchObject({
      ok: false,
      code: "empty",
    });
  });

  it("reports network failures and timeouts", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await callGemini({ system: "s", prompt: "p", apiKey: KEY, fetchImpl: down })).toMatchObject({ code: "network" });

    const slow = vi.fn(async () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    });
    expect(await callGemini({ system: "s", prompt: "p", apiKey: KEY, fetchImpl: slow })).toMatchObject({ code: "timeout" });
  });
});

describe("retrying temporary errors", () => {
  const busy = () => new Response(JSON.stringify({ error: { message: "high demand" } }), { status: 503 });
  const fine = () => new Response(JSON.stringify(ok("done")), { status: 200 });
  const noWait = vi.fn(async () => {});

  it("retries a 503 and succeeds when Gemini recovers", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(fine());
    const r = await callGemini({ system: "s", prompt: "p", apiKey: KEY, fetchImpl, sleep: noWait });
    expect(r).toEqual({ ok: true, text: "done" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(noWait).toHaveBeenCalledTimes(1);
  });

  it("gives up after three attempts and reports the status", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => busy());
    const r = await callGemini({ system: "s", prompt: "p", apiKey: KEY, fetchImpl, sleep: async () => {} });
    expect(r).toMatchObject({ ok: false, code: "http", status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry a client error such as a bad request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { message: "bad" } }), { status: 400 }));
    const r = await callGemini({ system: "s", prompt: "p", apiKey: KEY, fetchImpl, sleep: async () => {} });
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
