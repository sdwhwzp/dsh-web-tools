import type { SearchOutcome } from "./providers/types.ts";
/** Hash request identity without retaining raw credentials as cache keys. */
export declare function searchCacheKey(identity: unknown): string;
/** Stores completed successful results only; callers never share mutable result objects. */
export declare class SearchCache {
    private readonly entries;
    private readonly now;
    constructor(now?: () => number);
    /** Read a still-valid result, promoting it to the most recently used entry. */
    get(key: string, ttlSeconds: number): SearchOutcome | undefined;
    /** Record one successful result with the configured lifetime and capacity. */
    set(key: string, outcome: SearchOutcome, ttlSeconds: number, capacity: number): void;
}
