/** Citation-producing search APIs adapted from dsh-free-search; see THIRD_PARTY_NOTICES.md. */
import { providerError, resolveContext } from "./types.js";
import { normalizeSources, record, records, searchJson, string } from "./search-response.js";
import { unsupportedFetch } from "./free-search.js";
/** Perplexity Sonar search with its answer and source citations. */
export const PerplexityProvider = {
    name: "perplexity", label: "Perplexity", description: "Sonar web answers with citations", credSuffix: "PERPLEXITY",
    authentication: "required", fetchCapable: false, needsBaseUrl: false,
    async search(query, maxResults, key, _base, context) {
        if (!key)
            throw providerError("config", "Perplexity requires an API key");
        const { signal, options } = resolveContext(context);
        const data = record(await searchJson("https://api.perplexity.ai/chat/completions", {
            method: "POST", signal, headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
            body: JSON.stringify({ model: options?.model ?? "sonar", max_tokens: options?.maxTokens ?? 1024, messages: [{ role: "user", content: query }] }),
        }));
        const answer = string(record(records(data.choices)[0]?.message).content);
        if (!Array.isArray(data.citations))
            throw providerError("invalid-response", "Perplexity returned no citation list");
        const sources = data.search_results === undefined
            ? data.citations.map((url) => ({ url: string(url) }))
            : records(data.search_results).map((r) => ({ url: string(r.url), title: string(r.title), snippet: string(r.snippet), publishedAt: string(r.date) || undefined }));
        return { content: answer, sources: normalizeSources(sources, maxResults ?? 8) };
    },
    fetch: unsupportedFetch,
};
/** DeepSeek's hosted web-search tool, using a separate search credential. */
export const DeepSeekOfficialProvider = {
    name: "deepseek-official", label: "DeepSeek", description: "DeepSeek hosted web search", credSuffix: "DEEPSEEK",
    authentication: "required", fetchCapable: false, needsBaseUrl: false,
    async search(query, maxResults, key, _base, context) {
        if (!key)
            throw providerError("config", "DeepSeek search requires an API key");
        const { signal, options } = resolveContext(context);
        const data = record(await searchJson("https://api.deepseek.com/anthropic/v1/messages", {
            method: "POST", signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
                model: options?.model ?? "deepseek-v4-flash", max_tokens: options?.maxTokens ?? 4096,
                messages: [{ role: "user", content: [{ type: "text", text: `Perform a web search for the query: ${query}` }] }],
                tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
            }),
        }));
        const blocks = records(data.content);
        const citations = new Map();
        for (const block of blocks) {
            if (block.type !== "text" || block.citations === undefined)
                continue;
            for (const item of records(block.citations))
                citations.set(string(item.url), string(item.cited_text));
        }
        const sources = [];
        for (const block of blocks.filter((b) => b.type === "web_search_tool_result")) {
            if (!Array.isArray(block.content))
                throw providerError("server", "DeepSeek web search tool failed");
            for (const item of records(block.content)) {
                if (item.type !== "web_search_result")
                    continue;
                sources.push({ url: string(item.url), title: string(item.title), snippet: citations.get(string(item.url)), publishedAt: string(item.page_age) || undefined });
            }
        }
        return { sources: normalizeSources(sources, maxResults ?? 8) };
    },
    fetch: unsupportedFetch,
};
