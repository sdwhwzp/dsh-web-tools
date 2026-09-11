/** Host requirements for native browser login, independent of the Web client. */
import type { LoginUnavailableReason } from "../../shared/platform-types.ts";
/**
 * Describe a missing prerequisite for a Host-side login window.
 * @param browserAvailable Whether a supported browser was found.
 * @param platform Host operating system.
 * @param env Host display environment.
 * @returns The missing prerequisite, or undefined when a window can be attempted.
 */
export declare function loginUnavailableReason(browserAvailable: boolean, platform?: string, env?: Record<string, string | undefined>): LoginUnavailableReason | undefined;
