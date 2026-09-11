import assert from "node:assert/strict";
import test from "node:test";
import { publicPlatformQuery, searchPublicPlatform } from "../src/host/public-platforms.ts";
import { PUBLIC_PLATFORMS } from "../src/shared/search-policy.ts";

test("platform routing requires a prefix and preserves the actual search topic", () => {
  assert.deepEqual(publicPlatformQuery("GitHub: dsh-web-tools"), { platform: "github", query: "dsh-web-tools" });
  assert.deepEqual(publicPlatformQuery("B站：DeepSeek"), { platform: "bilibili", query: "DeepSeek" });
  assert.deepEqual(publicPlatformQuery("Stack Overflow: TypeScript"), { platform: "stackoverflow", query: "TypeScript" });
  assert.equal(publicPlatformQuery("compare GitHub and GitLab"), undefined);
  assert.equal(publicPlatformQuery("site:github.com release notes"), undefined);
  assert.throws(() => publicPlatformQuery("Reddit: "), /query/);
});

test("all eight public APIs produce platform source links and readable text", async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    requests.push(url);
    if (url.includes("api.github.com")) return Response.json({ items: [{ html_url: "https://github.com/example/repo", full_name: "example/repo", description: "A repository" }] });
    if (url.includes("v2ex.com")) return Response.json([{ id: 1, title: "DeepSeek discussion", content: "Topic" }, { id: 2, title: "Other", content: "Other topic" }]);
    if (url.includes("api.bilibili.com")) return Response.json({ code: 0, data: { result: [{ data: [{ arcurl: "https://www.bilibili.com/video/BV1", title: "<em>DeepSeek</em> video", desc: "Details" }] }] } });
    if (url.includes("reddit.com")) return Response.json({ data: { children: [{ data: { permalink: "/r/example/comments/1/topic/", title: "Discussion", selftext: "Text", url: "https://unrelated.example/" } }] } });
    if (url.includes("algolia.com")) return Response.json({ hits: [{ objectID: "123", title: "HN topic", url: "https://unrelated.example/" }] });
    if (url.includes("stackexchange.com")) return Response.json({ items: [{ link: "https://stackoverflow.com/questions/123", title: "Q &amp; A", answer_count: 2, is_answered: true }] });
    if (url.includes("wikipedia.org")) return Response.json({ query: { search: [{ title: "DeepSeek", snippet: "<span>百科</span>" }] } });
    if (url.includes("registry.npmjs.org")) return Response.json({ objects: [{ package: { name: "dsh-web-tools", version: "1.0.0", description: "Search" } }] });
    throw new Error(`Unexpected request: ${url}`);
  });
  const output = Object.fromEntries(await Promise.all((Object.keys(PUBLIC_PLATFORMS) as Array<keyof typeof PUBLIC_PLATFORMS>).map(async (platform) => [platform, await searchPublicPlatform(platform, "DeepSeek", 3)])));
  assert.equal(output.github.sources[0].title, "example/repo");
  assert.equal(output.v2ex.sources.length, 1);
  assert.match(output.v2ex.content!, /current hot topics only/);
  assert.equal(output.bilibili.sources[0].title, "DeepSeek video");
  assert.match(output.reddit.sources[0].url, /reddit.com\/r\/example\/comments/);
  assert.match(output.hn.sources[0].url, /news.ycombinator.com\/item/);
  assert.equal(output.stackoverflow.sources[0].title, "Q & A");
  assert.equal(output.wikipedia.sources[0].snippet, "百科");
  assert.equal(output.npm.sources[0].title, "dsh-web-tools");
  await searchPublicPlatform("wikipedia", "hello", 1, undefined, "en");
  assert.match(requests.at(-1)!, /en.wikipedia.org/);
});

test("platform API errors remain failures rather than fabricated empty results", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ code: -412, message: "blocked" }));
  await assert.rejects(searchPublicPlatform("bilibili", "query", 5), { code: "server" });
});
