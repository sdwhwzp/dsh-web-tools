/** Public platform APIs adapted from dsh-free-search; see THIRD_PARTY_NOTICES.md. */
import { type PublicPlatform } from "../shared/search-policy.ts";
import { type SearchOutcome } from "./providers/types.ts";
/** Match an explicit platform prefix; a platform name appearing in a topic does not route it. */
export declare function publicPlatformQuery(query: string): {
    platform: PublicPlatform;
    query: string;
} | undefined;
/** Search a public platform; V2EX only filters the current hot-topic feed. */
export declare function searchPublicPlatform(platform: PublicPlatform, query: string, limit: number, signal?: AbortSignal, language?: string): Promise<SearchOutcome>;
