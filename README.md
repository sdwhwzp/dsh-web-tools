<div align="center">

Harness 0.1.7 persists search preferences on the plugin Loader row; the row id may be customized. Older hosts retain their namespace storage. Preference writes carry the current form revision and refuse a missing owner or form.

<p align="center">
  <img src="https://raw.githubusercontent.com/A3Boy/dsh-web-tools/main/assets/logo.png" alt="dsh-web-tools" width="160" />
</p>

# dsh-web-tools

Empower DeepSeek Harness with unified search and deep content extraction across the open web and social platforms.

**Native-Capability Adaptation Across 15 Web Providers · SearchHints Semantic Compilation · Multi-Source Resilience · Xiaohongshu & Twitter / X Retrieval**

<p align="center">
  <a href="https://github.com/A3Boy/dsh-web-tools/stargazers">
    <img src="https://img.shields.io/github/stars/A3Boy/dsh-web-tools?style=flat-square&label=Stars" alt="GitHub Stars" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-2ea44f?style=flat-square" alt="MIT License" />
  </a>
  <a href="https://github.com/deepseek-ai/deepseek-harness">
    <img src="https://img.shields.io/badge/DeepSeek%20Harness-Web%20Runtime-4D6BFE?style=flat-square" alt="DeepSeek Harness" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

**English** | [简体中文](README.zh-CN.md)

</div>

## Unified free and API search on `dev`

This fork integrates the search engines and public-platform retrieval from [dsh-free-search](https://github.com/DDDMUC/dsh-free-search/tree/d1beabcf643256d95823a9cb8f06fc8f84a40483) into the existing dsh-web-tools provider, key pool, proxy, settings page, and standard `web_search` / `web_fetch` tools. Use this plugin as the web provider; disable a separately installed dsh-free-search before switching. Existing saved provider order and credentials remain in place; credentials are managed only through this plugin's host credential service.

In **Settings → Web Search**, choose an access mode:

| Mode | Search order | Page extraction |
| --- | --- | --- |
| `free-only` | Anonymous endpoints and explicitly configured SearXNG instances; never sends stored API keys | Built-in HTTP extraction; existing signed-in X/Xiaohongshu sources remain available |
| `free-first` | Anonymous attempts first, then configured API accounts | Existing native extraction and HTTP fallback |
| `api-first` (default) | Configured API accounts first, then anonymous attempts | Existing native extraction and HTTP fallback |

The selected mode groups the providers in your configured search order. Exa, Tavily, and Keenable each support anonymous and account attempts; account authentication failures and cooldowns are separate from anonymous failures. Bing, DuckDuckGo HTML, DuckDuckGo Lite, and AnySearch need no key. Perplexity Sonar and DeepSeek official web search require an account key. SearXNG uses only your explicit Base URL or instance list; configure JSON output and the timeout per instance. The overall provider-attempt timeout still limits the complete SearXNG attempt.

Start with `free-first` and add Bing, DuckDuckGo Lite, Exa, Tavily, AnySearch, and Keenable to the order as needed. The new-install fallback order is Bing → DuckDuckGo HTML → DuckDuckGo Lite → AnySearch → Tavily → Keenable, with Exa as the preferred provider. The mode does not silently add sources to an existing saved order. The test button checks enabled general providers allowed by the selected mode; explicit platform queries can be checked with the search test below.

Public searches use explicit prefixes, independently of the general provider order:

| Query example | Retrieval scope |
| --- | --- |
| `GitHub: deepseek harness` | Repository search, not authenticated code search |
| `V2EX: AI` | Filter the current hot-topic list, not historical full-site search |
| `B站: DeepSeek` | Bilibili video search |
| `Reddit: typescript` | Public Reddit posts |
| `HN: agents` | Hacker News search via Algolia, linking to discussions |
| `StackOverflow: node fetch` | Stack Overflow questions |
| `Wikipedia: 人工智能` | Chinese or English Wikipedia, selected in settings |
| `npm: cordis` | npm package search |

Each public platform has its own switch. A disabled platform or unavailable public API returns an explicit error; general web results are not substituted for native platform results. Ordinary topic words do not trigger these public sources. X and Xiaohongshu retain the existing browser-session workflow described below.

`time:3d`, `time:12h`, `time:2mo`, and `time:1y` become date hints; explicit `after:YYYY-MM-DD` takes precedence. Date precision is one day, and each engine applies only supported filters. Search results have a per-plugin-instance LRU cache (default 300 seconds, 50 entries); cache identity includes query, source, account, and effective settings. Set the cache to 0 to disable it. Empty responses, failures, and cancelled requests are not cached.

Free endpoints can change, require browser verification, return no results, or impose shared limits. They do not provide guaranteed availability. Run `npm run probe:search` for a keyless network check in your environment. This does not test paid API accounts, a private SearXNG instance, or signed-in X/Xiaohongshu sessions. The fusion source revisions and verification are recorded in [the implementation note](https://github.com/sdwhwzp/dsh-web-tools/blob/dev/.agents/notes/implemented/feature/2026-09-11-unified-free-web-search.md); upstream license notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Multi-account deployment

Administrators can click Login in platform settings and operate the Xiaohongshu or X Host login page inside the Web dialog. It supports clicks, keyboard input, pasted text, scrolling and slider drags. Administrators complete QR scans, passwords and verification codes themselves; the text field clears after sending. Use phone, email or username login; separate third-party sign-in popups are outside this view. Closing stops remote control and preserves the browser profile. Status checks that overlap browser shutdown or replacement preserve saved login metadata and leave the current session unverified.

The Host needs Chrome/Chromium or Edge. Linux can use a private Xvfb display protected by Xauthority without a public remote-desktop port. Configure `browserExecutable` (default `auto`), `browserDisplay` and `browserXauthority` (both inherit the environment by default) in the `dsh-web-tools` namespace of `settings.yaml`; these deployment settings are not editable through the Web card. Remote views default to 1100 × 760, one update per second, a five-minute lifetime and a two-minute idle deadline. Configure these through `remoteLoginWidth`, `remoteLoginHeight`, `remoteLoginPollIntervalMs`, `remoteLoginTimeoutMs`, `remoteLoginIdleTimeoutMs` and `remoteLoginQuality`; new sessions capture the latest settings.

`/web-tools/api/remote-login/{start,frame,input,close}` applies the existing administrator and same-origin checks. Images and input are not logged; HTTP responses prohibit caching. The interface does not expose cookies, arbitrary scripts, URL navigation or raw debugging commands. Browser debugging listens on loopback only. A closed or expired control ID cannot operate a subsequent login.

With a Harness `requestPrincipal` provider installed, `/web-tools/api` verifies every caller through that provider. Global provider settings, keys, quotas, search tests, and browser-login controls require an administrator. Ordinary accounts can read or change search mode only for sessions authorized by `principalAccess`; unavailable authentication or session authorization denies access. Standalone local installations retain the loopback and same-origin checks.

Provider keys and signed-in X/Xiaohongshu browser profiles belong to the shared Host. In a multi-account production profile, disable X and Xiaohongshu through `platformEnabled: { x: false, xiaohongshu: false }` unless those signed-in sources are explicitly intended for all accounts. Public-platform searches and anonymous web providers remain available. Record the complete existing dependency pins and Cordis patch rows before installing this bundle; its `web` and `tool-web` rows replace the corresponding configuration objects.

## What problem does it solve?

When web access depends on a single provider, exhausted quota, rate limits, or timeouts can interrupt retrieval. Wrapping multiple APIs with a naive proxy often flattens them to a lowest common denominator, failing to leverage each provider's specialized search modes, categories, freshness, domain rules, and extraction capabilities.

dsh-web-tools connects 15 general search providers, eight public-platform sources, Xiaohongshu, and Twitter / X to DSH’s standard `web_search` / `web_fetch` interface.

While keeping the tool interface unified, dsh-web-tools normalizes search intents through SearchHints and compiles queries into native provider-specific parameters. This leverages each engine's native categories, freshness filters, domain policies, regional targeting, and content extraction, while maximizing uptime through multi-key allocation, automated failover, and dedicated browser profiles.

---

**Key Highlights**:

- **Native-Capability Adaptation Across 15 Web Providers**: Keeps the standard `web_search` / `web_fetch` contracts while compiling unified search intent into provider-specific native parameters instead of reducing every backend to the same lowest-common-denominator feature set.
- **SearchHints → Provider-Specific Parameter Compilation**: Normalizes technical, research, news, date, region, and domain constraints from queries, compiling them into provider-native parameters through deterministic code without additional LLM latency.
- **Xiaohongshu & Twitter / X Platform Sources**: Both platforms support signed-in native search, detail extraction, and returned comments or replies through dedicated local browser profiles.
- **Multi-Source Scheduling & Resilience**: Features multi-API-key pooling, 401 failover, 429 cooldown windows, configurable Ordered / Round-Robin / Random routing, and failover chains.
- **Native DSH Tool Integration**: Plugs directly into standard `web_search` / `web_fetch` without requiring new tool declarations, and includes a session-level "Search Mode" toggle.

```text
                         DSH Agent
                            │
                 web_search / web_fetch
                            │
                            ▼
                       SearchHints
            topic / freshness / domains
               locale / cleanQuery ...
                            │
                 Provider-specific
                    compilation
                            │
      ┌────────┬─────────┬───────────┬──────────┐
      │  Exa   │ Tavily  │ Firecrawl │ Parallel │ ...
      │        │         │           │          │
      │category│ topic   │ github    │objective │
      │ date   │ chunks  │ research  │ policy   │
      │domains │ time    │ tbs       │ queries  │
      └────────┴─────────┴───────────┴──────────┘

```

<p align="center">
  <img src="https://raw.githubusercontent.com/A3Boy/dsh-web-tools/main/assets/searchOrderAndRouting.png" width="900" alt="dsh-web-tools search strategy and multi-provider routing" />
</p>

## Native-Capability Adaptation Across 15 Web Providers

The tool interface and search semantics are unified for the DSH agent, but underlying provider capabilities are not.

dsh-web-tools expresses query intent through SearchHints and crafts dedicated requests for each provider, rather than compressing all backends into a single set of lowest-common-denominator parameters.

For example, when searching for "AI coding references from the past week":

* **Exa**: Maps category filters, ISO date ranges, and domain constraints;
* **Firecrawl**: Maps technical queries to the native `github` category, research queries to `research`, and applies `tbs` freshness filters;
* **Parallel**: Deconstructs the query into `objective`, clean `search_queries`, and `source_policy`;
* **Brave Search**: Maps freshness, country, and language parameters with priority LLM Context endpoint;
* **You.com**: Leverages `boost_domains` for soft domain preference.

All adaptations run through deterministic code without invoking an extra LLM call.

* **Exa**: Category mapping (`publication` / `news` / `financial report`), ISO-8601 date ranges, and domain constraints.
* **Firecrawl**: Maps coding and technical queries to the `github` category, academic queries to `research`, and supports `tbs`, domain constraints, and clean Markdown extraction.
* **Parallel**: Dual-layer semantics (`objective` soft-steering + clean `search_queries`) and `source_policy` domain/freshness filters.
* **Tavily**: Supports `basic` / `advanced` / `fast` / `ultra-fast` search depths; `basic`, `advanced`, and `fast` support `chunks_per_source`, with native `news` / `finance` topics, date ranges, country, and domain constraints.
* **Brave Search**: LLM Context endpoint with `pd/pw/pm/py` freshness filters, country, and search language.
* **You.com**: Native **`boost_domains`** soft-weighting, freshness presets, and geo/language targeting.
* **Jina**: Query noise reduction and ReaderLM-v2 high-precision markdown extraction.
* **SearXNG**: Self-hosted metasearch with `categories` (it/science/news) and `time_range`.
* **Native & Generic Page Extraction (`web_fetch`)**: Automatically routes to provider-native scraping backends (Exa `/contents`, Tavily `/extract`, Firecrawl `/scrape`, Parallel `/v1/extract`, You.com `/v1/contents`, Jina Reader) when available; seamlessly falls back to the **built-in generic HTTP fetcher** (powered by local Defuddle Markdown parsing with SSRF/DNS protection) for SearXNG-only / Brave-only setups or when native extractors fail.

---

## Social Platform Sources

Unlike general search engines, the plugin connects directly to native social platform sessions:

* **Native Isolated Browser Architecture**:
  * Directly controls local Edge / Chrome instances using dedicated profiles over CDP.
  * **0 browser extensions and 0 Playwright / Chromium bundles**. Cookies remain managed by the dedicated browser profile and are not written to plugin configuration, logs, or relays; the browser still sends them to the platform during normal authenticated requests.

* **Xiaohongshu**:
  * **Note Detail & Comment Fetch (`web_fetch`)**: Uses the dedicated browser profile to extract structured `__INITIAL_STATE__` data with DOM fallback while preserving signed `xsec_token` URLs. When the page loads comment data, top-level comments and returned nested replies are extracted individually.
  * **Native Search Discovery (`web_search`)**: Uses the signed-in browser and the real search controls on `/explore`, entering only the cleaned topic query rather than platform names or `site:` operators. It distinguishes login walls, security verification, and a genuinely signed-out session. Operators can temporarily disable this path with `XHS_NATIVE_SEARCH=0` while diagnosing browser issues.

* **Twitter / X**:
  * **Native Search, Tweet Detail & Replies**: Captures the X web client's GraphQL data streams (SearchTimeline / TweetDetail) over CDP, parses the target tweet and its reply tree structurally, and uses DOM extraction as a supplement and fallback. Supports `from:`, `since:`, and `until:` operators.

Each detail fetch includes at most 30 comments or replies, with up to 800 characters per entry. Additional pages or nested replies are explicitly marked as truncated to keep model context bounded.

> **Capability Boundary**: For Xiaohongshu notes where the primary content resides in images, the fetcher returns the title, text description, engagement metrics, image count, and loaded comments; it does not perform optical character recognition (OCR) on image text or automatically paginate through all comments.

Agents use `小红书:` or `X:` as a platform-routing prefix. The prefix selects the platform and is removed before the native search runs; for example, `小红书: DeepSeek Harness` enters only `DeepSeek Harness` into Xiaohongshu's search box.

Xiaohongshu native search waits for a visible, editable home-page field in either the traditional header or the newer home layout; the newer textarea submits with Enter. An unavailable field returns `search-control-unavailable`, while a submitted search that never becomes ready returns `navigation-failed`.

* **General-Web Fallback**: Uses configured general search or fetch providers when a platform source is disabled, temporarily unavailable, or reports a retryable failure. Non-retryable sign-in, access-control, search-restriction, and invalid-detail errors are returned directly so indexed content is not presented as native platform results, details, or comments.
* **Automated Session Verification**: Cookies are only the first gate. Xiaohongshu requires both `a1` and `web_session`, then performs a stabilized live `/explore` check in the interactive browser. A visible login wall invalidates the old session and restores the sign-in action; a wall appearing only after search submission is reported directly as `search-restricted` rather than being hidden behind indexed web results.

<p align="center">
  <img src="https://raw.githubusercontent.com/A3Boy/dsh-web-tools/main/assets/platformSessions.png" width="900" alt="Xiaohongshu and Twitter X signed-in sessions verified automatically" />
</p>

---

## Fallback & Resilience

* **Multi-API-Key Pooling**: Assigns keys per provider, balances concurrent requests by lowest in-flight count, and fails over across keys on authentication errors.
* **Deterministic Provider Fallback**: Automatically cascades through the fallback chain on network failures, timeouts, 5xx server errors, 429 rate limits, or exhausted quotas.
* **429 Retry-After Cooldown**: Enforces zero-request cooldown windows when servers return `Retry-After` headers, skipping rate-limited providers immediately.
* **Configurable Routing Policies**: `web_search` supports Ordered, Round-Robin, and Random starting-provider selection. `web_fetch` always follows the deterministic fetch-capable chain.
* **Session-Level Search Mode**: Requires at least one completed `web_search` or `web_fetch` call before an answer. A failed call still counts as an attempt, and the agent is instructed to disclose what could not be verified.
* **Proxy Support**: Supports the Windows system proxy, `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`, with automatic loopback bypass.

---

## Installation & Updates

```bash
# Install
dsh plugin --profile web add github:sdwhwzp/dsh-web-tools#dev

# Update
dsh plugin --profile web update dsh-web-tools

# Remove
dsh plugin --profile web remove dsh-web-tools

```

Restart `dsh web` and navigate to `Settings` → `Web Search`.

---

## Provider Capabilities

| Provider | Search | Fetch / Extract | Key Integrations & Adaptations | Quota Inspection |
| --- | --- | --- | --- | --- |
| [Exa](https://exa.ai) | Yes | Yes, `/contents` | Semantic retrieval (`auto` / `fast` / `deep`), `category` mappings, query-aware highlights, ISO-8601 date ranges | Dashboard only |
| [Tavily](https://tavily.com) | Yes | Yes, `/extract` | Search depths (`basic` / `advanced` / `fast` / `ultra-fast`); the first three support chunking, plus `news` / `finance`, date, country, and domain parameters | Official API |
| [Firecrawl](https://firecrawl.dev) | Yes | Yes, `/scrape` | Technical queries map to `github`, academic queries to `research`; supports `tbs`, domain constraints, and clean Markdown extraction | Official API |
| [Parallel](https://parallel.ai) | Yes | Yes, `/v1/extract` | Agent dual-layer semantic search (`advanced` / `basic` / `turbo`), `objective` soft-steering, `source_policy` | Dashboard only |
| [Brave Search](https://brave.com/search/api/) | Yes | — | Preferred LLM Context pre-extraction with `pd/pw/pm/py` freshness, country/lang filters, auto fallback to Classic Search | Response headers |
| [You.com](https://you.com) | Yes | Yes, `/v1/contents` | Snippet highlights, native **`boost_domains`** soft-weighting, freshness and country/lang filters, markdown endpoint | Official API |
| [Jina](https://jina.ai) | Yes | Yes, Reader | Search query noise filtering, ReaderLM-v2 high-precision markdown, token budget and truncation control | Best-effort |
| [SearXNG](https://docs.searxng.org) | Yes | — | Open-source self-hosted metasearch with `categories` and supported `time_range` values; the adapter requires no API key | Instance-defined |
| Bing | Yes | — | Anonymous HTML search, market and safe-search settings | Public endpoint limits |
| DuckDuckGo HTML | Yes | — | Anonymous HTML search, region, safe search and supported date presets | Public endpoint limits |
| DuckDuckGo Lite | Yes | — | Anonymous Lite search with independent fallback | Public endpoint limits |
| AnySearch | Yes | — | Anonymous JSON search | Public endpoint limits |
| Keenable | Yes | — | Anonymous MCP or keyed REST search | Endpoint/account-defined |
| Perplexity | Yes | — | Sonar answers and citations; configurable model and output token budget | Account billing |
| DeepSeek official | Yes | — | Hosted web search with citations; separate search credential | Account billing |

### Quick Recommendation Guide

New installations default to **Exa**; existing installations keep their saved provider configuration.

| Scenario | Recommended Provider | Notes |
| --- | --- | --- |
| **Social Discovery & Content Detail** | **Xiaohongshu / Twitter / X** | Both platforms provide signed-in native search, detail retrieval, and returned comments or replies |
| **Semantic Search / Technical Documentation** | **Exa** | Semantic modes plus category, date, domain, and highlight parameters |
| **Pre-Extracted Search Context** | **Brave Search** | Prefers LLM Context with Classic Search fallback |
| **Configurable Search Depth and Extraction** | **Tavily** / **Parallel** | Provider-native depth modes and content extraction endpoints |
| **Content-to-Markdown Extraction** | **Firecrawl** / **Jina** | Main-content filtering, scraping, and Reader conversion |
| **Freshness, Region, and Domain Preference** | **You.com** | Freshness, locale, and `boost_domains` parameters |
| **Self-Hosted Metasearch** | **SearXNG** | Uses your SearXNG endpoint; the adapter requires no API key |

---

## Local Development

Use Node.js 22.21.1 or a supported newer Node release. CI tests both `main` and `dev` with the committed npm lockfile.

```bash
npm ci --include=optional # Install dependencies
npm test              # Run test suite
npm run typecheck    # Type checking
npm run build        # Build bundle into lib/

```

---

## Frequently Asked Questions

### Self-Hosted SearXNG Configuration & Troubleshooting

When using Docker or self-hosted SearXNG, if you encounter `no usable provider` or HTTP 403 Forbidden errors, check the following:

1. **Enable JSON Output Format**: SearXNG defaults to HTML-only output for privacy. Edit your SearXNG `settings.yml` and add `- json` under `search.formats`:
   ```yaml
   search:
     formats:
       - html
       - json # Required for API queries
   ```
   Restart your SearXNG container (`docker restart searxng`) to apply changes.
2. **Keyless Setup**: SearXNG is keyless by default — leave the API Key field empty in the settings card. Enter your instance URL in the `Base URL` field (e.g. `http://127.0.0.1:8080`) and click "Test Search" to verify connectivity.

### Cache & Reinstallation

If cache issues occur after upgrading via local path or symlinks, reinstall from the profile directory:

```bash
cd ~/.dsh/profiles/web && pnpm install

```

Exa and Parallel balances are checked in their provider dashboards; Brave quota information comes from actual search response headers. Quota display is informational and does not affect routing or fallback.

Xiaohongshu and Twitter / X each use a dedicated local browser profile. The plugin does not export raw cookies to configuration, logs, or third-party relays; the browser sends them through normal authenticated requests to the corresponding platform domains.

---

## License

[MIT](LICENSE) © A3Boy
