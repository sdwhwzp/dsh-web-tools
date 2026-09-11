/** Public platform APIs adapted from dsh-free-search; see THIRD_PARTY_NOTICES.md. */
import { PUBLIC_PLATFORMS } from "../shared/search-policy.js";
import { normalizeSources, plainText, record, records, searchJson, string } from "./providers/search-response.js";
import { providerError } from "./providers/types.js";
const PREFIXES = {
    github: "github", v2ex: "v2ex", bilibili: "bilibili", "b站": "bilibili", reddit: "reddit",
    hn: "hn", "hacker news": "hn", stackoverflow: "stackoverflow", "stack overflow": "stackoverflow",
    wikipedia: "wikipedia", "维基百科": "wikipedia", npm: "npm",
};
/** Match an explicit platform prefix; a platform name appearing in a topic does not route it. */
export function publicPlatformQuery(query) {
    const match = query.trim().match(/^([^:：]+)[:：]\s*([\s\S]*)$/);
    const platform = match && PREFIXES[match[1].toLowerCase()];
    if (!platform)
        return undefined;
    if (!match[2].trim())
        throw providerError("bad-request", "A platform prefix must be followed by a search query");
    return { platform, query: match[2].trim() };
}
/** Search a public platform; V2EX only filters the current hot-topic feed. */
export async function searchPublicPlatform(platform, query, limit, signal, language = "zh") {
    const headers = { "user-agent": "dsh-web-tools (https://github.com/sdwhwzp/dsh-web-tools)", accept: "application/json" };
    const get = (url, extra = {}) => searchJson(url, { headers: { ...headers, ...extra }, signal });
    const q = encodeURIComponent(query);
    let sources;
    let content;
    switch (platform) {
        case "github": {
            const data = record(await get(`https://api.github.com/search/repositories?q=${q}&per_page=${limit}`));
            sources = records(data.items).map((r) => ({ url: string(r.html_url), title: string(r.full_name), snippet: string(r.description) }));
            break;
        }
        case "v2ex": {
            const topics = records(await get("https://www.v2ex.com/api/topics/hot.json"));
            sources = topics.filter((r) => `${string(r.title)} ${string(r.content)}`.toLowerCase().includes(query.toLowerCase())).map((r) => ({ url: `https://www.v2ex.com/t/${r.id}`, title: string(r.title), snippet: string(r.content).slice(0, 600) }));
            content = "V2EX results cover matching current hot topics only, not the complete forum archive.";
            break;
        }
        case "bilibili": {
            const data = record(await get(`https://api.bilibili.com/x/web-interface/search/all/v2?keyword=${q}`, { referer: "https://www.bilibili.com" }));
            if (data.code !== 0)
                throw providerError("server", `Bilibili: ${string(data.message) || "search failed"}`);
            sources = records(record(data.data).result).flatMap((section) => records(section.data)).filter((r) => typeof r.arcurl === "string").map((r) => ({ url: string(r.arcurl), title: plainText(r.title), snippet: plainText(r.desc) }));
            break;
        }
        case "reddit": {
            const data = record(await get(`https://old.reddit.com/search.json?q=${q}&limit=${limit}&sort=relevance`));
            sources = records(record(data.data).children).map((r) => record(r.data)).map((r) => ({ url: `https://www.reddit.com${string(r.permalink)}`, title: string(r.title), snippet: string(r.selftext).slice(0, 600) }));
            break;
        }
        case "hn": {
            const data = record(await get(`https://hn.algolia.com/api/v1/search?query=${q}&hitsPerPage=${limit}`));
            sources = records(data.hits).map((r) => ({ url: `https://news.ycombinator.com/item?id=${r.objectID}`, title: string(r.title) || string(r.story_title), snippet: plainText(r.comment_text || r.story_text).slice(0, 600) }));
            break;
        }
        case "stackoverflow": {
            const data = record(await get(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${q}&site=stackoverflow&pagesize=${limit}`));
            if (data.error_id)
                throw providerError("server", `Stack Overflow: ${string(data.error_message)}`);
            sources = records(data.items).map((r) => ({ url: string(r.link), title: plainText(r.title), snippet: `${r.is_answered ? "Answered" : "Unanswered"}; ${r.answer_count ?? 0} answers` }));
            break;
        }
        case "wikipedia": {
            const host = language === "en" ? "en.wikipedia.org" : "zh.wikipedia.org";
            const data = record(await get(`https://${host}/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=${limit}`));
            sources = records(record(data.query).search).map((r) => ({ url: `https://${host}/wiki/${encodeURIComponent(string(r.title).replaceAll(" ", "_"))}`, title: string(r.title), snippet: plainText(r.snippet) }));
            break;
        }
        case "npm": {
            const data = record(await get(`https://registry.npmjs.org/-/v1/search?text=${q}&size=${limit}`));
            sources = records(data.objects).map((r) => record(r.package)).map((r) => ({ url: `https://www.npmjs.com/package/${string(r.name)}`, title: string(r.name), snippet: `${string(r.version)} ${string(r.description)}`.trim() }));
            break;
        }
        default: {
            const exhaustive = platform;
            throw providerError("config", `Unknown public platform: ${exhaustive}`);
        }
    }
    return { sources: normalizeSources(sources, limit), content: content ?? `Source: ${PUBLIC_PLATFORMS[platform]} public search.` };
}
