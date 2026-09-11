# Gateway authorization for search controls

Status: implemented

## Deployment requirement

Server 30's dsh-passwords gateway forwards authenticated requests with loopback Host and Origin headers. The plugin's local browser fence therefore cannot distinguish administrators from ordinary accounts. Shared keys, provider settings, and signed-in browser profiles require administrative access; session search controls require the caller's existing session access.

## Implementation

Resolve `requestPrincipal` and `principalAccess` from the Host context for every request, including services installed after the routes mount. The deployment provider verifies the gateway's signed identity; the plugin never decodes or trusts a caller-supplied identity header itself. Only an authenticated administrator can use global management endpoints. Ordinary accounts can use `search-mode/get` and `search-mode/set` only when `principalAccess.resolve` includes the exact supplied session id. Missing services or failed authorization cannot fall back to loopback trust. Local installations without either deployment service retain their existing browser fence.

Provider registration, search results, session persistence, and the gateway package are unchanged. Shared X/Xiaohongshu profiles remain a Host resource; multi-account deployments disable these sources unless intentional account sharing is authorized. Public platforms do not require those profiles.

## Verification

`test/routes.smoke.mjs` exercises the same registered HTTP handler with gateway-style rewritten headers. It rejects all global management endpoints for an ordinary account, missing or invalid identities, another account's session, missing authorization, authorization errors, and cross-site administrator requests. It accepts an administrator's settings update and both search-mode operations on an authorized session. Failed calls do not write credentials or settings and do not access the session runtime. These are local route checks; server deployment and live account checks are recorded separately.

Release `0.4.0-dev.2`: type checking and the Host/Client build pass on Node.js 22.21.1. The route file has 19 passing tests; the focused fused-runtime, fused-routing, and search-mode files have 32 passing tests. A built-route smoke using the actual dsh-passwords `RequestPrincipalProvider` and synthetic HMAC assertions passes four cases: missing identity, ordinary user, wrong signature, and authenticated administrator. The packed manifest, Host entrypoint, Client bundle, patch, and license notice match the validated local outputs.
