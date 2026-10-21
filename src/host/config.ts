/**
 * dsh-web-tools — Host configuration: settings namespace + schema.
 *
 * The config (non-secret knobs) lives on the Loader profile row in Harness 0.1.7+
 * and in a `dsh-web-tools` settings namespace on older hosts. It is
 * registered through the settings service, so it persists with the deployment's
 * settings document. API keys are NOT here — they live in the credentials
 * domain (`WEB_TOOLS_*` refs).
 * @module
 */
import z from "@deepseek-ai/schemastery";
import type { WebToolsContext } from "./context-types.ts";
import type { QuotaSnapshot } from "./quota.ts";
import type { StoredProviderOptions } from "../shared/provider-options.ts";
import type { SearchRoutingPolicy } from "../shared/api-types.ts";
import type { SearchAccessMode } from "../shared/search-policy.ts";
import { DEFAULT_BROWSER_SETTINGS, type BrowserSettings } from "./browser/remote-login.ts";
import type { CustomProviderConfig } from "../shared/custom-provider-types.ts";
import type { OutboundAuthorization } from "./provider-transport.ts";
import { loadCustomProviders } from "./custom-provider-schema.ts";

/** Persistent search routing policy id (shared with the client card). */
export type ToolSearchRoutingPolicy = SearchRoutingPolicy;

/** Settings namespace for this plugin. */
export const SETTINGS_NS = "dsh-web-tools";

/** Default provider when nothing is configured. Changed from tavily to exa
 *  based on P5 evaluation: Exa achieves 72.2% Top-1, 97.2% Top-3 evidence,
 *  75% official source hit, 0% generic, 0% error across 36 tasks.
 *  This only affects new installs — existing users keep their saved provider. */
export const DEFAULT_PROVIDER = "exa";

/**
 * Explicit defaults. The resolved settings type is `WebToolsSettings` (below);
 * `Config` is the schemastery schema annotated the official way
 * (`z<WebToolsSettings>`) so the emitted d.ts references only `schemastery`,
 * never the dsh-private cosmokit copy.
 */
export const DEFAULT_SETTINGS = {
  ...DEFAULT_BROWSER_SETTINGS,
  searchAccessMode: "api-first" as SearchAccessMode,
  cacheTtlSeconds: 300,
  cacheMaxEntries: 50,
  publicPlatformLanguage: "zh" as "zh" | "en",
  enabled: true,
  defaultProvider: DEFAULT_PROVIDER,
  // Per-attempt budget for ONE provider call (the DSH tool owns the overall
  // web_search timeout). Distinct from tool-level timeout: this is how long a
  // single provider may run before we abort it and try the next one.
  providerAttemptTimeoutMs: 10000,
  fallbackOrder: ["bing", "ddg", "ddg-lite", "anysearch", "tavily", "keenable"] as string[],
  providerBaseUrls: {} as Record<string, string>,
  providerEnabled: {} as Record<string, boolean>,
  platformEnabled: { xiaohongshu: true, x: true } as Record<string, boolean>,
  providerOptions: {} as StoredProviderOptions,
  // Brave has NO quota endpoint — its only quota signal is the X-RateLimit-*
  // response header captured during a real search. Persisted here so a
  // restart does not forget the last known balance (keyed by API key).
  braveQuotaCache: {} as Record<string, QuotaSnapshot>,
  // Search routing policy: how the runtime picks the starting provider per
  // search query. "ordered" = always from the first available; "round-robin"
  // and "random" rotate the start offset (see routing-policy.ts).
  searchRoutingPolicy: "ordered" as ToolSearchRoutingPolicy,
  // Operator-defined search sources (Issue #9). Kept in their OWN array rather
  // than merged into providerBaseUrls/providerEnabled: a merge would force a
  // migration of every existing profile for no benefit, and custom sources
  // carry structure (protocol, auth, mapping) the flat maps cannot express.
  customProviders: [] as CustomProviderConfig[],
  /** Operator-granted outbound destinations for internal gateways / private IPs. */
  outboundAuthorizations: [
    { host: "127.0.0.1", port: 8080, allowPrivate: true, allowHttp: true, note: "SearXNG default instance" },
    { host: "localhost", port: 8080, allowPrivate: true, allowHttp: true, note: "SearXNG default instance" },
  ] as OutboundAuthorization[],
};

/** Resolved settings shape (explicit interface — portable in emitted d.ts). */
export interface WebToolsSettings extends BrowserSettings {
  searchAccessMode: SearchAccessMode;
  cacheTtlSeconds: number;
  cacheMaxEntries: number;
  publicPlatformLanguage: "zh" | "en";
  enabled: boolean;
  defaultProvider: string;
  providerAttemptTimeoutMs: number;
  fallbackOrder: string[];
  providerBaseUrls: Record<string, string>;
  providerEnabled: Record<string, boolean>;
  platformEnabled: Record<string, boolean>;
  providerOptions: StoredProviderOptions;
  /** Brave per-key quota snapshots captured from search response headers. */
  braveQuotaCache: Record<string, QuotaSnapshot>;
  /** Search routing policy (see shared api-types). */
  searchRoutingPolicy: ToolSearchRoutingPolicy;
  /** Operator-defined custom search sources (Issue #9). */
  customProviders: CustomProviderConfig[];
  /** Operator-granted outbound destinations for internal gateways / private IPs. */
  outboundAuthorizations?: OutboundAuthorization[];
}

/** The schema object for settings registration (official z<T> annotation). */
export const Config: z<WebToolsSettings> = z.object({
  browserExecutable: z.string(),
  browserDisplay: z.string(),
  browserXauthority: z.string(),
  remoteLoginWidth: z.number().step(1).min(640).max(1920),
  remoteLoginHeight: z.number().step(1).min(480).max(1080),
  remoteLoginTimeoutMs: z.number().step(1).min(30000).max(900000),
  remoteLoginIdleTimeoutMs: z.number().step(1).min(10000).max(300000),
  remoteLoginPollIntervalMs: z.number().step(1).min(250).max(5000),
  remoteLoginQuality: z.number().step(1).min(30).max(95),
  searchAccessMode: z.union([z.const("free-only"), z.const("free-first"), z.const("api-first")]),
  cacheTtlSeconds: z.number().step(1).min(0).max(300),
  cacheMaxEntries: z.number().step(1).min(1).max(500),
  publicPlatformLanguage: z.union([z.const("zh"), z.const("en")]),
  enabled: z.boolean(),
  defaultProvider: z.string(),
  providerAttemptTimeoutMs: z.number().step(1).min(1000).max(60000),
  fallbackOrder: z.array(z.string()),
  providerBaseUrls: z.dict(z.string()),
  providerEnabled: z.dict(z.boolean()),
  platformEnabled: z.dict(z.boolean()),
  providerOptions: z.dict(z.any()),
  braveQuotaCache: z.dict(z.any()),
  searchRoutingPolicy: z.union([z.const("ordered"), z.const("round-robin"), z.const("random")]),
  // Validated structurally on load; a bad entry is dropped, never thrown, so a
  // hand-edited profile cannot make the plugin fail to register.
  customProviders: z.array(z.any()),
  outboundAuthorizations: z.array(z.any()),
});
// Loader exposes live getter nodes instead of restarting the plugin on edits.
Config.meta.volatile = true;

function unwrapConfig(value: unknown): unknown {
  if (value !== null && typeof value === "object") {
    if ("get" in value && typeof value.get === "function") return unwrapConfig(value.get());
    if (Array.isArray(value)) return value.map(unwrapConfig);
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, unwrapConfig(field)]));
  }
  return value;
}

function resolveSettings(value: unknown): WebToolsSettings {
  const fields = unwrapConfig(value);
  // The Loader or settings schema validates values; undefined fields keep defaults.
  const resolved = { ...DEFAULT_SETTINGS, ...Object.fromEntries(
    Object.entries(fields ?? {}).filter(([, field]) => field !== undefined),
  ) };
  return { ...resolved, providerBaseUrls: sanitizeBaseUrlOverrides(resolved.providerBaseUrls),
    customProviders: loadCustomProviders(resolved.customProviders),
    outboundAuthorizations: Array.isArray(resolved.outboundAuthorizations) ? resolved.outboundAuthorizations : [],
  };
}

/** A settings-scope handle: current value + write path. */
export interface ConfigHandle {
  /** Resolve the current effective section (re-read each call → live edits apply). */
  read: () => WebToolsSettings;
  /** Persist a patch using the current Loader row revision or legacy namespace. */
  write: (patch: Partial<WebToolsSettings>) => Promise<void>;
  /**
   * Run after settings mount, immediately if already mounted.
   * Use it for boot work that needs the settings service; reads before mount
   * resolve the initial Loader configuration and defaults.
   */
  onMounted: (cb: () => void) => void;
}

/**
 * Keep only usable base-URL overrides.
 *
 * A malformed override must never reach an adapter: an entry that is not an
 * absolute http(s) URL is dropped (which restores the official endpoint) rather
 * than being passed down and failing at request time.
 */
export function sanitizeBaseUrlOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed === "") continue; // an empty override means "restore default"
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (parsed.username || parsed.password) continue;
      out[key] = parsed.href.replace(/\/+$/, "");
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Register the settings namespace; returns a handle for reads (live) and
 * Host-side writes. The browser card writes through the fenced routes, never
 * through settings/mutate (that proxy's whitelist excludes third-party
 * namespaces).
 */
export function installConfig(ctx: WebToolsContext, initialConfig?: unknown): ConfigHandle {
  let current = () => resolveSettings(initialConfig);
  let scope: { update: (patch: object) => Promise<void> } | undefined;
  let mounted = false;
  const mountedCbs: Array<() => void> = [];

  ctx.inject(["settings"], (sctx) => {
    const service = sctx.settings;
    if (typeof service.register === "function") {
      const registered = service.register(SETTINGS_NS, Config, { base: resolveSettings(initialConfig) });
      scope = registered;
      current = () => resolveSettings(registered.get());
    } else {
      current = () => {
        const id = ctx.fiber?.entry?.options.id;
        const row = id === undefined ? undefined : service.describe().find(row => row.ns === id);
        return resolveSettings(row?.value ?? ctx.fiber?.config ?? initialConfig);
      };
      scope = { update: async (patch) => {
        const id = ctx.fiber?.entry?.options.id;
        if (id === undefined) throw new Error("dsh-web-tools settings require a Loader profile entry");
        const row = service.describe().find(row => row.ns === id);
        if (row === undefined) throw new Error("dsh-web-tools profile settings form is unavailable");
        await service.update(id, patch, row.revision);
      } };
      if (service.configure) {
        // Own the presentation policy with the injected service lifetime.
        sctx.effect(() => service.configure!({ auto: false }, ctx.fiber));
      }
    }
    mounted = true;
    for (const cb of mountedCbs.splice(0)) cb();
  });

  return {
    read: () => current(),
    write: async (patch) => {
      if (!scope) throw new Error("dsh-web-tools settings namespace is not mounted");
      const normalized: Partial<WebToolsSettings> = { ...patch };
      if (patch.providerBaseUrls !== undefined) {
        normalized.providerBaseUrls = sanitizeBaseUrlOverrides(patch.providerBaseUrls);
      }
      if (patch.customProviders !== undefined) {
        normalized.customProviders = loadCustomProviders(patch.customProviders);
      }
      if (patch.outboundAuthorizations !== undefined) {
        normalized.outboundAuthorizations = Array.isArray(patch.outboundAuthorizations) ? patch.outboundAuthorizations : [];
      }

      await scope.update(normalized);
    },
    onMounted: (cb) => {
      if (mounted) cb();
      else mountedCbs.push(cb);
    },
  };
}
