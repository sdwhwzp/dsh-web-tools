# Xiaohongshu home search layouts

Status: implemented

## Search behavior

Xiaohongshu's newer home layout exposes `textarea#search-input-in-feeds` and keeps the traditional `input#search-input` inside a hidden header. Search must select a visible, editable control; DOM presence alone cannot identify the active field. The newer textarea submits with Enter and can navigate to `/search_result_ai`, whose note cards use the existing extraction path. The traditional field retains its search button and Enter fallback.

The control detector is self-contained because CDP serializes it into the browser. It uses the two observed field IDs, rejects zero-size, hidden, disabled, read-only, aria-hidden and inert fields, and waits within the existing eight-second control deadline. A field that remains unavailable or cannot gain focus produces `search-control-unavailable` at explore. Existing login and security checks still gate search; submitted searches retain their result readiness deadline. Profile ownership and administrator-shared source settings are unchanged.

## Evidence

On server 30, the signed-in explore page was fully loaded while the old input had zero dimensions; focusing it failed. Submitting the visible textarea with the user's Wuhan travel query produced 22 note cards. The regression test fails on the previous implementation with `navigation-failed` and passes with layout-aware selection. Owner-local expected output covers both layouts and unavailable controls; asynchronous tests cover a control appearing after hydration and focus failure without sending text. Existing native search, detail, comments and routing tests cover the downstream behavior. Real deployment verification uses the administrator's routed search endpoint and task-owned tabs in the existing signed-in browser; it does not copy or export login data.
