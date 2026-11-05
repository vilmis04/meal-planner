import { describe, expect, it, vi } from "vitest";
import { AiError, createGeminiClient } from "./gemini";

function respond(status: number, body: unknown) {
  return vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

const answer = (text: string) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });

describe("Gemini client", () => {
  it("sends the prompt and schema with the key in a header and parses the JSON answer", async () => {
    const fetch = respond(200, answer('{"swaps":[]}'));
    const client = createGeminiClient({ apiKey: "secret", model: "gemini-test", fetch });

    expect(await client.generateJson({ prompt: "Hi", schema: { type: "OBJECT" } })).toEqual({ swaps: [] });

    const [url, init] = fetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect(url).not.toContain("secret");
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe("secret");
    expect(JSON.parse(init.body as string)).toEqual({
      contents: [{ role: "user", parts: [{ text: "Hi" }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT" }, temperature: 0.2 },
    });
  });

  it("uses a configured base URL", async () => {
    const fetch = respond(200, answer("{}"));
    await createGeminiClient({ apiKey: "k", model: "m", baseUrl: "http://localhost:9/v1beta/", fetch }).generateJson({
      prompt: "",
      schema: {},
    });
    expect(fetch.mock.calls[0]![0]).toBe("http://localhost:9/v1beta/models/m:generateContent");
  });

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [403, false],
  ])("turns HTTP %i into an error that is retryable: %s", async (status, retryable) => {
    const client = createGeminiClient({ apiKey: "k", model: "m", fetch: respond(status, { error: {} }) });
    const error = await client.generateJson({ prompt: "", schema: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).retryable).toBe(retryable);
  });

  it("treats a network failure, an empty answer and invalid JSON as retryable", async () => {
    const network = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    for (const fetch of [network, respond(200, { candidates: [] }), respond(200, answer("not json"))]) {
      const error = await createGeminiClient({ apiKey: "k", model: "m", fetch })
        .generateJson({ prompt: "", schema: {} })
        .catch((e: unknown) => e);
      expect(error).toMatchObject({ name: "AiError", retryable: true });
    }
  });

  it("refuses to start without a key", () => {
    expect(() => createGeminiClient({ apiKey: "", model: "m" })).toThrow("NUXT_GEMINI_API_KEY");
  });
});
