/**
 * dsh-web-tools — SearXNG provider adapter (self-hosted, keyless option).
 * Queries explicitly configured instance URLs in order, with a timeout per instance.
 * Instance URLs are operator-owned; local instances are supported.
 * @module
 */
import { providerError, resolveContext } from "./types.js";
import { normalizeSources, record, records, searchJson, string } from "./search-response.js";
export const SEARXNG_META = {
    name: "searxng",
    label: "SearXNG",
    description: "Self-hosted metasearch (JSON output)",
    credSuffix: "SEARXNG",
    fetchCapable: false,
    needsBaseUrl: true,
    defaultBaseUrl: "http://127.0.0.1:8080",
};
/**
 * A SearXNG credential written `user:password` means HTTP Basic — the form
 * that reverse proxies guarding a self-hosted instance require, and the one
 * the retired dsh-search-failover backend accepted. Anything else is passed
 * on as the `api_key` query parameter.
 *
 * Basic is NOT optional here: `api_key` in the query string cannot satisfy a
 * proxy, and `fetch()` refuses a URL carrying userinfo
 * ("Request cannot be constructed from a URL that includes credentials"), so
 * there is no config-only workaround.
 */
export function buildSearxngAuth(apiKey) {
    if (!apiKey)
        return { headers: {} };
    const separator = apiKey.indexOf(":");
    if (separator <= 0)
        return { headers: {}, queryKey: apiKey };
    const encoded = Buffer.from(apiKey, "utf8").toString("base64");
    return { headers: { authorization: `Basic ${encoded}` } };
}
/**
 * Build SearXNG URL parameters based on query, options, and SearchHints.
 * Maps:
 *  - topic=code → categories=it
 *  - topic=research → categories=science
 *  - topic=news → categories=news
 *  - freshness preset → time_range: "day" | "month" | "year"
 *  - language → language (e.g. "zh-CN", "en")
 */
export function buildSearxngUrl(instanceUrl, query, apiKey, hints) {
    const instance = instanceUrl.replace(/\/$/, "");
    const url = new URL(`${instance}/search`);
    const cleanQ = hints?.cleanQuery ? hints.cleanQuery : query;
    url.searchParams.set("q", cleanQ);
    url.searchParams.set("format", "json");
    url.searchParams.set("safesearch", "0");
    const { queryKey } = buildSearxngAuth(apiKey);
    if (queryKey)
        url.searchParams.set("api_key", queryKey);
    // 1. Categories
    if (hints?.topic === "code") {
        url.searchParams.set("categories", "it");
    }
    else if (hints?.topic === "research") {
        url.searchParams.set("categories", "science");
    }
    else if (hints?.topic === "news") {
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
export const SearxngProvider = {
    ...SEARXNG_META,
    async search(query, maxResults, apiKey, baseUrl, contextOrSignal) {
        const { signal, hints, options } = resolveContext(contextOrSignal);
        const instances = [...new Set([baseUrl, ...(options?.instances ?? [])].filter((url) => !!url?.trim()))];
        if (instances.length === 0)
            throw providerError("config", "SearXNG requires an explicitly configured instance");
        let lastError;
        for (const instance of instances) {
            signal?.throwIfAborted();
            const timeout = AbortSignal.timeout(options?.instanceTimeoutMs ?? 3000);
            const attemptSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
            try {
                const outcome = await searchInstance(instance, query, maxResults, apiKey, hints, attemptSignal);
                if (outcome.sources.length)
                    return outcome;
                lastError = providerError("invalid-response", "SearXNG instance returned no usable results");
            }
            catch (error) {
                if (signal?.aborted)
                    throw providerError("aborted", "SearXNG search was cancelled");
                lastError = timeout.aborted ? providerError("timeout", "SearXNG instance timed out") : error;
            }
        }
        throw lastError;
    },
    async fetch(_url, _apiKey, _baseUrl, _signal) {
        throw providerError("config", "SearXNG does not provide native fetch; use the generic path");
    },
};
async function searchInstance(instanceUrl, query, maxResults, apiKey, hints, signal) {
    const url = buildSearxngUrl(instanceUrl, query, apiKey, hints);
    const { headers } = buildSearxngAuth(apiKey);
    const raw = record(await searchJson(url.href, { signal, headers }));
    const sources = normalizeSources(records(raw.results).map((result) => ({
        url: string(result.url), title: string(result.title), snippet: string(result.content),
    })), maxResults ?? 8);
    return { sources, ...(typeof raw.answer === "string" && raw.answer ? { content: raw.answer } : {}) };
}
