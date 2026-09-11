/**
 * dsh-web-tools — SearXNG provider adapter (self-hosted, keyless option).
 * Queries explicitly configured instance URLs in order, with a timeout per instance.
 * Instance URLs are operator-owned; local instances are supported.
 * @module
 */
import { providerError, resolveContext, type ProviderAdapter, type SearchOutcome } from "./types.ts";
import { normalizeSources, record, records, searchJson, string } from "./search-response.ts";
import type { SearchHints } from "../search-hints.ts";
import type { SearxngProviderOptions } from "../../shared/provider-options.ts";

export const SEARXNG_META = {
  name: "searxng",
  label: "SearXNG",
  description: "Self-hosted metasearch (JSON output)",
  credSuffix: "SEARXNG",
  fetchCapable: false,
  needsBaseUrl: true,
  defaultBaseUrl: "http://127.0.0.1:8080",
} as const;

/**
 * Build SearXNG URL parameters based on query, options, and SearchHints.
 * Maps:
 *  - topic=code → categories=it
 *  - topic=research → categories=science
 *  - topic=news → categories=news
 *  - freshness preset → time_range: "day" | "month" | "year"
 *  - language → language (e.g. "zh-CN", "en")
 */
export function buildSearxngUrl(
  instanceUrl: string,
  query: string,
  apiKey?: string,
  hints?: Readonly<SearchHints>,
): URL {
  const instance = instanceUrl.replace(/\/$/, "");
  const url = new URL(`${instance}/search`);
  const cleanQ = hints?.cleanQuery ? hints.cleanQuery : query;

  url.searchParams.set("q", cleanQ);
  url.searchParams.set("format", "json");
  url.searchParams.set("safesearch", "0");
  if (apiKey) url.searchParams.set("api_key", apiKey);

  // 1. Categories
  if (hints?.topic === "code") {
    url.searchParams.set("categories", "it");
  } else if (hints?.topic === "research") {
    url.searchParams.set("categories", "science");
  } else if (hints?.topic === "news") {
    url.searchParams.set("categories", "news");
  }

  // 2. Time range
  const freshnessPreset = hints?.freshness?.preset;
  if (freshnessPreset === "day" || freshnessPreset === "month" || freshnessPreset === "year") {
    url.searchParams.set("time_range", freshnessPreset);
  }

  // 3. Language
  if (hints?.locale?.language) {
    url.searchParams.set("language", hints.locale.language);
  }

  return url;
}

export const SearxngProvider: ProviderAdapter = {
  ...SEARXNG_META,

  async search(query, maxResults, apiKey, baseUrl, contextOrSignal) {
    const { signal, hints, options } = resolveContext<SearxngProviderOptions>(contextOrSignal);
    const instances = [...new Set([baseUrl, ...(options?.instances ?? [])].filter((url): url is string => !!url?.trim()))];
    if (instances.length === 0) throw providerError("config", "SearXNG requires an explicitly configured instance");
    let lastError: unknown;
    for (const instance of instances) {
      signal?.throwIfAborted();
      const timeout = AbortSignal.timeout(options?.instanceTimeoutMs ?? 3000);
      const attemptSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        const outcome = await searchInstance(instance, query, maxResults, apiKey, hints, attemptSignal);
        if (outcome.sources.length) return outcome;
        lastError = providerError("invalid-response", "SearXNG instance returned no usable results");
      } catch (error) {
        if (signal?.aborted) throw providerError("aborted", "SearXNG search was cancelled");
        lastError = timeout.aborted ? providerError("timeout", "SearXNG instance timed out") : error;
      }
    }
    throw lastError;
  },

  async fetch(_url, _apiKey, _baseUrl, _signal) {
    throw providerError("config", "SearXNG does not provide native fetch; use the generic path");
  },
};

async function searchInstance(instanceUrl: string, query: string, maxResults: number, apiKey: string, hints: Readonly<SearchHints> | undefined, signal: AbortSignal): Promise<SearchOutcome> {
  const url = buildSearxngUrl(instanceUrl, query, apiKey, hints);
  const raw = record(await searchJson(url.href, { signal }));
  const sources = normalizeSources(records(raw.results).map((result) => ({
    url: string(result.url), title: string(result.title), snippet: string(result.content),
  })), maxResults ?? 8);
  return { sources, ...(typeof raw.answer === "string" && raw.answer ? { content: raw.answer } : {}) };
}
