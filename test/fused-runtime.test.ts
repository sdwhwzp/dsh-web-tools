import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { apply } from "../src/host/index.ts";
import { DEFAULT_SETTINGS } from "../src/host/config.ts";
import type { WebToolsContext } from "../src/host/context-types.ts";
import type { WebSearchProviderLike } from "../src/host/registry.ts";
import { searchGuidance } from "../src/host/search-guidance.ts";

test("the installed plugin routes free and public searches through its sole standard provider", async (t) => {
  const cfg = structuredClone({ ...DEFAULT_SETTINGS, defaultProvider: "bing", fallbackOrder: [], searchAccessMode: "free-only" as const });
  let search!: WebSearchProviderLike;
  let credentialReads = 0;
  let networkCalls = 0;
  const events = new Map<string, (...args: unknown[]) => unknown>();
  const scopedEvents = new Map<string, (...args: unknown[]) => unknown>();
  const disposers: Array<() => unknown> = [];
  const effect = (fn: () => unknown) => { const dispose = fn(); if (typeof dispose === "function") disposers.push(dispose as () => unknown); };
  const context = {
    webServer: { register: () => () => {}, registerUpgrade: () => () => {} },
    webRuntime: { trustedHosts: ["localhost"] },
    settings: { register: () => ({ get: () => cfg, update: async () => {}, watch: () => () => {} }) },
    credentials: { resolve: async () => { credentialReads++; return { value: "private-account-key" }; } },
    web: { registerSearchProvider: (provider: WebSearchProviderLike) => { search = provider; return () => {}; }, registerFetchProvider: () => () => {} },
    effect,
    inject: (_services: unknown, fn: (ctx: unknown) => void) => fn(context),
    on: (name: string, fn: (...args: unknown[]) => unknown) => { events.set(name, fn); return () => events.delete(name); },
  };
  t.after(async () => { for (const dispose of disposers.reverse()) await dispose(); });
  t.mock.method(globalThis, "fetch", async (url: string) => {
    networkCalls++;
    if (url.includes("bing.com")) return new Response('<li class="b_algo"><h2><a href="https://example.com/docs">Documentation</a></h2><p>Search snippet</p></li>');
    if (url.includes("api.github.com")) return Response.json({ items: [{ html_url: "https://github.com/example/repo", full_name: "example/repo", description: "Repository result" }] });
    throw new Error(`Unexpected URL: ${url}`);
  });
  apply(context as unknown as WebToolsContext);
  assert.equal(search.id, "dsh-web-tools");
  const general = await search.search({ query: "documentation", maxResults: 2 });
  const github = await search.search({ query: "GitHub: example", maxResults: 2 });
  await search.search({ query: "GitHub: example", maxResults: 2 });
  assert.equal(networkCalls, 2);
  assert.equal(credentialReads, 0);
  const snapshot = JSON.parse(await readFile(new URL("./expected/fused-search.json", import.meta.url), "utf8"));
  assert.deepEqual({ general: general.sources, github: github.sources, content: github.content, guidance: searchGuidance({}) }, snapshot);
  cfg.platformEnabled.github = false;
  await assert.rejects(search.search({ query: "GitHub: example" }), /disabled/);
  assert.equal(networkCalls, 2);

  const agent = { id: "session-one", ctx: { effect, on: (name: string, fn: (...args: unknown[]) => unknown) => { scopedEvents.set(name, fn); return () => scopedEvents.delete(name); } }, steer() {}, cancel() {} };
  events.get("agent/created")!({ agent });
  const decision = await scopedEvents.get("agent/pre-step")!({ turn: 1, step: 1 }, async () => ({ kind: "enter", messages: [{ user: "query" }] })) as { messages: Array<{ source?: { kind: string; form: string; sections: Array<{ text: string }> } }> };
  assert.equal(decision.messages.length, 2);
  assert.equal(decision.messages[0].source?.kind, "plugin");
  assert.equal(decision.messages[0].source?.form, "snapshot");
  assert.doesNotMatch(decision.messages[0].source!.sections[0].text, /github:/);
  const later = await scopedEvents.get("agent/pre-step")!({ turn: 1, step: 2 }, async () => ({ kind: "enter", messages: [] })) as { messages: unknown[] };
  assert.deepEqual(later.messages, []);
  cfg.defaultProvider = "perplexity";
  cfg.platformEnabled.github = true;
  assert.equal(search.available(), true, "public searches remain available without an eligible general source");
  cfg.enabled = false;
  await assert.rejects(search.search({ query: "documentation" }), /disabled/);
});
