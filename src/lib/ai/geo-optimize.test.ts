import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ANSWER_FIRST_SCHEMA, ANSWER_FIRST_SYSTEM, AnswerFirstResult, buildGeoPrompt, FAQ_SYSTEM, FaqResult, scoreAnswerFirst, scoreFaqs, type GeoAiInput,
} from "./geo-optimize";

vi.mock("server-only", () => ({}));

const DRAFT = `Our Aurora 12GB graphics card is built for gamers who want smooth play at high resolutions, and it comes from a long line of cards
that we have designed and tested in our lab over many years with a lot of care and attention to every small detail of the board and cooler and fans.

It has 12 GB of GDDR6X memory, a 2,610 MHz boost clock and needs a 650 W power supply. It costs $549 and has a 3-year warranty.`;

const input: GeoAiInput = { kind: "answer-first", keyword: "1440p graphics card", draft: DRAFT };

const GOOD_REWRITE = `# Aurora 12GB 1440p graphics card

The Aurora 12GB is a 1440p graphics card for gamers who want smooth, high-resolution play. It has 12 GB of GDDR6X memory and costs $549.

## What power supply does the Aurora 12GB need?

The Aurora 12GB needs a 650 W power supply. With its 2,610 MHz boost clock and 12 GB of GDDR6X memory, a quality 650 W unit gives it enough headroom for long 1440p gaming sessions without instability.

## Is the Aurora 12GB covered by a warranty?

Yes. The Aurora 12GB comes with a 3-year warranty, so the card is covered for three full years of 1440p gaming after you buy it, which is a long period of protection for a graphics card at $549.`;

describe("GEO AI prompts", () => {
  it("keeps the fixed instructions brand-free and puts the page in the request", () => {
    expect(ANSWER_FIRST_SYSTEM).not.toMatch(/Aurora|Example PC/);
    expect(FAQ_SYSTEM).not.toMatch(/Aurora|Example PC/);
    const p = buildGeoPrompt(input);
    expect(p).toContain(`<original_page>\n${DRAFT}\n</original_page>`);
    expect(p).toContain("Target keyword: 1440p graphics card");
  });
});

describe("scoring GEO AI results", () => {
  it("re-scores an answer-first rewrite and confirms it kept every fact", () => {
    const s = scoreAnswerFirst(input, { markdown: GOOD_REWRITE, summary: "Added a summary lead and question headings." });
    expect(s.facts.ok).toBe(true);
    expect(s.geoAfter).toBeGreaterThan(s.geoBefore);
  });

  it("flags a rewrite that drops or invents numbers", () => {
    const bad = GOOD_REWRITE.replace("costs $549", "costs $499").replace("a 3-year warranty", "free shipping");
    const s = scoreAnswerFirst(input, { markdown: bad, summary: "" });
    expect(s.facts.ok).toBe(false);
    expect(s.facts.inventedNumbers).toContain("$499");
    expect(s.facts.inventedClaims).toContain("free shipping");
  });

  it("fact-checks each FAQ and checks answer length", () => {
    const [good, bad] = scoreFaqs({ ...input, kind: "faq" }, { faqs: [
      { question: "What power supply does the Aurora 12GB need?", answer: "The Aurora 12GB needs a 650 W power supply. That leaves enough headroom for its 2,610 MHz boost clock and 12 GB of GDDR6X memory during long gaming sessions at high resolutions." },
      { question: "Is it on sale?", answer: "Yes, it's 20% off this week." },
    ] });
    expect(good.facts.ok).toBe(true);
    expect(good.directAnswer).toBe(true);
    expect(bad.facts.ok).toBe(false);
    expect(bad.directAnswer).toBe(false);
  });
});

/**
 * The real request path (streaming, structured output, parsing) against a local fake Claude server.
 * Never calls the real API.
 */
describe("callClaudeJson against a fake Claude server", () => {
  let server: Server;
  let lastBody: Record<string, unknown> = {};

  const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        lastBody = JSON.parse(raw);
        const text = JSON.stringify({ markdown: GOOD_REWRITE, summary: "Answer-first." });
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(sse([
          ["message_start", { type: "message_start", message: { id: "msg_fake", type: "message", role: "assistant", model: lastBody.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 1 } } }],
          ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
          ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(0, 40) } }],
          ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(40) } }],
          ["content_block_stop", { type: "content_block_stop", index: 0 }],
          ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 800 } }],
          ["message_stop", { type: "message_stop" }],
        ]));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    vi.stubEnv("ANTHROPIC_BASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    vi.stubEnv("ANTHROPIC_API_KEY", "fake-key-for-tests");
    vi.stubEnv("AI_MODEL", "claude-haiku-5-5");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    server.close();
  });

  it("sends the cached GEO instructions with the configured model and parses the streamed JSON", async () => {
    const { callClaudeJson, parseJsonAnswer } = await import("./generate");
    const { message, usage, cost } = await callClaudeJson({ system: ANSWER_FIRST_SYSTEM, prompt: buildGeoPrompt(input), schema: ANSWER_FIRST_SCHEMA, maxTokens: 12000 });
    expect(lastBody.model).toBe("claude-haiku-5-5");
    expect(lastBody).not.toHaveProperty("fallbacks");
    expect((lastBody.system as { cache_control?: unknown }[])[0].cache_control).toEqual({ type: "ephemeral" });
    expect(usage).toMatchObject({ inputTokens: 1200, outputTokens: 800 });
    expect(cost).toBeGreaterThan(0);
    const data = parseJsonAnswer(message, AnswerFirstResult);
    expect(scoreAnswerFirst(input, data).facts.ok).toBe(true);
    expect(FaqResult.safeParse({ faqs: [] }).success).toBe(false);
  });
});
