/** Instance-owned LRU search results; keys hash credentials and effective request settings. */
import { createHash } from "node:crypto";
/** Hash request identity without retaining raw credentials as cache keys. */
export function searchCacheKey(identity) {
    return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}
/** Stores completed successful results only; callers never share mutable result objects. */
export class SearchCache {
    entries = new Map();
    now;
    constructor(now = Date.now) { this.now = now; }
    /** Read a still-valid result, promoting it to the most recently used entry. */
    get(key, ttlSeconds) {
        if (ttlSeconds <= 0) {
            this.entries.clear();
            return undefined;
        }
        const entry = this.entries.get(key);
        if (!entry)
            return undefined;
        this.entries.delete(key);
        if (entry.expires <= this.now())
            return undefined;
        this.entries.set(key, entry);
        return structuredClone(entry.outcome);
    }
    /** Record one successful result with the configured lifetime and capacity. */
    set(key, outcome, ttlSeconds, capacity) {
        if (ttlSeconds <= 0 || capacity <= 0 || !outcome.sources.length)
            return;
        this.entries.delete(key);
        this.entries.set(key, { expires: this.now() + ttlSeconds * 1000, outcome: structuredClone(outcome) });
        while (this.entries.size > capacity)
            this.entries.delete(this.entries.keys().next().value);
    }
}
