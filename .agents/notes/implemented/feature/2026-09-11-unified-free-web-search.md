# Agent Note: Unified free and API web search

Status: implemented

## Problem

Running separate web-tools and free-search plugins creates independent provider selection, settings, failure handling, and model guidance. Anonymous endpoints must coexist with configured account search without spending API quota in free-only mode or allowing a shared endpoint's cooldown to disable an account.

## Decision

Keep the dsh-web-tools standard provider and settings registration. Adapt donor engines into ProviderAdapter and route explicit public-platform prefixes before general search. Preserve existing X/Xiaohongshu browser-session sources, generic fetch protection, account pools, and saved provider order. Search access mode selects anonymous/account phases within the configured order; anonymous cooldown and authentication state do not mutate account pools. Free-only suppresses keyed search, keyed native extraction, and automatic account quota requests.

Cache only completed nonempty successes, per plugin instance, keyed by a digest of provider, credential, request, and effective settings. Return copies, enforce bounded LRU capacity, and stop the entire chain on caller cancellation. Public-platform availability is independent of the general chain. Platform results state their actual scope; V2EX only filters current hot topics.

SearXNG uses an explicitly configured base URL and/or ordered instance list. Each instance has its own configurable timeout inside the overall provider timeout. No maintained list of third-party instances is bundled. New HTTP and MCP responses have a 2 MiB limit and normalize sources to unique HTTP(S) URLs. MCP responses must match the request id. Guide the model through the host's logged user-message snapshot on the first automatic step; keep the existing required-search mode.

## Alternatives

Copying the donor's registration and settings bridge would create two execution paths to maintain. Its legacy environment-key names and slash command are not imported; this plugin's credential service and existing search-mode command own those functions. Paid endpoints and anonymous endpoints remain separate attempts on one adapter where both exist.

## Sources and synchronization

- Owned fork push URL: `git@github.com:sdwhwzp/dsh-web-tools.git`, active branch `dev`.
- Base: `https://github.com/A3Boy/dsh-web-tools.git`, branch `main`, commit `9b45045ac8a011429d494399a49846ae907c07d3`; fork `main` and initial `dev` matched this commit.
- Donor: `https://github.com/DDDMUC/dsh-free-search.git`, branch `master`, commit `d1beabcf643256d95823a9cb8f06fc8f84a40483` (0.4.24).
- Donor MIT attribution is retained in THIRD_PARTY_NOTICES.md and included in package files. The fork ships as 0.4.0-dev.1 with built lib artifacts so Git installs do not need dependency build scripts.

## Verification

The plugin suite covers HTML/MCP/API parsing, credential isolation, anonymous/account order, empty-result fallback, cancellation, SearXNG instance fallback, cache expiry/identity/copying, settings validation, platform routing, and the installed apply path. `test/expected/fused-search.json` records model-facing sources and the guidance snapshot. New tests are included in a strict TypeScript test program. Build includes the browser module-loader purity gate. Validation on Node.js 22.21.1: `npm run typecheck` passed; `npm run build` passed; `npm test` completed with 331 tests, 329 passed, 0 failed, and 2 environment-gated DSH scope tests skipped. The packed entrypoint, all 15 adapter registrations, anonymous search, cache reuse, and GitHub search passed a built-artifact smoke test.

The keyless network probe on 2026-09-11 returned results from Bing, DuckDuckGo Lite, Exa, Tavily, AnySearch, Keenable, GitHub, Bilibili, Hacker News, Stack Overflow, npm, and Wikipedia. V2EX was reachable with no matching current hot topics. DuckDuckGo HTML returned no results for the probe query; Reddit did not return usable JSON. These are observations from one network, not availability guarantees. Paid credentials, private SearXNG servers, and signed-in platform sessions were not used in the live probe.

The actual React settings section and Host config routes were exercised in a temporary local fixture: switching to free-only marked account-only sources as excluded; cache lifetime, GitHub enablement, Wikipedia language, and the SearXNG instance list persisted across an English-page reload. The fixture used synthetic search results and no credentials; this is UI validation, not a production DSH deployment.

The verified npm package contained the compiled host/client, added providers, guidance, and license notices. Package SHA-256: `e2ae68b5e2fb688a50ae2903d43e7f3492d5d1654a4f881d9f3ad022dd3cf52b`; `lib/client.js` SHA-256: `b4511e36e926440548a94aa906fb800b02f4c7d712549c3eca58d45b98586947`. Temporary preview, probe, donor-checkout, and packaging material is removed after validation; source and installed development dependencies remain.
