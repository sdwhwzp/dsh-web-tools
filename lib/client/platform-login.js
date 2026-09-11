/** Locale key for the remote view's current operation state. */
export function remoteLoginStatusKey(state) {
    return state === "authenticated" ? "remoteLoginSuccess" : state === "failed" ? "remoteLoginFailed" : state === "pending" ? "remoteLoginReady" : "remoteLoginStarting";
}
/**
 * Select the login message shown beside a platform button.
 * @param status Latest Host status.
 * @param starting Whether the browser is submitting a login request.
 * @returns A locale key for the pending or unavailable state, if present.
 */
export function platformLoginMessage(status, starting = false) {
    if (starting || status?.loginPending)
        return "platformLoginPending";
    if (status?.authenticated)
        return undefined;
    const reason = status?.loginUnavailableReason
        ?? (status?.runtimeAvailable === false ? "browser-missing" : undefined);
    if (reason === "browser-missing")
        return "platformBrowserMissing";
    if (reason === "display-missing")
        return "platformDisplayMissing";
    return undefined;
}
