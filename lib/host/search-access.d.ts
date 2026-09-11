/** Build anonymous and account search attempts while preserving order inside each group. */
import type { SearchAccessMode } from "../shared/search-policy.ts";
import { type ProviderMeta } from "./providers/types.ts";
/** One search source and the authentication path to use. */
export interface SearchAttempt {
    provider: string;
    anonymous: boolean;
}
/** Only configured-chain providers participate; free-only never creates account attempts. */
export declare function searchAttempts(chain: string[], mode: SearchAccessMode, providers: Record<string, Pick<ProviderMeta, "authentication" | "needsBaseUrl" | "fetchCapable">>): SearchAttempt[];
