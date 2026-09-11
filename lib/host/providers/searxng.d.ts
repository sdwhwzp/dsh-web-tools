/**
 * dsh-web-tools — SearXNG provider adapter (self-hosted, keyless option).
 * Queries explicitly configured instance URLs in order, with a timeout per instance.
 * Instance URLs are operator-owned; local instances are supported.
 * @module
 */
import { type ProviderAdapter } from "./types.ts";
import type { SearchHints } from "../search-hints.ts";
export declare const SEARXNG_META: {
    readonly name: "searxng";
    readonly label: "SearXNG";
    readonly description: "Self-hosted metasearch (JSON output)";
    readonly credSuffix: "SEARXNG";
    readonly fetchCapable: false;
    readonly needsBaseUrl: true;
    readonly defaultBaseUrl: "http://127.0.0.1:8080";
};
/**
 * Build SearXNG URL parameters based on query, options, and SearchHints.
 * Maps:
 *  - topic=code → categories=it
 *  - topic=research → categories=science
 *  - topic=news → categories=news
 *  - freshness preset → time_range: "day" | "month" | "year"
 *  - language → language (e.g. "zh-CN", "en")
 */
export declare function buildSearxngUrl(instanceUrl: string, query: string, apiKey?: string, hints?: Readonly<SearchHints>): URL;
export declare const SearxngProvider: ProviderAdapter;
