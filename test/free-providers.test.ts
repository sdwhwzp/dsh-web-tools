import assert from "node:assert/strict";
import test from "node:test";
import { AnysearchProvider, BingProvider, DdgProvider, DdgLiteProvider, KeenableProvider, parseHtmlSearch, parseMcpSources } from "../src/host/providers/free-search.ts";
import { ExaProvider } from "../src/host/providers/exa.ts";
import { TavilyProvider } from "../src/host/providers/tavily.ts";
import { PerplexityProvider, DeepSeekOfficialProvider } from "../src/host/providers/answer-search.ts";
import { searchMcp, searchText } from "../src/host/providers/search-response.ts";
import { extractSearchHints } from "../src/host/search-hints.ts";

const mcpResult = { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "Title: Documentation\nURL: https://example.com/docs\nPublished: 2026-09-10\nHighlights:\nExample documentation" }] } };

test("HTML parsers decode redirect URLs, preserve Unicode, and reject executable links", () => {
  const html = '<li class="b_algo"><h2><a href="https://www.bing.com/ck/a?u=a1' + Buffer.from("https://example.com/docs").toString("base64url") + '">中文 &amp; API</a></h2><p>Snippet text</p></li>';
  assert.deepEqual(parseHtmlSearch("bing", html, 5), [{ url: "https://example.com/docs", title: "中文 & API", snippet: "Snippet text" }]);
  assert.deepEqual(parseHtmlSearch("ddg", '<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F">Title</a><a class="result__snippet">Body</a></div>', 5), [{ url: "https://example.com/", title: "Title", snippet: "Body" }]);
  assert.equal(parseHtmlSearch("ddg-lite", '<a href="https://example.com/" class="result-link">Title</a><td class="result-snippet">Text</td>', 1)[0].snippet, "Text");
  assert.throws(() => parseHtmlSearch("ddg", '<form id="challenge-form">captcha</form>', 5), { code: "rate-limit" });
  assert.throws(() => parseHtmlSearch("bing", '<li class="b_algo"><h2><a href="javascript:alert(1)">Bad</a></h2></li>', 5), { code: "invalid-response" });
  assert.throws(() => parseHtmlSearch("bing", '<html>Changed markup</html>', 5), { code: "invalid-response" });
});

test("Bing and both DDG adapters forward locale, time filters, and cancellation", async (t) => {
  const urls: URL[] = [];
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (url: string | URL, init: RequestInit) => {
    urls.push(new URL(url));
    assert.equal(init.signal, controller.signal);
    return new Response(urls.length === 1 ? '<li class="b_algo"><h2><a href="https://example.com/">Bing</a></h2></li>' : '<div class="result"><a class="result__a result-link" href="https://example.com/">DDG</a></div>');
  });
  for (const adapter of [BingProvider, DdgProvider, DdgLiteProvider]) await adapter.search("query", 3, "", undefined, {
    signal: controller.signal, options: { market: "en-US", region: "us-en", safeSearch: "strict" }, hints: extractSearchHints("query last 7 days"),
  });
  assert.equal(urls[0].searchParams.get("mkt"), "en-US");
  for (const url of urls.slice(1)) {
    assert.equal(url.searchParams.get("df"), "w");
    assert.equal(url.searchParams.get("kl"), "us-en");
    assert.equal(url.searchParams.get("kp"), "1");
  }
});

test("optional Exa selects MCP without a key and preserves the existing keyed REST path", async (t) => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return url.includes("mcp.exa.ai")
      ? new Response(`event: message\ndata: ${JSON.stringify(mcpResult)}\n\n`, { headers: { "content-type": "text/event-stream" } })
      : Response.json({ results: [{ url: "https://example.com/docs", title: "REST", highlights: ["API result"] }] });
  });
  const anonymous = await ExaProvider.search("docs", 3, "", undefined);
  assert.equal(anonymous.sources[0].publishedAt, "2026-09-10");
  assert.equal(new Headers(requests[0].init.headers).has("x-api-key"), false);
  await ExaProvider.search("docs", 3, "account-key", undefined);
  assert.equal(new Headers(requests[1].init.headers).get("x-api-key"), "account-key");
  assert.equal(JSON.parse(String(requests[1].init.body)).contents.highlights, true);
});

test("Tavily anonymous requests use keyless mode and keyed requests keep native options", async (t) => {
  const requests: RequestInit[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    requests.push(init);
    return Response.json({ results: [{ url: "https://example.com/", title: "Title", content: "snippet" }] });
  });
  await TavilyProvider.search("query", 3, "", undefined);
  await TavilyProvider.search("query", 3, "account-key", undefined, { options: { searchDepth: "advanced", chunksPerSource: 2 } });
  assert.equal(new Headers(requests[0].headers).get("x-tavily-access-mode"), "keyless");
  assert.equal(new Headers(requests[0].headers).has("authorization"), false);
  assert.equal(new Headers(requests[1].headers).get("authorization"), "Bearer account-key");
  assert.equal(new Headers(requests[1].headers).has("x-tavily-access-mode"), false);
  assert.equal(JSON.parse(String(requests[1].body)).search_depth, "advanced");
});

test("AnySearch and Keenable normalize their REST and MCP result forms", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url.includes("anysearch")) return Response.json({ code: 0, data: { results: [{ url: "https://example.com/", title: "AnySearch", description: "Description" }] } });
    if (url.endsWith("/mcp")) return Response.json(mcpResult);
    return Response.json({ results: [{ url: "https://example.com/", title: "Keenable", published_at: "2026-09-10" }] });
  });
  assert.equal((await AnysearchProvider.search("query", 3, "", undefined)).sources[0].snippet, "Description");
  assert.equal((await KeenableProvider.search("query", 3, "", undefined)).sources[0].title, "Documentation");
  assert.equal((await KeenableProvider.search("query", 3, "key", undefined)).sources[0].title, "Keenable");
});

test("MCP correlates response ids and rejects tool failures and malformed JSON", async (t) => {
  const queue = [
    Response.json({ ...mcpResult, id: 2 }), Response.json({ ...mcpResult, result: { isError: true, content: [] } }),
    new Response("invalid"), new Response("limited", { status: 429, headers: { "retry-after": "2" } }),
  ];
  t.mock.method(globalThis, "fetch", async () => queue.shift()!);
  for (const code of ["invalid-response", "server", "invalid-response", "rate-limit"]) {
    await assert.rejects(searchMcp("https://example.com/mcp", "search", {}), { code });
  }
  assert.equal(parseMcpSources("Title: Invalid\nURL: javascript:alert(1)", 5).length, 0);
});

test("oversized search responses cancel their reader", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(searchText(new Response(stream)), { code: "invalid-response" });
  assert.equal(cancelled, true);
});

test("Perplexity and DeepSeek preserve citations and configured search models", async (t) => {
  const bodies: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return url.includes("perplexity") ? Response.json({ choices: [{ message: { content: "Answer" } }], citations: ["https://example.com/"], search_results: [{ url: "https://example.com/", title: "Cited page" }] })
      : Response.json({ content: [{ type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://example.com/", title: "Source" }] }, { type: "text", citations: [{ url: "https://example.com/", cited_text: "Cited passage" }] }] });
  });
  assert.equal((await PerplexityProvider.search("q", 2, "key", undefined, { options: { model: "custom-model", maxTokens: 512 } })).content, "Answer");
  assert.equal(bodies[0].model, "custom-model");
  assert.equal(bodies[0].max_tokens, 512);
  assert.equal((await DeepSeekOfficialProvider.search("q", 2, "key", undefined)).sources[0].snippet, "Cited passage");
});

test("relative search ranges preserve explicit dates and normalize to provider date precision", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  assert.equal(extractSearchHints("release time:3d", now).freshness?.after, "2026-09-08");
  assert.equal(extractSearchHints("release time:2mo", now).freshness?.after, "2026-07-11");
  assert.equal(extractSearchHints("release after:2026-01-01 time:3d", now).freshness?.after, "2026-01-01");
  assert.equal(extractSearchHints("release time:3d", now).cleanQuery, "release");
});

test("SearXNG tries only explicit instances and falls back from empty or invalid responses", async (t) => {
  const { SearxngProvider } = await import("../src/host/providers/searxng.ts");
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(new URL(url));
    if (urls.length === 1) return Response.json({ results: [] });
    if (urls.length === 2) return Response.json({ results: [{ url: "javascript:bad" }] });
    return Response.json({ results: [{ url: "https://example.com/", title: "Found", content: "Text" }] });
  });
  await assert.rejects(SearxngProvider.search("query", 2, "", undefined), { code: "config" });
  assert.equal(urls.length, 0);
  const outcome = await SearxngProvider.search("query", 2, "", "http://127.0.0.1:8080", {
    options: { instances: ["https://second.example", "https://third.example"], instanceTimeoutMs: 1000 },
  });
  assert.equal(outcome.sources[0].title, "Found");
  assert.deepEqual(urls.map((url) => url.hostname), ["127.0.0.1", "second.example", "third.example"]);
  assert.ok(urls.every((url) => url.searchParams.get("format") === "json"));
});

test("SearXNG continues after an instance timeout but stops on caller cancellation", async (t) => {
  const { SearxngProvider } = await import("../src/host/providers/searxng.ts");
  const timeout = new AbortController();
  const caller = new AbortController();
  let calls = 0;
  t.mock.method(AbortSignal, "timeout", () => calls === 0 ? timeout.signal : new AbortController().signal);
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    calls++;
    if (calls === 1) timeout.abort(new DOMException("Timeout", "TimeoutError"));
    else caller.abort();
    init.signal!.throwIfAborted();
    throw new Error("Expected cancellation");
  });
  await assert.rejects(SearxngProvider.search("query", 2, "", "https://first.example", {
    signal: caller.signal, options: { instances: ["https://second.example", "https://third.example"] },
  }), { code: "aborted" });
  assert.equal(calls, 2);
});

test("new provider settings validate JSON types, explicit instance URLs, and timeout bounds", async () => {
  const { sanitizeProviderOptions } = await import("../src/host/provider-options.ts");
  assert.deepEqual(sanitizeProviderOptions("searxng", { instances: ["http://localhost:8080/", "http://localhost:8080"], instanceTimeoutMs: 1000 }), {
    instances: ["http://localhost:8080"], instanceTimeoutMs: 1000,
  });
  for (const value of [null, "url", ["file:///etc/passwd"], ["https://user:pass@example.com"], ["https://example.com/?key=secret"], [3]]) {
    assert.throws(() => sanitizeProviderOptions("searxng", { instances: value }));
  }
  for (const value of [0, 999, 60001, "3000", 2000.5]) assert.throws(() => sanitizeProviderOptions("searxng", { instanceTimeoutMs: value }));
  assert.deepEqual(sanitizeProviderOptions("bing", { market: "en-US", safeSearch: "strict" }), { market: "en-US", safeSearch: "strict" });
  assert.throws(() => sanitizeProviderOptions("bing", { safeSearch: ["strict"] }));
  assert.throws(() => sanitizeProviderOptions("ddg", { region: "not a region" }));
  assert.deepEqual(sanitizeProviderOptions("perplexity", { model: " sonar ", maxTokens: 128 }), { model: "sonar", maxTokens: 128 });
  assert.throws(() => sanitizeProviderOptions("deepseek-official", { maxTokens: "1024" }));
  assert.throws(() => sanitizeProviderOptions("perplexity", { model: "" }));
});
