/** Free search adapters adapted from dsh-free-search; see THIRD_PARTY_NOTICES.md. */
import { parseHTML } from "linkedom";
import { fetchWithProxy } from "../fetch-proxy.js";
import { providerError, resolveContext, throwIfHttp } from "./types.js";
import { mcpText, normalizeSources, record, records, searchJson, searchMcp, searchText, string } from "./search-response.js";
const HTML_ENDPOINTS = {
    bing: "https://www.bing.com/search",
    ddg: "https://html.duckduckgo.com/html/",
    "ddg-lite": "https://lite.duckduckgo.com/lite/",
};
/** Search-only providers use the shared generic page fetcher. */
export async function unsupportedFetch() {
    throw providerError("config", "This source does not provide native page extraction");
}
/** Resolve search-engine redirect URLs without visiting the redirector. */
function resultUrl(href, base) {
    let url;
    try {
        url = new URL(href, base);
    }
    catch {
        return "";
    }
    if (url.hostname.endsWith("duckduckgo.com"))
        return url.searchParams.get("uddg") ?? "";
    if (url.hostname === "www.bing.com" && url.pathname === "/ck/a") {
        const encoded = url.searchParams.get("u");
        return encoded?.startsWith("a1") ? Buffer.from(encoded.slice(2), "base64url").toString("utf8") : "";
    }
    return url.href;
}
/** Parse organic Bing or DuckDuckGo HTML; changed markup and challenges trigger fallback. */
export function parseHtmlSearch(engine, html, limit) {
    const { document } = parseHTML(html);
    const selector = engine === "bing" ? "li.b_algo h2 a" : engine === "ddg" ? ".result__a" : ".result-link";
    const links = Array.from(document.querySelectorAll(selector));
    if (!links.length && /captcha|anomaly|unusual traffic|robot check|challenge-form/i.test(html)) {
        throw providerError("rate-limit", `${engine} requires a browser verification`);
    }
    const snippets = Array.from(document.querySelectorAll(".result-snippet"));
    const sources = links.map((link, index) => {
        const block = link.closest(engine === "bing" ? "li.b_algo" : ".result");
        return {
            url: resultUrl(link.getAttribute("href") ?? "", HTML_ENDPOINTS[engine]),
            title: link.textContent?.trim() ?? "",
            snippet: (block?.querySelector(engine === "bing" ? "p" : ".result__snippet")?.textContent ?? snippets[index]?.textContent ?? "").replace(/\s+/g, " ").trim(),
        };
    });
    const normalized = normalizeSources(sources, limit);
    if (!normalized.length)
        throw providerError("invalid-response", `${engine} returned no usable search results`);
    return normalized;
}
function htmlProvider(name, label) {
    return {
        name, label, description: "Public search results without an API key", credSuffix: name.toUpperCase().replaceAll("-", "_"),
        authentication: "none", fetchCapable: false, needsBaseUrl: false,
        async search(query, maxResults, _key, _base, context) {
            const { signal, options, hints } = resolveContext(context);
            signal?.throwIfAborted();
            const params = new URLSearchParams({ q: query });
            if (name === "bing") {
                params.set("mkt", options?.market ?? "zh-CN");
                if (options?.safeSearch)
                    params.set("adlt", options.safeSearch);
            }
            else {
                params.set("kl", options?.region ?? "cn-zh");
                params.set("kp", options?.safeSearch === "strict" ? "1" : options?.safeSearch === "off" ? "-2" : "-1");
                const preset = hints?.freshness?.preset;
                if (preset)
                    params.set("df", { day: "d", week: "w", month: "m", year: "y" }[preset]);
            }
            const response = await fetchWithProxy(`${HTML_ENDPOINTS[name]}?${params}`, {
                signal, headers: { "user-agent": "Mozilla/5.0 (compatible; dsh-web-tools)", "accept-language": options?.market ?? "zh-CN,zh;q=0.9,en;q=0.8" },
            });
            throwIfHttp(label, response);
            if (response.status === 202)
                throw providerError("rate-limit", `${label} requires browser verification`);
            return { sources: parseHtmlSearch(name, await searchText(response), maxResults ?? 8) };
        },
        fetch: unsupportedFetch,
    };
}
/** Public Bing HTML search. */
export const BingProvider = htmlProvider("bing", "Bing");
/** Public DuckDuckGo HTML search. */
export const DdgProvider = htmlProvider("ddg", "DuckDuckGo");
/** Public DuckDuckGo Lite search. */
export const DdgLiteProvider = htmlProvider("ddg-lite", "DuckDuckGo Lite");
/** Anonymous AnySearch REST search. Availability depends on its public quota. */
export const AnysearchProvider = {
    name: "anysearch", label: "AnySearch", description: "Anonymous web search", credSuffix: "ANYSEARCH",
    authentication: "none", fetchCapable: false, needsBaseUrl: false,
    async search(query, maxResults, _key, _base, context) {
        const { signal } = resolveContext(context);
        const data = record(await searchJson("https://api.anysearch.com/v1/search", {
            method: "POST", signal, headers: { "content-type": "application/json" },
            body: JSON.stringify({ query, max_results: maxResults ?? 8 }),
        }));
        if (data.code !== 0)
            throw providerError("server", `AnySearch: ${string(data.message) || "search failed"}`);
        return { sources: normalizeSources(records(record(data.data).results).map((r) => ({ url: string(r.url), title: string(r.title), snippet: string(r.snippet) || string(r.content) || string(r.description) })), maxResults ?? 8) };
    },
    fetch: unsupportedFetch,
};
/** Normalize Exa/Keenable MCP text results, preserving usable dates and snippets. */
export function parseMcpSources(text, limit) {
    return normalizeSources(text.split(/\n(?=Title:)/).flatMap((block) => {
        const url = block.match(/^URL:\s*(\S+)\s*$/m)?.[1];
        if (!url)
            return [];
        const publishedAt = block.match(/^(?:Published(?: Date)?|Acquired):\s*(\d{4}-\d{2}-\d{2}\S*)/m)?.[1];
        return [{
                url, title: block.match(/^Title:\s*(.+)$/m)?.[1],
                snippet: block.split(/^(?:Highlights|Snippets|Text|Content):\s*$/m)[1]?.trim().slice(0, 1200),
                ...(publishedAt ? { publishedAt } : {}),
            }];
    }), limit);
}
/** Exa anonymous MCP search; its text query retains constraints unsupported as MCP fields. */
export async function searchExaAnonymous(query, limit, signal) {
    const result = await searchMcp("https://mcp.exa.ai/mcp", "web_search_exa", { query, numResults: limit }, signal);
    return { sources: parseMcpSources(mcpText(result), limit) };
}
/** Keenable accepts a key for REST search or anonymous MCP requests. */
export const KeenableProvider = {
    name: "keenable", label: "Keenable", description: "Web search with optional API key", credSuffix: "KEENABLE",
    authentication: "optional", fetchCapable: false, needsBaseUrl: false,
    async search(query, maxResults, key, _base, context) {
        const { signal, hints } = resolveContext(context);
        const args = { query, ...(hints?.freshness?.after ? { published_after: hints.freshness.after } : {}) };
        if (!key) {
            const result = await searchMcp("https://api.keenable.ai/mcp", "search_web_pages", args, signal);
            return { sources: parseMcpSources(mcpText(result), maxResults ?? 8) };
        }
        const data = record(await searchJson("https://api.keenable.ai/v1/search", {
            method: "POST", signal, headers: { "content-type": "application/json", "x-api-key": key },
            body: JSON.stringify({ ...args, mode: "realtime" }),
        }));
        return { sources: normalizeSources(records(data.results).map((r) => ({ url: string(r.url), title: string(r.title), snippet: string(r.snippet) || string(r.description), publishedAt: string(r.published_at) || undefined })), maxResults ?? 8) };
    },
    fetch: unsupportedFetch,
};
/** Enforce explicit domain restrictions even when the remote engine ignores them. */
export function filterSourceDomains(sources, hints) {
    const matches = (host, domain) => host === domain.toLowerCase() || host.endsWith(`.${domain.toLowerCase()}`);
    return sources.filter(({ url }) => {
        let host;
        try {
            host = new URL(url).hostname;
        }
        catch {
            return false;
        }
        return (!hints?.domains?.include?.length || hints.domains.include.some((domain) => matches(host, domain))) &&
            !hints?.domains?.exclude?.some((domain) => matches(host, domain));
    });
}
