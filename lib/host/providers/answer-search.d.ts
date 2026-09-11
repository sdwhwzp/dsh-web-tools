/** Citation-producing search APIs adapted from dsh-free-search; see THIRD_PARTY_NOTICES.md. */
import { type ProviderAdapter } from "./types.ts";
/** Perplexity Sonar search with its answer and source citations. */
export declare const PerplexityProvider: ProviderAdapter;
/** DeepSeek's hosted web-search tool, using a separate search credential. */
export declare const DeepSeekOfficialProvider: ProviderAdapter;
