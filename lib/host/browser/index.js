import { SessionManager } from "./session-manager.js";
import { DEFAULT_BROWSER_SETTINGS } from "./remote-login.js";
import { launchBrowserProcess } from "./process-manager.js";
export * from "./types.js";
export * from "./locator.js";
export * from "./paths.js";
export * from "./port.js";
export * from "./profile-store.js";
export * from "./state-store.js";
export * from "./process-manager.js";
export * from "./session-manager.js";
export * from "./cdp/client.js";
export * from "./cdp/connection.js";
export * from "./cdp/page.js";
export * from "./cdp/errors.js";
export function createNativeBrowserRuntime(browserChoice = "auto", baseDirOverride, idleShutdownMs, readBrowserSettings = () => DEFAULT_BROWSER_SETTINGS) {
    return new SessionManager(browserChoice, baseDirOverride, idleShutdownMs, (browser, profile, url, minimized, headless) => launchBrowserProcess(browser, profile, url, minimized, headless, readBrowserSettings().browserDisplay, readBrowserSettings().browserXauthority), undefined, undefined, undefined, undefined, readBrowserSettings);
}
