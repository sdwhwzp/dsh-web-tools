import type { CdpPageLease } from "../../browser/types.ts";
import {
  detectXhsPageState,
  waitForStableXhsPageState,
  type XhsPageState,
} from "../../browser/xiaohongshu-page-state.ts";
import {
  extractXhsSearchState,
} from "../browser-scripts/xiaohongshu.ts";

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
export function findVisibleXhsSearchControl(): "#search-input-in-feeds" | "#search-input" | null {
  for (const selector of ["#search-input-in-feeds", "#search-input"] as const) {
    const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (!element || element.disabled || element.readOnly || element.closest('[aria-hidden="true"], [inert]')) continue;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (style.display !== "none" && style.visibility === "visible" && rect.width > 0 && rect.height > 0) return selector;
  }
  return null;
}

/**
 * Enter XHS search through the visible home-page controls, never a direct search URL.
 * @param page Operation-owned browser page.
 * @param query Topic text with the platform prefix already removed.
 * @param signal Cancellation for browser operations and readiness polling.
 * @returns Authentication, control availability, or submitted search readiness and its page URL.
 */
export async function navigateXhsSearchViaUi(
  page: CdpPageLease,
  query: string,
  signal?: AbortSignal,
): Promise<XhsSearchNavigationOutcome> {
  await page.navigate("https://www.xiaohongshu.com/explore", signal);
  await page.waitForLoad(signal);

  const initialState = await waitForStableXhsPageState(page, signal);
  if (initialState !== "ready") {
    return { state: initialState, stage: "explore", url: await page.evaluate<string>("location.href", signal) };
  }

  const controlDeadline = Date.now() + 8000;
  let selector: ReturnType<typeof findVisibleXhsSearchControl> = null;
  do {
    if (signal?.aborted) throw new Error("Xiaohongshu UI search aborted");
    selector = await page.call(findVisibleXhsSearchControl, [], signal);
    if (selector) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < controlDeadline);
  if (!selector || !await page.focus(selector, signal)) {
    return { state: "search-control-unavailable", stage: "explore", url: await page.evaluate<string>("location.href", signal) };
  }
  await page.insertText(query, signal);
  const clicked = selector === "#search-input" && await page.click(".input-button .search-icon, .input-button", signal);
  if (!clicked) await page.pressKey("Enter", signal);

  const startedAt = Date.now();
  let lastBlockedState: XhsPageState | undefined;
  let blockedRepeats = 0;
  while (Date.now() - startedAt < 12000) {
    if (signal?.aborted) throw new Error("Xiaohongshu UI search aborted");
    const state = await page.call(detectXhsPageState, [], signal);
    const url = await page.evaluate<string>("location.href", signal);
    if (state !== "ready") {
      if (state === lastBlockedState) blockedRepeats++;
      else {
        lastBlockedState = state;
        blockedRepeats = 1;
      }
      if (blockedRepeats >= 3) return { state, stage: "after-submit", url };
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    } else {
      lastBlockedState = undefined;
      blockedRepeats = 0;
    }

    if (url.includes("/search_result")) {
      const structured = await page.call(extractXhsSearchState, [], signal);
      const domCount = await page.evaluate<number>("document.querySelectorAll('section.note-item').length", signal);
      if ((structured.available && structured.feeds.length > 0) || domCount > 0) {
        return { state: "ready", stage: "after-submit", url };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return {
    state: "navigation-failed",
    stage: "after-submit",
    url: await page.evaluate<string>("location.href", signal),
  };
}
