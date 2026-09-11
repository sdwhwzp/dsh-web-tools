import assert from "node:assert/strict";
import test from "node:test";
import { createSearchProvider, createFetchProvider, createPoolStore, type ProviderAdapterLike, type WebToolsRuntimeConfig } from "../src/host/registry.ts";
import { SearchCache, searchCacheKey } from "../src/host/search-cache.ts";
import { searchAttempts } from "../src/host/search-access.ts";
import { providerError } from "../src/host/providers/types.ts";
import { createProviderHealthStore } from "../src/host/provider-health.ts";

function config(patch: Partial<WebToolsRuntimeConfig> = {}): WebToolsRuntimeConfig {
  return { enabled: true, defaultProvider: "api", fallbackOrder: ["free"], providerAttemptTimeoutMs: 1000, providerBaseUrls: {}, enabledProviders: {}, searchAccessMode: "api-first", ...patch };
}

function adapter(name: string, auth: ProviderAdapterLike["authentication"], run?: (key: string) => Promise<void>): ProviderAdapterLike {
  return { name, authentication: auth, needsBaseUrl: false, fetchCapable: true,
    async search(_query, _limit, key) { await run?.(key); return { sources: [{ url: `https://${name}.example/`, title: name }] }; },
    async fetch() { throw new Error("Unexpected account extraction"); },
  };
}

test("free-only never reads credentials, calls paid search, or invokes paid extraction", async () => {
  const called: string[] = [];
  const registry = { api: adapter("api", "required"), free: adapter("free", "optional", async (key) => { called.push(key); }) };
  const cfg = () => config({ searchAccessMode: "free-only" });
  const keys = async () => { throw new Error("Credentials must not be read"); };
  const search = createSearchProvider(cfg, keys, { record() {} }, registry);
  assert.equal((await search.search({ query: "hello" })).sources[0].title, "free");
  assert.deepEqual(called, [""]);
  const fetch = createFetchProvider(cfg, keys, registry, undefined, undefined, async (url) => ({
    url, finalUrl: url, contentType: "text/plain", extraction: "raw-text", statusCode: 200, content: "Local page extraction", truncated: false, backend: "builtin-http",
  }));
  assert.equal((await fetch.fetch({ url: "https://example.com" })).body.content, "Local page extraction");
});

test("free-first exhausts anonymous paths before accounts; API-first reverses those groups", async () => {
  const providers = { api: adapter("api", "required"), free: adapter("free", "none"), optional: adapter("optional", "optional") };
  assert.deepEqual(searchAttempts(["api", "free", "optional"], "free-first", providers), [
    { provider: "free", anonymous: true }, { provider: "optional", anonymous: true },
    { provider: "api", anonymous: false }, { provider: "optional", anonymous: false },
  ]);
  const calls: string[] = [];
  const registry = {
    api: adapter("api", "required", async () => { calls.push("api"); }),
    free: adapter("free", "none", async () => { calls.push("free"); throw providerError("rate-limit", "public quota exhausted"); }),
  };
  const search = createSearchProvider(() => config({ searchAccessMode: "free-first" }), async () => "account-key", { record() {} }, registry);
  await search.search({ query: "query" });
  assert.deepEqual(calls, ["free", "api"]);
  calls.length = 0;
  await createSearchProvider(() => config(), async () => "account-key", { record() {} }, registry).search({ query: "query" });
  assert.deepEqual(calls, ["api"]);
});

test("anonymous auth and cooldown failures cannot invalidate an account key", async () => {
  for (const code of ["auth", "rate-limit"] as const) {
    const called: string[] = [];
    const registry = { optional: adapter("optional", "optional", async (key) => {
      called.push(key);
      if (!key) throw providerError(code, "anonymous unavailable", 429, 10000);
    }) };
    const pools = createPoolStore(async () => "account-key");
    const search = createSearchProvider(() => config({ defaultProvider: "optional", fallbackOrder: [], searchAccessMode: "free-first" }), async () => "account-key", { record() {} }, registry, pools, createProviderHealthStore());
    await search.search({ query: "query" });
    assert.deepEqual(called, ["", "account-key"]);
    assert.equal((await pools.poolOf("optional"))[0].healthy, true);
  }
});

test("empty or domain-ineligible results move to the next source", async () => {
  const empty = adapter("api", "required");
  empty.search = async () => ({ sources: [] });
  const registry = { api: empty, free: adapter("free", "none") };
  const search = createSearchProvider(() => config(), async () => "k", { record() {} }, registry);
  assert.equal((await search.search({ query: "q" })).sources[0].title, "free");
  empty.search = async () => ({ sources: [{ url: "https://wrong.example/" }] });
  assert.equal((await search.search({ query: "q site:free.example" })).sources[0].title, "free");
});

test("canceling an active anonymous request prevents account fallback and releases its operation", async () => {
  const controller = new AbortController();
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => { entered = resolve; });
  let active = 0;
  let accountCalls = 0;
  const free = adapter("free", "none");
  free.search = async (_q, _n, _k, _b, context) => {
    const signal = context && "signal" in context ? context.signal : context as AbortSignal;
    active++;
    entered();
    try {
      await new Promise<void>((_resolve, reject) => signal?.addEventListener("abort", () => reject(providerError("aborted", "cancelled")), { once: true }));
      return { sources: [] };
    } finally { active--; }
  };
  const search = createSearchProvider(() => config({ searchAccessMode: "free-first" }), async () => "k", { record() {} }, {
    free, api: adapter("api", "required", async () => { accountCalls++; }),
  });
  const result = search.search({ query: "q" }, controller.signal);
  await ready;
  controller.abort();
  await assert.rejects(result, { code: "WEB_ABORTED" });
  assert.equal(accountCalls, 0);
  assert.equal(active, 0);
});

test("search cache is isolated by credential, settings, and plugin instance", async () => {
  let key = "account-one";
  let calls = 0;
  let cfg = config({ fallbackOrder: [], cacheTtlSeconds: 300, cacheMaxEntries: 2 });
  const registry = { api: adapter("api", "required", async () => { calls++; }) };
  const make = () => createSearchProvider(() => cfg, async () => key, { record() {} }, registry);
  const one = make();
  await one.search({ query: "q" });
  await one.search({ query: "q" });
  assert.equal(calls, 1);
  key = "account-two";
  await one.search({ query: "q" });
  assert.equal(calls, 2);
  await make().search({ query: "q" });
  assert.equal(calls, 3);
  cfg = { ...cfg, cacheTtlSeconds: 0 };
  await one.search({ query: "q" });
  await one.search({ query: "q" });
  assert.equal(calls, 5);
});

test("LRU eviction, expiry, and result mutation do not return stale or modified results", () => {
  let now = 0;
  const cache = new SearchCache(() => now);
  const outcome = { sources: [{ url: "https://example.com/", title: "original" }] };
  cache.set("a", outcome, 30, 2);
  cache.set("b", outcome, 30, 2);
  cache.get("a", 30)!.sources[0].title = "mutated";
  cache.set("c", outcome, 30, 2);
  assert.equal(cache.get("b", 30), undefined);
  assert.equal(cache.get("a", 30)?.sources[0].title, "original");
  now = 30001;
  assert.equal(cache.get("a", 30), undefined);
  assert.doesNotMatch(searchCacheKey({ key: "secret-key" }), /secret/);
});


test("relative time becomes a date operator for providers without native date fields", async () => {
  let seenQuery = "";
  const source = adapter("free", "none");
  source.search = async (query) => { seenQuery = query; return { sources: [{ url: "https://example.com" }] }; };
  const search = createSearchProvider(() => config({ defaultProvider: "free", fallbackOrder: [], searchAccessMode: "free-only" }), async () => "", { record() {} }, { free: source });
  await search.search({ query: "news time:3d" });
  assert.match(seenQuery, /^news after:\d{4}-\d{2}-\d{2}$/);
  await search.search({ query: "news time:3d after:2026-01-01" });
  assert.equal(seenQuery.replace(/\s+/g, " "), "news after:2026-01-01");
});
