/**
 * dsh-web-tools — fenced HTTP routes for the settings card.
 *
 * The browser card talks to this Host plugin through its own `/web-tools/api`
 * prefix (following the proven `dsh-better-sidebar` pattern), which:
 *  - applies the same browser-trust fence as the /api gateway
 *  - never exposes credential values (reads return configured/writable state)
 *  - is the config-authority bridge for namespaces the settings RPC whitelist
 *    does not serve
 *
 * @module
 */
import { searchAuthentication } from "./providers/types.js";
import { poolSummary } from "./pool.js";
import { buildPool, hintOf } from "./pool.js";
import { credRefOf, getProvider, PROVIDER_LIST } from "./providers/index.js";
import { buildProviderOptionView, sanitizeProviderOptions } from "./provider-options.js";
import { createHash } from "node:crypto";
async function handlePlatformStatus(deps) {
    let statuses = await deps.sourceRegistry.getPlatformStatuses();
    // A persisted dedicated profile means the user has completed login before,
    // but cold-start metadata is not authentication proof. Verify it in the
    // background runtime before returning status so the UI never asks the user
    // to manually validate an existing session.
    const needsVerification = statuses.filter((status) => status.sessionEstablished && !status.authenticated && !status.loginPending);
    if (needsVerification.length > 0) {
        const results = await Promise.allSettled(needsVerification.map(async (status) => {
            const isAuth = await deps.nativeRuntime.verifyAuthenticationForOperation(status.id, undefined, status.id === "xiaohongshu" ? "interactive" : "headless");
            return { id: status.id, isAuth };
        }));
        // Reload statuses after verification
        statuses = await deps.sourceRegistry.getPlatformStatuses();
        // For any platform that was verified true in this flight, ensure status reflects authenticated
        for (const res of results) {
            if (res.status === "fulfilled" && res.value.isAuth) {
                const target = statuses.find((s) => s.id === res.value.id);
                if (target) {
                    target.authenticated = true;
                }
            }
        }
    }
    const platforms = {};
    for (const s of statuses) {
        platforms[s.id] = {
            id: s.id,
            name: s.name,
            enabled: s.enabled,
            runtimeAvailable: s.runtimeAvailable,
            runtimeState: s.runtimeState,
            authenticated: s.authenticated,
            sessionEstablished: s.sessionEstablished,
            loginPending: s.loginPending,
            loginUnavailableReason: s.loginUnavailableReason,
            capabilities: s.capabilities,
            account: s.account,
            lastError: s.lastError,
            lastCheckedAt: s.lastCheckedAt,
        };
    }
    return { platforms };
}
async function handlePlatformLogin(deps, payload) {
    const platform = payload?.platform;
    if (platform === "xiaohongshu" || platform === "x") {
        const status = await deps.nativeRuntime.status(platform);
        if (!status.runtimeAvailable || status.loginUnavailableReason) {
            throw new PlatformLoginUnavailable(status.loginUnavailableReason ?? "browser-missing");
        }
        // SessionManager retains pending state and failures for the polling client.
        deps.nativeRuntime.login(platform).catch(() => { });
        return { status: "login-pending" };
    }
    return { status: "unknown_platform" };
}
class PlatformLoginUnavailable extends Error {
}
async function handlePlatformStop(deps, payload) {
    const platform = payload?.platform;
    if (platform === "xiaohongshu" || platform === "x") {
        await deps.nativeRuntime.stop(platform);
        return { ok: true };
    }
    return { ok: false };
}
async function handlePlatformReset(deps, payload) {
    const platform = payload?.platform;
    if (platform === "xiaohongshu" || platform === "x") {
        await deps.nativeRuntime.resetSession(platform);
        return { ok: true };
    }
    return { ok: false };
}
/** Opaque per-key id for the remove-key endpoint (sha1 of the key, 8 hex). */
export function keyIdOf(key) {
    return createHash("sha1").update(key).digest("hex").slice(0, 8);
}
/** Route prefix (client fetches `/web-tools/api/<method>`). */
export const API_PREFIX = "/web-tools/api";
// ---------------------------------------------------------------------------
// response helpers
// ---------------------------------------------------------------------------
function writeJson(res, status, body) {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
}
function writeOk(res, value) {
    writeJson(res, 200, { ok: true, value });
}
function writeError(res, status, code, message) {
    writeJson(res, status, { ok: false, error: { code, message } });
}
/** Read a JSON request body (structural async-iterator like better-sidebar). */
async function readJsonBody(req) {
    let raw = "";
    for await (const chunk of req) {
        raw += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
        if (raw.length > 1_000_000)
            throw new Error("payload too large");
    }
    if (raw.trim() === "")
        return {};
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error("invalid JSON body");
    }
}
/**
 * Configuration-plane browser fence: loopback + same-origin.
 *
 * Unlike the general /api gateway, these routes mutate settings and
 * credentials — DSH treats that plane as privileged and `trustedHosts` is NOT
 * authentication. A LAN host reaching this DSH instance must NOT be able to
 * read or write provider config/keys. A gateway rewrites Host and Origin, so
 * deployment authentication and session access checks also run before dispatch.
 *
 * Mirrors the official fence shape: the Host header is parsed as an authority
 * (handles IPv6 `[::1]:port`), and when an Origin header is present its host
 * must match the request Host (DNS-rebinding defense). Sec-Fetch-Site:
 * cross-site is additionally rejected when the browser declares it.
 */
/** Parse the Host header as an authority; returns hostname (lowercased) or "". */
function authorityHost(hostHeader) {
    if (typeof hostHeader !== "string")
        return "";
    try {
        return new URL(`http://${hostHeader}`).hostname.toLowerCase();
    }
    catch {
        return "";
    }
}
function isLoopbackHost(host) {
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]")
        return true;
    // IPv4 loopback range 127.0.0.0/8
    const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    return v4 !== null && Number(v4[1]) === 127;
}
function isLoopback(req) {
    return isLoopbackHost(authorityHost(req.headers?.host));
}
/**
 * Same-origin check: when an Origin header is present, its host must equal
 * the request Host. Absent Origin → allowed (typed navigation / non-browser).
 */
function isSameOrigin(req) {
    const origin = req.headers?.["origin"];
    if (typeof origin !== "string" || origin.length === 0)
        return true;
    try {
        const originHost = new URL(origin).hostname.toLowerCase();
        const requestHost = authorityHost(req.headers?.host);
        return originHost === requestHost;
    }
    catch {
        return false;
    }
}
/** Reject cross-site browser requests when the browser declares a site. */
function isNotCrossSite(req) {
    const site = req.headers?.["sec-fetch-site"];
    if (typeof site !== "string" || site.length === 0)
        return true;
    return site !== "cross-site";
}
/** A deployment's identity and session decisions take precedence over local trust. */
async function routeRejection(ctx, req, method, payload) {
    const authentication = ctx.get("requestPrincipal");
    const access = ctx.get("principalAccess");
    if (authentication === undefined)
        return access === undefined ? undefined : 403;
    try {
        const principal = await authentication.authenticate(req);
        if (principal === undefined)
            return 401;
        if (principal.role === "admin")
            return undefined;
        if (method !== "search-mode/get" && method !== "search-mode/set")
            return 403;
        if (access === undefined)
            return 403;
        const sessionId = payload?.sessionId;
        if (typeof sessionId !== "string" || sessionId.length === 0)
            return 403;
        const allowed = await access.resolve(principal, { sessionIds: [sessionId] });
        return allowed.readableSessionIds.has(sessionId) ? undefined : 403;
    }
    catch {
        // Authentication or authorization failures never fall back to loopback access.
        return 403;
    }
}
// ---------------------------------------------------------------------------
// endpoint implementations
// ---------------------------------------------------------------------------
async function handleConfigGet(deps) {
    const cfg = deps.readConfig();
    const enabled = cfg.enabled !== false;
    const defaultProvider = cfg.defaultProvider ?? "tavily";
    const enabledMap = cfg.providerEnabled ?? {};
    const baseUrls = cfg.providerBaseUrls ?? {};
    const providerOpts = cfg.providerOptions ?? {};
    const platformEnabled = cfg.platformEnabled ?? { xiaohongshu: true, x: true };
    const credentialsSnapshots = await Promise.all(PROVIDER_LIST.map(async (meta) => {
        const ref = credRefOf(meta.name);
        const cred = await deps.readCredential(ref);
        return { meta, ref, cred };
    }));
    const providers = [];
    for (const { meta, ref, cred } of credentialsSnapshots) {
        const pool = deps.poolEntries ? await deps.poolEntries(meta.name) : buildPool(cred.value ?? "");
        providers.push({
            authentication: searchAuthentication(meta),
            excludedByMode: cfg.searchAccessMode === "free-only" && searchAuthentication(meta) === "required",
            accountSearchEnabled: cfg.searchAccessMode !== "free-only" && searchAuthentication(meta) !== "none",
            name: meta.name,
            label: meta.label,
            description: meta.description,
            enabled: enabledMap[meta.name] !== false,
            baseUrl: baseUrls[meta.name] ?? meta.defaultBaseUrl,
            baseUrlConfigured: (typeof baseUrls[meta.name] === "string" && baseUrls[meta.name].trim().length > 0) || (meta.name === "searxng" && Array.isArray(providerOpts.searxng?.instances) && providerOpts.searxng.instances.length > 0),
            credRef: ref,
            keyConfigured: cred.configured,
            keyWritable: cred.writable,
            keyHint: pool.length > 0 ? poolSummary(pool)[0].hint : undefined,
            poolSize: pool.length,
            keys: pool.map((e) => ({ id: keyIdOf(e.key), hint: hintOf(e.key), healthy: e.healthy })),
            options: buildProviderOptionView(meta.name, providerOpts[meta.name]),
        });
    }
    return {
        searchAccessMode: cfg.searchAccessMode ?? "api-first",
        cacheTtlSeconds: cfg.cacheTtlSeconds ?? 300,
        cacheMaxEntries: cfg.cacheMaxEntries ?? 50,
        publicPlatformLanguage: cfg.publicPlatformLanguage ?? "zh",
        enabled,
        defaultProvider,
        providerAttemptTimeoutMs: cfg.providerAttemptTimeoutMs ?? 10000,
        fallbackOrder: cfg.fallbackOrder ?? [],
        proxy: deps.proxyStatus ? await deps.proxyStatus() : undefined,
        searchRoutingPolicy: cfg.searchRoutingPolicy ?? "ordered",
        platformEnabled,
        providers,
    };
}
async function handleConfigSave(deps, payload) {
    const p = (payload ?? {});
    const patch = {};
    if (p.searchAccessMode !== undefined) {
        if (typeof p.searchAccessMode !== "string" || !["free-only", "free-first", "api-first"].includes(p.searchAccessMode))
            throw new Error("Invalid search access mode");
        patch.searchAccessMode = p.searchAccessMode;
    }
    for (const [name, min, max] of [["cacheTtlSeconds", 0, 300], ["cacheMaxEntries", 1, 500]]) {
        if (p[name] === undefined)
            continue;
        if (typeof p[name] !== "number" || !Number.isInteger(p[name]) || p[name] < min || p[name] > max)
            throw new Error(`Invalid ${name}`);
        patch[name] = p[name];
    }
    if (p.publicPlatformLanguage !== undefined) {
        if (p.publicPlatformLanguage !== "zh" && p.publicPlatformLanguage !== "en")
            throw new Error("Invalid public platform language");
        patch.publicPlatformLanguage = p.publicPlatformLanguage;
    }
    if (typeof p.enabled === "boolean")
        patch.enabled = p.enabled;
    if (typeof p.defaultProvider === "string")
        patch.defaultProvider = p.defaultProvider;
    if (typeof p.providerAttemptTimeoutMs === "number")
        patch.providerAttemptTimeoutMs = p.providerAttemptTimeoutMs;
    if (Array.isArray(p.fallbackOrder))
        patch.fallbackOrder = p.fallbackOrder;
    if (p.providerBaseUrls && typeof p.providerBaseUrls === "object")
        patch.providerBaseUrls = p.providerBaseUrls;
    if (p.providerEnabled && typeof p.providerEnabled === "object")
        patch.providerEnabled = p.providerEnabled;
    if (p.platformEnabled && typeof p.platformEnabled === "object") {
        patch.platformEnabled = p.platformEnabled;
    }
    if (p.providerOptions !== undefined) {
        if (!p.providerOptions || typeof p.providerOptions !== "object" || Array.isArray(p.providerOptions))
            throw new Error("Invalid provider options");
        patch.providerOptions = Object.fromEntries(Object.entries(p.providerOptions).map(([name, value]) => {
            getProvider(name);
            if (!value || typeof value !== "object" || Array.isArray(value))
                throw new Error("Invalid provider options");
            return [name, sanitizeProviderOptions(name, value)];
        }));
    }
    await deps.writeConfig(patch); // persist BEFORE reporting success
    if (patch.platformEnabled)
        deps.sourceRegistry.setPlatformEnabled(patch.platformEnabled);
    return { saved: true };
}
/** Dedicated routing edit: policy + ordered provider list in ONE atomic write. */
async function handleRoutingSet(deps, payload) {
    const p = (payload ?? {});
    const policy = p.policy;
    if (policy !== "ordered" && policy !== "round-robin" && policy !== "random") {
        throw new Error("invalid routing policy");
    }
    if (!Array.isArray(p.orderedProviders) || p.orderedProviders.length === 0) {
        throw new Error("orderedProviders required");
    }
    const seen = new Set();
    const ordered = [];
    for (const raw of p.orderedProviders) {
        const name = String(raw).trim().toLowerCase();
        if (name === "" || seen.has(name))
            continue;
        // Validate against the registry before persisting.
        getProvider(name);
        seen.add(name);
        ordered.push(name);
    }
    if (ordered.length === 0)
        throw new Error("no valid providers");
    await deps.writeConfig({
        searchRoutingPolicy: policy,
        defaultProvider: ordered[0],
        fallbackOrder: ordered.slice(1),
    });
    return { saved: true, policy, defaultProvider: ordered[0], fallbackOrder: ordered.slice(1) };
}
async function handleCredentialSet(deps, payload) {
    const p = (payload ?? {});
    if (!p.provider)
        throw new Error("missing provider");
    getProvider(p.provider); // validate
    const ref = credRefOf(p.provider);
    await deps.writeCredential(ref, p.value ?? "");
    const entries = buildPool(p.value ?? "");
    return { configured: entries.length > 0, poolSize: entries.length };
}
/** Append ONE key to a provider's pool (storage stays a comma-joined string). */
async function handleCredentialAddKey(deps, payload) {
    const p = (payload ?? {});
    if (!p.provider)
        throw new Error("missing provider");
    getProvider(p.provider); // validate
    const value = typeof p.value === "string" ? p.value.trim() : "";
    if (value.length === 0)
        throw new Error("missing key value");
    const ref = credRefOf(p.provider);
    const cred = await deps.readCredential(ref);
    const entries = buildPool(cred.value ?? "");
    if (entries.some((e) => e.key === value))
        throw new Error("key already configured");
    const next = [...entries.map((e) => e.key), value].join(",");
    await deps.writeCredential(ref, next);
    const pool = buildPool(next);
    return { configured: pool.length > 0, poolSize: pool.length };
}
/** Remove ONE key from a provider's pool by its opaque key id. */
async function handleCredentialRemoveKey(deps, payload) {
    const p = (payload ?? {});
    if (!p.provider)
        throw new Error("missing provider");
    getProvider(p.provider); // validate
    if (typeof p.keyId !== "string" || p.keyId.length === 0)
        throw new Error("missing key id");
    const ref = credRefOf(p.provider);
    const cred = await deps.readCredential(ref);
    const entries = buildPool(cred.value ?? "");
    const match = entries.find((e) => keyIdOf(e.key) === p.keyId);
    if (match === undefined)
        throw new Error("key not found");
    const next = entries.filter((e) => e !== match).map((e) => e.key).join(",");
    await deps.writeCredential(ref, next);
    const pool = buildPool(next);
    return { configured: pool.length > 0, poolSize: pool.length };
}
async function handleCredentialDescribe(deps) {
    const out = {};
    for (const meta of PROVIDER_LIST) {
        const ref = credRefOf(meta.name);
        const cred = await deps.readCredential(ref);
        out[ref] = { configured: cred.configured, source: cred.source, writable: cred.writable };
    }
    return { credentials: out };
}
async function handleTestProvider(deps, payload) {
    const p = (payload ?? {});
    if (!p.provider)
        throw new Error("missing provider");
    return deps.testProviderSearch(p.provider, p.query ?? "OpenAI");
}
async function handleTestSearch(deps, payload) {
    const p = (payload ?? {});
    if (!p.query || !p.query.trim())
        throw new Error("missing query");
    return deps.testFullSearch(p.query);
}
async function handleQuotaDescribe(deps, payload) {
    const force = payload?.force === true;
    return { quotas: await deps.describeQuotas(force) };
}
async function handleVersionCheck(deps) {
    if (!deps.checkVersion)
        throw new Error("version check unavailable");
    return deps.checkVersion();
}
async function handleSearchModeGet(deps, payload) {
    const sessionId = String(payload?.sessionId ?? "");
    if (!sessionId)
        throw new Error("missing sessionId");
    if (!deps.searchMode)
        throw new Error("search-mode runtime unavailable");
    return deps.searchMode.view(sessionId);
}
async function handleSearchModeSet(deps, payload) {
    const p = (payload ?? {});
    const sessionId = String(p.sessionId ?? "");
    const mode = p.mode;
    if (!sessionId)
        throw new Error("missing sessionId");
    if (mode !== "auto" && mode !== "required")
        throw new Error("invalid mode");
    if (!deps.searchMode)
        throw new Error("search-mode runtime unavailable");
    return deps.searchMode.set(sessionId, mode);
}
async function handleProviderOptionsSet(deps, payload) {
    const p = (payload ?? {});
    const provider = String(p.provider ?? "").trim().toLowerCase();
    if (!provider)
        throw new Error("missing provider");
    const meta = PROVIDER_LIST.find((m) => m.name === provider);
    if (!meta)
        throw new Error(`unknown provider: ${provider}`);
    const rawOpts = (p.options && typeof p.options === "object") ? p.options : {};
    const cleaned = sanitizeProviderOptions(provider, rawOpts);
    const cfg = deps.readConfig();
    const currentMerged = { ...(cfg.providerOptions ?? {}) };
    currentMerged[provider] = cleaned;
    await deps.writeConfig({ providerOptions: currentMerged });
    return buildProviderOptionView(provider, cleaned);
}
async function handleProviderOptionsBatchSet(deps, payload) {
    const p = (payload ?? {});
    if (!p.providers || typeof p.providers !== "object")
        throw new Error("missing providers");
    // Validate all provider names first (atomic: reject the whole batch if any
    // name is unknown) then sanitize every option payload.
    const sanitized = new Map();
    for (const [rawName, rawOptions] of Object.entries(p.providers)) {
        const provider = rawName.trim().toLowerCase();
        const meta = PROVIDER_LIST.find((m) => m.name === provider);
        if (!meta)
            throw new Error(`unknown provider: ${provider}`);
        if (rawOptions === null) {
            sanitized.set(provider, null);
        }
        else if (typeof rawOptions === "object") {
            sanitized.set(provider, sanitizeProviderOptions(provider, rawOptions));
        }
        else {
            throw new Error(`invalid options for ${provider}`);
        }
    }
    // Single read + mutate + write: atomic.
    const cfg = deps.readConfig();
    const current = { ...(cfg.providerOptions ?? {}) };
    for (const [provider, options] of sanitized) {
        if (options === null) {
            delete current[provider];
        }
        else {
            current[provider] = options;
        }
    }
    await deps.writeConfig({ providerOptions: current });
    return Object.fromEntries([...sanitized.keys()].map((provider) => [
        provider,
        buildProviderOptionView(provider, current[provider]),
    ]));
}
async function handleProviderOptionsReset(deps, payload) {
    const p = (payload ?? {});
    const provider = String(p.provider ?? "").trim().toLowerCase();
    if (!provider)
        throw new Error("missing provider");
    const meta = PROVIDER_LIST.find((m) => m.name === provider);
    if (!meta)
        throw new Error(`unknown provider: ${provider}`);
    const cfg = deps.readConfig();
    const currentMerged = { ...(cfg.providerOptions ?? {}) };
    delete currentMerged[provider];
    await deps.writeConfig({ providerOptions: currentMerged });
    return buildProviderOptionView(provider, undefined);
}
// ---------------------------------------------------------------------------
// route registration
// ---------------------------------------------------------------------------
const ENDPOINTS = {
    "config/get": (deps) => handleConfigGet(deps),
    "config/save": (deps, payload) => handleConfigSave(deps, payload),
    "credentials/set": (deps, payload) => handleCredentialSet(deps, payload),
    "credentials/add-key": (deps, payload) => handleCredentialAddKey(deps, payload),
    "credentials/remove-key": (deps, payload) => handleCredentialRemoveKey(deps, payload),
    "credentials/describe": (deps) => handleCredentialDescribe(deps),
    "test/provider": (deps, payload) => handleTestProvider(deps, payload),
    "test/search": (deps, payload) => handleTestSearch(deps, payload),
    "quota/describe": (deps, payload) => handleQuotaDescribe(deps, payload),
    "version/check": (deps) => handleVersionCheck(deps),
    "search-mode/get": (deps, payload) => handleSearchModeGet(deps, payload),
    "search-mode/set": (deps, payload) => handleSearchModeSet(deps, payload),
    "provider-options/set": (deps, payload) => handleProviderOptionsSet(deps, payload),
    "provider-options/reset": (deps, payload) => handleProviderOptionsReset(deps, payload),
    "provider-options/batch": (deps, payload) => handleProviderOptionsBatchSet(deps, payload),
    "routing/set": (deps, payload) => handleRoutingSet(deps, payload),
    "platform/status": (deps) => handlePlatformStatus(deps),
    "platform/login": (deps, payload) => handlePlatformLogin(deps, payload),
    "platform/stop": (deps, payload) => handlePlatformStop(deps, payload),
    "platform/reset": (deps, payload) => handlePlatformReset(deps, payload),
    "remote-login/start": async (deps, payload) => {
        const { platform } = remoteLoginRequest(payload, false);
        return deps.nativeRuntime.startRemoteLogin(platform);
    },
    "remote-login/frame": async (deps, payload) => {
        const { platform, id } = remoteLoginRequest(payload, true);
        return deps.nativeRuntime.remoteLoginFrame(platform, id);
    },
    "remote-login/input": async (deps, payload) => {
        const { platform, id, input } = remoteLoginRequest(payload, true);
        await deps.nativeRuntime.remoteLoginInput(platform, id, input);
        return { ok: true };
    },
    "remote-login/close": async (deps, payload) => {
        const { platform, id } = remoteLoginRequest(payload, true);
        await deps.nativeRuntime.closeRemoteLogin(platform, id);
        return { ok: true };
    },
};
function remoteLoginRequest(payload, requireId) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new Error("Invalid remote login request");
    const value = payload;
    if (value.platform !== "x" && value.platform !== "xiaohongshu")
        throw new Error("Invalid remote login platform");
    if (requireId && (typeof value.id !== "string" || !/^[a-f0-9-]{36}$/.test(value.id)))
        throw new Error("Invalid remote login session");
    return { platform: value.platform, id: typeof value.id === "string" ? value.id : "", input: value.input };
}
/** Register the fenced `/web-tools/api` prefix. Returns the disposer. */
export function registerRoutes(ctx, deps) {
    return ctx.webServer.register({
        kind: "prefix",
        path: API_PREFIX,
        handler: async (req, res) => {
            // Configuration plane: loopback-only + same-origin, never trustedHosts.
            if (!isLoopback(req) || !isSameOrigin(req) || !isNotCrossSite(req)) {
                writeError(res, 403, "forbidden", "forbidden");
                return;
            }
            if (req.method !== "POST") {
                writeError(res, 405, "method-error", "method not allowed");
                return;
            }
            const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
            // Endpoint names carry a slash ("config/get", "test/search"); take the
            // whole remaining path after the prefix as the method key.
            const method = pathname.startsWith(`${API_PREFIX}/`) ? pathname.slice(API_PREFIX.length + 1) : undefined;
            if (method === undefined || method.length === 0) {
                writeError(res, 404, "not-found", "unknown web-tools API method");
                return;
            }
            const handler = Object.hasOwn(ENDPOINTS, method) ? ENDPOINTS[method] : undefined;
            if (handler === undefined) {
                writeError(res, 404, "not-found", `unknown web-tools API method "${method}"`);
                return;
            }
            try {
                const payload = await readJsonBody(req);
                const rejection = await routeRejection(ctx, req, method, payload);
                if (rejection !== undefined) {
                    writeError(res, rejection, "forbidden", "forbidden");
                    return;
                }
                writeOk(res, await handler(deps, payload));
            }
            catch (e) {
                if (e instanceof PlatformLoginUnavailable) {
                    writeError(res, 409, e.message, e.message);
                }
                else {
                    writeError(res, 500, "internal", e instanceof Error ? e.message : String(e));
                }
            }
        },
    });
}
