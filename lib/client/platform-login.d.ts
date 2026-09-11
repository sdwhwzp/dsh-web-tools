/** Locale keys for the platform login controls. */
import type { BrowserPlatformStatusView } from "../shared/platform-types.ts";
import type { RemoteLoginState } from "../shared/remote-login.ts";
/** Locale key for the remote view's current operation state. */
export declare function remoteLoginStatusKey(state: RemoteLoginState | undefined): "remoteLoginSuccess" | "remoteLoginFailed" | "remoteLoginReady" | "remoteLoginStarting";
/**
 * Select the login message shown beside a platform button.
 * @param status Latest Host status.
 * @param starting Whether the browser is submitting a login request.
 * @returns A locale key for the pending or unavailable state, if present.
 */
export declare function platformLoginMessage(status: BrowserPlatformStatusView | undefined, starting?: boolean): "platformLoginPending" | "platformBrowserMissing" | "platformDisplayMissing" | undefined;
