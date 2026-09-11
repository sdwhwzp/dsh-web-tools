import type { WebToolsContext } from "./context-types.ts";
import { type PoolEntry } from "./pool.ts";
import type { QuotaSnapshot } from "./quota.ts";
import type { SearchMode, SearchModeView, VersionCheckView } from "../shared/api-types.ts";
import type { SpecializedSourceRegistry } from "./sources/registry.ts";
/** Opaque per-key id for the remove-key endpoint (sha1 of the key, 8 hex). */
export declare function keyIdOf(key: string): string;
/** Route prefix (client fetches `/web-tools/api/<method>`). */
export declare const API_PREFIX = "/web-tools/api";
/** Dependencies the routes need (injected from the plugin entry). */
export interface RouteDeps {
    readConfig: () => Record<string, unknown>;
    writeConfig: (patch: Record<string, unknown>) => Promise<void>;
    readCredential: (ref: string) => Promise<{
        configured: boolean;
        source?: string;
        writable: boolean;
        value?: string;
    }>;
    writeCredential: (ref: string, value: string) => Promise<void>;
    testProviderSearch: (provider: string, query: string) => Promise<Record<string, unknown>>;
    testFullSearch: (query: string) => Promise<Record<string, unknown>>;
    describeQuotas: (force?: boolean) => Promise<Record<string, QuotaSnapshot>>;
    nativeRuntime: import("./browser/types.ts").NativeBrowserRuntime;
    sourceRegistry: SpecializedSourceRegistry;
    /**
     * Live pool entries for one provider (real key health from the executor),
     * so the card's per-key state matches what search actually uses.
     */
    poolEntries?: (provider: string) => Promise<PoolEntry[]>;
    /** Proxy support status (configured + whether undici is loadable). */
    proxyStatus?: () => Promise<{
        configured: boolean;
        degraded: boolean;
    }>;
    /** Cached, failure-tolerant GitHub release check. */
    checkVersion?: () => Promise<VersionCheckView>;
    /** Search-Mode runtime access (see search-mode-runtime.ts). */
    searchMode?: {
        view(sessionId: string): SearchModeView;
        set(sessionId: string, mode: SearchMode): SearchModeView;
    };
}
/** Register the fenced `/web-tools/api` prefix. Returns the disposer. */
export declare function registerRoutes(ctx: WebToolsContext, deps: RouteDeps): () => void;
