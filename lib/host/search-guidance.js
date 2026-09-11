/** Logged model guidance for the unified search tool's public platform prefixes. */
import { PUBLIC_PLATFORMS } from "../shared/search-policy.js";
/** Describe enabled sources without exposing credentials or requiring a search on every turn. */
export function searchGuidance(enabled) {
    const prefixes = Object.keys(PUBLIC_PLATFORMS).filter((id) => enabled[id] !== false).map((id) => `${id}:`);
    if (enabled.x !== false)
        prefixes.push("X:");
    if (enabled.xiaohongshu !== false)
        prefixes.push("小红书:");
    return [
        "Use web_search when web research is useful; use web_fetch to read a specific URL.",
        `To search a specific enabled platform, prefix the query with one of: ${prefixes.join(", ") || "none"}. Otherwise use an ordinary web query.`,
        "GitHub searches repositories. V2EX matches current hot topics only. Platform search results are discovery links, not fetched page details or comments.",
        "For a date constraint, add after:YYYY-MM-DD, before:YYYY-MM-DD, or time:3d. Date-filter support varies by source; verify publication dates before claiming recency.",
    ].join("\n");
}
