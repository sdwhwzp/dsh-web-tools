/**
 * Describe a missing prerequisite for a Host-side login window.
 * @param browserAvailable Whether a supported browser was found.
 * @param platform Host operating system.
 * @param env Host display environment.
 * @returns The missing prerequisite, or undefined when a window can be attempted.
 */
export function loginUnavailableReason(browserAvailable, platform = process.platform, env = process.env) {
    if (!browserAvailable)
        return "browser-missing";
    if (platform === "linux" && !env.DISPLAY && !env.WAYLAND_DISPLAY)
        return "display-missing";
    return undefined;
}
