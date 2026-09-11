import { SessionManager } from "./session-manager.ts";
import type { NativeBrowserRuntime } from "./types.ts";
import { DEFAULT_BROWSER_SETTINGS, type BrowserSettings } from "./remote-login.ts";
import { launchBrowserProcess } from "./process-manager.ts";

export * from "./types.ts";
export * from "./locator.ts";
export * from "./paths.ts";
export * from "./port.ts";
export * from "./profile-store.ts";
export * from "./state-store.ts";
export * from "./process-manager.ts";
export * from "./session-manager.ts";
export * from "./cdp/client.ts";
export * from "./cdp/connection.ts";
export * from "./cdp/page.ts";
export * from "./cdp/errors.ts";

export function createNativeBrowserRuntime(
  browserChoice: string | (() => string) = "auto",
  baseDirOverride?: string,
  idleShutdownMs?: number,
  readBrowserSettings: () => BrowserSettings = () => DEFAULT_BROWSER_SETTINGS,
): NativeBrowserRuntime {
  return new SessionManager(browserChoice, baseDirOverride, idleShutdownMs,
    (browser, profile, url, minimized, headless) => launchBrowserProcess(browser, profile, url, minimized, headless, readBrowserSettings().browserDisplay, readBrowserSettings().browserXauthority),
    undefined, undefined, undefined, undefined, readBrowserSettings);
}
