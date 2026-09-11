/**
 * dsh-web-tools — Host provider options normalization and validation.
 *
 * Validates and resolves effective execution options for each provider.
 * Keeps raw storage clean while providing fully-typed options to adapters.
 * @module
 */
import type {
  ExaProviderOptions,
  TavilyProviderOptions,
  BraveProviderOptions,
  YouProviderOptions,
  FirecrawlProviderOptions,
  ParallelProviderOptions,
  JinaProviderOptions,
  ProviderOptionView,
} from "../shared/provider-options.ts";

export const DEFAULT_EXA_OPTIONS: Required<ExaProviderOptions> = {
  searchType: "auto",
  maxAgeHours: 0, // 0 in type interface conceptually, but undefined in wire means omit
};

export const DEFAULT_TAVILY_OPTIONS: Required<TavilyProviderOptions> = {
  searchDepth: "basic",
  chunksPerSource: 3,
  autoParameters: false,
  fetchExtractDepth: "basic",
};

export const DEFAULT_BRAVE_OPTIONS: Required<BraveProviderOptions> = {
  endpointPreference: "auto",
  contextThresholdMode: "balanced",
  contextTokenBudget: 8192,
};

export const DEFAULT_YOU_OPTIONS: Required<YouProviderOptions> = {
  extractionMode: "highlights",
  fetchCrawlTimeoutSec: 10,
  fetchMaxAgeSec: 0,
};

export const DEFAULT_FIRECRAWL_OPTIONS: Required<FirecrawlProviderOptions> = {
  fetchOnlyMainContent: true,
  fetchMaxAgeMs: 172800000,
};

export const DEFAULT_PARALLEL_OPTIONS: Required<ParallelProviderOptions> = {
  mode: "advanced",
  maxCharsTotal: 25000, // NOT sent by default; only when user overrides (see buildProviderOptionView)
};

export const DEFAULT_JINA_OPTIONS: Required<Pick<JinaProviderOptions, "fetchEngine" | "fetchReaderLmV2">> = {
  fetchEngine: "auto",
  fetchReaderLmV2: false,
};

/** Validate options patch for a specific provider. Throws or returns sanitized options. */
export function sanitizeProviderOptions(
  provider: string,
  raw: Record<string, unknown>
): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};

  switch (provider) {
    case "searxng": {
      if (raw.instances !== undefined) {
        if (!Array.isArray(raw.instances) || raw.instances.length > 10) throw new Error("Invalid SearXNG instance list");
        out.instances = [...new Set(raw.instances.map((value) => {
          if (typeof value !== "string") throw new Error("Invalid SearXNG instance URL");
          const url = new URL(value);
          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Invalid SearXNG instance URL");
          return url.href.replace(/\/$/, "");
        }))];
      }
      if (raw.instanceTimeoutMs !== undefined) {
        if (typeof raw.instanceTimeoutMs !== "number" || !Number.isInteger(raw.instanceTimeoutMs) || raw.instanceTimeoutMs < 1000 || raw.instanceTimeoutMs > 60000) throw new Error("Invalid SearXNG instance timeout");
        out.instanceTimeoutMs = raw.instanceTimeoutMs;
      }
      break;
    }
    case "bing":
    case "ddg":
    case "ddg-lite": {
      for (const field of ["market", "region"] as const) {
        if (raw[field] !== undefined) {
          if (typeof raw[field] !== "string" || !/^[a-z]{2}-[a-z]{2}$/i.test(raw[field])) throw new Error(`Invalid ${field}`);
          out[field] = raw[field];
        }
      }
      if (raw.safeSearch !== undefined) {
        if (typeof raw.safeSearch !== "string" || !["off", "moderate", "strict"].includes(raw.safeSearch)) throw new Error("Invalid safeSearch");
        out.safeSearch = raw.safeSearch;
      }
      break;
    }
    case "perplexity":
    case "deepseek-official": {
      if (raw.model !== undefined) {
        if (typeof raw.model !== "string" || !raw.model.trim() || raw.model.length > 100) throw new Error("Invalid search model");
        out.model = raw.model.trim();
      }
      if (raw.maxTokens !== undefined) {
        if (typeof raw.maxTokens !== "number" || !Number.isInteger(raw.maxTokens) || raw.maxTokens < 128 || raw.maxTokens > 16384) throw new Error("Invalid search token budget");
        out.maxTokens = raw.maxTokens;
      }
      break;
    }
    case "exa": {
      const validTypes = ["auto", "fast", "instant", "deep-lite", "deep", "deep-reasoning"];
      if (typeof raw.searchType === "string" && validTypes.includes(raw.searchType)) {
        out.searchType = raw.searchType;
      }
      if (typeof raw.maxAgeHours === "number" && (raw.maxAgeHours >= -1 && raw.maxAgeHours <= 8760)) {
        out.maxAgeHours = Math.round(raw.maxAgeHours);
      }
      break;
    }
    case "tavily": {
      const validDepths = ["basic", "advanced", "fast", "ultra-fast"];
      if (typeof raw.searchDepth === "string" && validDepths.includes(raw.searchDepth)) {
        out.searchDepth = raw.searchDepth;
      }
      if (typeof raw.chunksPerSource === "number" && [1, 2, 3].includes(raw.chunksPerSource)) {
        out.chunksPerSource = raw.chunksPerSource;
      }
      if (typeof raw.autoParameters === "boolean") {
        out.autoParameters = raw.autoParameters;
      }
      if (typeof raw.fetchExtractDepth === "string" && ["basic", "advanced"].includes(raw.fetchExtractDepth)) {
        out.fetchExtractDepth = raw.fetchExtractDepth;
      }
      break;
    }
    case "brave": {
      const validEndpoints = ["auto", "llm-context", "web-search"];
      if (typeof raw.endpointPreference === "string" && validEndpoints.includes(raw.endpointPreference)) {
        out.endpointPreference = raw.endpointPreference;
      }
      const validThresholds = ["strict", "balanced", "lenient", "disabled"];
      if (typeof raw.contextThresholdMode === "string" && validThresholds.includes(raw.contextThresholdMode)) {
        out.contextThresholdMode = raw.contextThresholdMode;
      }
      if (typeof raw.contextTokenBudget === "number" && raw.contextTokenBudget >= 1024 && raw.contextTokenBudget <= 32768) {
        out.contextTokenBudget = Math.round(raw.contextTokenBudget);
      }
      break;
    }
    case "you": {
      const validExtractions = ["highlights", "none"];
      if (typeof raw.extractionMode === "string" && validExtractions.includes(raw.extractionMode)) {
        out.extractionMode = raw.extractionMode;
      }
      if (typeof raw.fetchCrawlTimeoutSec === "number" && raw.fetchCrawlTimeoutSec >= 1 && raw.fetchCrawlTimeoutSec <= 60) {
        out.fetchCrawlTimeoutSec = Math.round(raw.fetchCrawlTimeoutSec);
      }
      if (typeof raw.fetchMaxAgeSec === "number" && raw.fetchMaxAgeSec >= 0) {
        out.fetchMaxAgeSec = Math.round(raw.fetchMaxAgeSec);
      }
      break;
    }
    case "firecrawl": {
      if (typeof raw.fetchOnlyMainContent === "boolean") {
        out.fetchOnlyMainContent = raw.fetchOnlyMainContent;
      }
      if (typeof raw.fetchMaxAgeMs === "number" && raw.fetchMaxAgeMs >= 0) {
        out.fetchMaxAgeMs = Math.round(raw.fetchMaxAgeMs);
      }
      break;
    }
    case "parallel": {
      const validModes = ["turbo", "fast", "basic", "advanced"];
      if (typeof raw.mode === "string" && validModes.includes(raw.mode)) {
        out.mode = raw.mode;
      }
      if (typeof raw.maxCharsTotal === "number" && raw.maxCharsTotal >= 1000 && raw.maxCharsTotal <= 200000) {
        out.maxCharsTotal = Math.round(raw.maxCharsTotal);
      }
      break;
    }
    case "jina": {
      const engines = ["auto", "curl", "browser"];
      if (typeof raw.fetchEngine === "string" && engines.includes(raw.fetchEngine)) {
        out.fetchEngine = raw.fetchEngine;
      }
      if (
        typeof raw.fetchCacheToleranceSec === "number" &&
        Number.isFinite(raw.fetchCacheToleranceSec) &&
        raw.fetchCacheToleranceSec >= 0 &&
        raw.fetchCacheToleranceSec <= 30 * 24 * 3600
      ) {
        out.fetchCacheToleranceSec = Math.round(raw.fetchCacheToleranceSec);
      }
      if (
        typeof raw.fetchMaxTokens === "number" &&
        Number.isFinite(raw.fetchMaxTokens) &&
        raw.fetchMaxTokens >= 500 &&
        raw.fetchMaxTokens <= 200_000
      ) {
        out.fetchMaxTokens = Math.round(raw.fetchMaxTokens);
      }
      if (
        typeof raw.fetchTokenBudget === "number" &&
        Number.isFinite(raw.fetchTokenBudget) &&
        raw.fetchTokenBudget >= 500 &&
        raw.fetchTokenBudget <= 200_000
      ) {
        out.fetchTokenBudget = Math.round(raw.fetchTokenBudget);
      }
      if (typeof raw.fetchReaderLmV2 === "boolean") {
        out.fetchReaderLmV2 = raw.fetchReaderLmV2;
      }
      break;
    }
  }

  return out;
}

/** Build the ProviderOptionView for a provider. */
export function buildProviderOptionView(
  provider: string,
  overrides?: Record<string, unknown>
): ProviderOptionView {
  const cleanOverrides = overrides ? sanitizeProviderOptions(provider, overrides) : {};
  const hasOverrides = Object.keys(cleanOverrides).length > 0;

  let effective: Record<string, unknown> = {};
  switch (provider) {
    case "searxng":
      effective = { instances: [], instanceTimeoutMs: 3000, ...cleanOverrides };
      break;
    case "bing":
    case "ddg":
    case "ddg-lite":
      effective = { market: "zh-CN", region: "cn-zh", safeSearch: "moderate", ...cleanOverrides };
      break;
    case "perplexity":
      effective = { model: "sonar", maxTokens: 1024, ...cleanOverrides };
      break;
    case "deepseek-official":
      effective = { model: "deepseek-v4-flash", maxTokens: 4096, ...cleanOverrides };
      break;
    case "exa":
      // maxAgeHours omitted by default (undefined = Exa default cache/livecrawl
      // policy); only included on the wire when the user overrides it.
      effective = { searchType: DEFAULT_EXA_OPTIONS.searchType, ...cleanOverrides };
      break;
    case "tavily":
      effective = { ...DEFAULT_TAVILY_OPTIONS, ...cleanOverrides };
      break;
    case "brave":
      effective = { ...DEFAULT_BRAVE_OPTIONS, ...cleanOverrides };
      break;
    case "you":
      effective = { ...DEFAULT_YOU_OPTIONS, ...cleanOverrides };
      break;
    case "firecrawl":
      effective = { ...DEFAULT_FIRECRAWL_OPTIONS, ...cleanOverrides };
      break;
    case "parallel":
      // maxCharsTotal omitted from effective by default: only included on the
      // wire when the user overrides it (top-level field, not advanced_settings).
      effective = { mode: DEFAULT_PARALLEL_OPTIONS.mode, ...cleanOverrides };
      break;
    case "jina":
      // token/cache numeric fields omitted from effective by default; only
      // fetchEngine and fetchReaderLmV2 have static defaults.
      effective = { fetchEngine: DEFAULT_JINA_OPTIONS.fetchEngine, fetchReaderLmV2: DEFAULT_JINA_OPTIONS.fetchReaderLmV2, ...cleanOverrides };
      break;
    default:
      effective = cleanOverrides;
  }

  return {
    overrides: cleanOverrides,
    effective,
    customized: hasOverrides,
    isDefault: !hasOverrides,
  };
}

/** Resolve only the effective options map for a provider. */
export function resolveEffectiveOptions(provider: string, overrides?: Record<string, unknown>): Record<string, unknown> {
  return buildProviderOptionView(provider, overrides).effective;
}
