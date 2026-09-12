import type { CdpPageLease } from "../../browser/types.ts";
import { type XhsPageState } from "../../browser/xiaohongshu-page-state.ts";
export type XhsSearchNavigationState = XhsPageState | "search-control-unavailable" | "navigation-failed";
export interface XhsSearchNavigationOutcome {
    state: XhsSearchNavigationState;
    stage: "explore" | "after-submit";
    url: string;
}
/**
 * Find the usable search field in either XHS home layout. Serialized into the browser by CdpPage.call.
 * @returns The visible, editable field selector, or null while neither field is usable.
 */
export declare function findVisibleXhsSearchControl(): "#search-input-in-feeds" | "#search-input" | null;
/**
 * Enter XHS search through the visible home-page controls, never a direct search URL.
 * @param page Operation-owned browser page.
 * @param query Topic text with the platform prefix already removed.
 * @param signal Cancellation for browser operations and readiness polling.
 * @returns Authentication, control availability, or submitted search readiness and its page URL.
 */
export declare function navigateXhsSearchViaUi(page: CdpPageLease, query: string, signal?: AbortSignal): Promise<XhsSearchNavigationOutcome>;
