/** Validation and result normalization for public search HTTP and MCP responses. */
import { parseHTML } from "linkedom";
import { fetchWithProxy } from "../fetch-proxy.js";
import { providerError, throwIfHttp } from "./types.js";
/** Require an object at a provider JSON boundary. */
export function record(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw providerError("invalid-response", "Search service returned an invalid object");
    }
    return value;
}
/** Require an array of objects at a provider JSON boundary. */
export function records(value) {
    if (!Array.isArray(value))
        throw providerError("invalid-response", "Search service returned an invalid result list");
    return value.map(record);
}
/** Read an optional text field without coercing objects into model-visible text. */
export function string(value) {
    return typeof value === "string" ? value : "";
}
/** Decode text and strip markup without executing page scripts. */
export function plainText(value) {
    const { document } = parseHTML(`<html><body>${string(value)}</body></html>`);
    for (const el of Array.from(document.querySelectorAll("script,style")))
        el.remove();
    return (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}
/** Deduplicate HTTP(S) sources, rejecting executable URLs from remote results. */
export function normalizeSources(sources, limit) {
    const seen = new Set();
    return sources.filter((source) => {
        let url;
        try {
            url = new URL(source.url);
        }
        catch {
            return false;
        }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || seen.has(url.href))
            return false;
        seen.add(url.href);
        source.url = url.href;
        return true;
    }).slice(0, limit);
}
/** Read a bounded response; the two-megabyte ceiling contains untrusted search payloads. */
export async function searchText(response) {
    const reader = response.body?.getReader();
    if (!reader)
        throw providerError("invalid-response", "Search service returned an empty response");
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done)
                break;
            size += chunk.value.byteLength;
            if (size > 2 * 1024 * 1024) {
                await reader.cancel();
                throw providerError("invalid-response", "Search response exceeds 2 MiB");
            }
            chunks.push(chunk.value);
        }
    }
    finally {
        reader.releaseLock();
    }
    return Buffer.concat(chunks).toString("utf8");
}
/** Fetch provider JSON through the shared proxy with the caller's cancellation signal. */
export async function searchJson(url, init = {}) {
    init.signal?.throwIfAborted();
    const response = await fetchWithProxy(url, { ...init, redirect: "error" });
    throwIfHttp(new URL(url).hostname, response);
    try {
        return JSON.parse(await searchText(response));
    }
    catch (error) {
        if (error instanceof SyntaxError)
            throw providerError("invalid-response", "Search service returned invalid JSON");
        throw error;
    }
}
/** Call a public MCP search tool, accepting JSON or a matching SSE JSON-RPC response. */
export async function searchMcp(url, tool, args, signal) {
    signal?.throwIfAborted();
    const response = await fetchWithProxy(url, {
        method: "POST", redirect: "error", signal,
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }),
    });
    throwIfHttp(new URL(url).hostname, response);
    const text = await searchText(response);
    let messages;
    try {
        messages = response.headers.get("content-type")?.includes("text/event-stream")
            ? text.split(/\r?\n\r?\n/).map((event) => event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n")).filter(Boolean).map((data) => JSON.parse(data))
            : [JSON.parse(text)];
    }
    catch {
        throw providerError("invalid-response", "MCP search returned invalid JSON");
    }
    const message = messages.map(record).find((item) => item.id === 1);
    if (!message)
        throw providerError("invalid-response", "MCP search response is missing the request id");
    if (message.error)
        throw providerError("server", `MCP search failed: ${string(record(message.error).message)}`);
    const result = record(message.result);
    if (result.isError)
        throw providerError("server", "MCP search tool reported an error");
    return result;
}
/** Extract text blocks from an MCP tool result. */
export function mcpText(result) {
    return records(result.content).filter((item) => item.type === "text").map((item) => string(item.text)).join("\n");
}
