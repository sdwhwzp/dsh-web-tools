import { type ProviderAdapter, type Source } from "./types.ts";
import type { SearchHints } from "../search-hints.ts";
declare const HTML_ENDPOINTS: {
    readonly bing: "https://www.bing.com/search";
    readonly ddg: "https://html.duckduckgo.com/html/";
    readonly "ddg-lite": "https://lite.duckduckgo.com/lite/";
};
/** Search-only providers use the shared generic page fetcher. */
export declare function unsupportedFetch(): Promise<never>;
/** Parse organic Bing or DuckDuckGo HTML; changed markup and challenges trigger fallback. */
export declare function parseHtmlSearch(engine: keyof typeof HTML_ENDPOINTS, html: string, limit: number): Source[];
/** Public Bing HTML search. */
export declare const BingProvider: ProviderAdapter;
/** Public DuckDuckGo HTML search. */
export declare const DdgProvider: ProviderAdapter;
/** Public DuckDuckGo Lite search. */
export declare const DdgLiteProvider: ProviderAdapter;
/** Anonymous AnySearch REST search. Availability depends on its public quota. */
export declare const AnysearchProvider: ProviderAdapter;
/** Normalize Exa/Keenable MCP text results, preserving usable dates and snippets. */
export declare function parseMcpSources(text: string, limit: number): Source[];
/** Exa anonymous MCP search; its text query retains constraints unsupported as MCP fields. */
export declare function searchExaAnonymous(query: string, limit: number, signal?: AbortSignal): Promise<{
    sources: Source[];
}>;
/** Keenable accepts a key for REST search or anonymous MCP requests. */
export declare const KeenableProvider: ProviderAdapter;
/** Enforce explicit domain restrictions even when the remote engine ignores them. */
export declare function filterSourceDomains(sources: Source[], hints?: Readonly<SearchHints>): Source[];
export {};
