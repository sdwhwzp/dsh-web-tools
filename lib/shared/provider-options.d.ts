/**
 * dsh-web-tools — Provider-native typed execution options.
 *
 * Dedicated typed settings per provider. No universal SearchOptions.
 * @module
 */
export interface ExaProviderOptions {
    searchType?: "auto" | "fast" | "instant" | "deep-lite" | "deep" | "deep-reasoning";
    maxAgeHours?: number;
}
export interface TavilyProviderOptions {
    searchDepth?: "basic" | "advanced" | "fast" | "ultra-fast";
    chunksPerSource?: 1 | 2 | 3;
    autoParameters?: boolean;
    /** Extract depth for /extract (web_fetch). */
    fetchExtractDepth?: "basic" | "advanced";
}
export interface BraveProviderOptions {
    endpointPreference?: "auto" | "llm-context" | "web-search";
    contextThresholdMode?: "strict" | "balanced" | "lenient" | "disabled";
    contextTokenBudget?: number;
}
export interface YouProviderOptions {
    extractionMode?: "highlights" | "none";
    fetchCrawlTimeoutSec?: number;
    fetchMaxAgeSec?: number;
}
export interface FirecrawlProviderOptions {
    fetchOnlyMainContent?: boolean;
    fetchMaxAgeMs?: number;
}
export interface ParallelProviderOptions {
    mode?: "turbo" | "fast" | "basic" | "advanced";
    maxCharsTotal?: number;
}
export interface JinaProviderOptions {
    /**
     * Reader page loading engine.
     * undefined / auto = Jina default.
     */
    fetchEngine?: "auto" | "curl" | "browser";
    /**
     * Max acceptable cache age in seconds.
     * undefined = Jina default. 0 = force fresh (X-No-Cache equivalent).
     */
    fetchCacheToleranceSec?: number;
    /**
     * Trim output rather than reject — the normal context-size guard.
     */
    fetchMaxTokens?: number;
    /**
     * Hard budget guard; Jina rejects the request if the page would exceed it.
     */
    fetchTokenBudget?: number;
    /**
     * Higher-quality HTML→Markdown conversion (ReaderLM-v2); ~3x Reader tokens.
     */
    fetchReaderLmV2?: boolean;
}
/** Locale and filtering preferences for public HTML search. */
export interface FreeSearchOptions {
    market?: string;
    region?: string;
    safeSearch?: "off" | "moderate" | "strict";
}
/** Model and response budget for citation-producing search APIs. */
export interface AnswerSearchOptions {
    model?: string;
    maxTokens?: number;
}
/** Operator-selected SearXNG instances and the timeout for each instance. */
export interface SearxngProviderOptions {
    instances?: string[];
    instanceTimeoutMs?: number;
}
export interface ProviderOptionsMap {
    searxng: SearxngProviderOptions;
    perplexity: AnswerSearchOptions;
    "deepseek-official": AnswerSearchOptions;
    bing: FreeSearchOptions;
    ddg: FreeSearchOptions;
    "ddg-lite": FreeSearchOptions;
    exa: ExaProviderOptions;
    tavily: TavilyProviderOptions;
    brave: BraveProviderOptions;
    you: YouProviderOptions;
    firecrawl: FirecrawlProviderOptions;
    parallel: ParallelProviderOptions;
    jina: JinaProviderOptions;
}
export type KnownProviderWithOptions = keyof ProviderOptionsMap;
export type StoredProviderOptions = Partial<{
    [K in keyof ProviderOptionsMap]: ProviderOptionsMap[K];
}>;
export interface ProviderOptionView<T extends object = Record<string, unknown>> {
    overrides: Partial<T>;
    effective: T;
    customized: boolean;
    isDefault: boolean;
}
