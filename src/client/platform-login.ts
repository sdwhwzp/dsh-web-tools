/** Locale keys for the platform login controls. */
import type { BrowserPlatformStatusView, LoginUnavailableReason } from "../shared/platform-types.ts";
import type { RemoteLoginState } from "../shared/remote-login.ts";

/** Locale key for the remote view's current operation state. */
export function remoteLoginStatusKey(state: RemoteLoginState | undefined) {
  return state === "authenticated" ? "remoteLoginSuccess" : state === "failed" ? "remoteLoginFailed" : state === "pending" ? "remoteLoginReady" : "remoteLoginStarting";
}

/**
 * Select the login message shown beside a platform button.
 * @param status Latest Host status.
 * @param starting Whether the browser is submitting a login request.
 * @returns A locale key for the pending or unavailable state, if present.
 */
export function platformLoginMessage(status: BrowserPlatformStatusView | undefined, starting = false) {
  if (starting || status?.loginPending) return "platformLoginPending" as const;
  if (status?.authenticated) return undefined;
  const reason: LoginUnavailableReason | undefined = status?.loginUnavailableReason
    ?? (status?.runtimeAvailable === false ? "browser-missing" : undefined);
  if (reason === "browser-missing") return "platformBrowserMissing" as const;
  if (reason === "display-missing") return "platformDisplayMissing" as const;
  return undefined;
}
