/** Locale keys for the platform login controls. */
import type { BrowserPlatformStatusView } from "../shared/platform-types.ts";
/**
 * Select the login message shown beside a platform button.
 * @param status Latest Host status.
 * @param starting Whether the browser is submitting a login request.
 * @returns A locale key for the pending or unavailable state, if present.
 */
export declare function platformLoginMessage(status: BrowserPlatformStatusView | undefined, starting?: boolean): "platformLoginPending" | "platformBrowserMissing" | "platformDisplayMissing" | undefined;
