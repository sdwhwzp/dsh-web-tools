import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import type { CdpPageLease } from "../src/host/browser/types.ts";
import { findVisibleXhsSearchControl, navigateXhsSearchViaUi } from "../src/host/sources/xiaohongshu/ui-search.ts";

function fakePage(
  initialState: "ready" | "login-wall" = "ready",
  afterSubmitState: "ready" | "login-wall" = "ready",
  layout: "legacy" | "feeds" = "legacy",
  unavailableSamples = 0,
) {
  const calls = { navigated: [] as string[], query: "", submitted: false, focused: "", clicked: false, key: "", controlSamples: 0 };
  const page = {
    navigate: async (url: string) => { calls.navigated.push(url); },
    waitForLoad: async () => {},
    waitForSelector: async () => {},
    call: async (fn: { name?: string }, _args?: unknown[]) => {
      if (fn.name === "findVisibleXhsSearchControl") {
        if (++calls.controlSamples <= unavailableSamples) return null;
        return layout === "feeds" ? "#search-input-in-feeds" : "#search-input";
      }
      if (fn.name === "detectXhsPageState") return calls.submitted ? afterSubmitState : initialState;
      if (fn.name === "extractXhsSearchState") {
        return { available: true, feeds: [{ id: "note" }] };
      }
      return undefined;
    },
    focus: async (selector: string) => {
      calls.focused = selector;
      return selector === (layout === "feeds" ? "#search-input-in-feeds" : "#search-input");
    },
    insertText: async (text: string) => { calls.query = text; },
    click: async () => {
      calls.clicked = true;
      calls.submitted = true;
      return true;
    },
    pressKey: async (key: string) => { calls.key = key; calls.submitted = true; },
    evaluate: async (expression: string) => {
      if (expression === "location.href") {
        return calls.submitted
          ? `https://www.xiaohongshu.com/${layout === "feeds" ? "search_result_ai" : "search_result"}?keyword=DeepSeek%20Harness`
          : "https://www.xiaohongshu.com/explore";
      }
      if (expression.includes("section.note-item")) return 1;
      return undefined;
    },
  } as unknown as CdpPageLease;
  return { page, calls };
}

test("XHS UI search navigates through explore and enters only the cleaned topic query", async () => {
  const { page, calls } = fakePage();
  const result = await navigateXhsSearchViaUi(page, "DeepSeek Harness");

  assert.deepEqual(calls.navigated, ["https://www.xiaohongshu.com/explore"]);
  assert.equal(calls.query, "DeepSeek Harness");
  assert.equal(calls.submitted, true);
  assert.equal(result.state, "ready");
  assert.equal(result.stage, "after-submit");
  assert.match(result.url, /search_result/);
});

test("XHS UI search labels a post-submit login wall as search-stage restricted", async () => {
  const { page } = fakePage("ready", "login-wall");
  const result = await navigateXhsSearchViaUi(page, "DeepSeek Harness");

  assert.equal(result.state, "login-wall");
  assert.equal(result.stage, "after-submit");
});

test("XHS UI search stops at a visible login wall instead of clicking or timing out", async () => {
  const { page, calls } = fakePage("login-wall");
  const result = await navigateXhsSearchViaUi(page, "DeepSeek Harness");

  assert.equal(result.state, "login-wall");
  assert.equal(result.stage, "explore");
  assert.equal(calls.query, "");
  assert.equal(calls.submitted, false);
});

test("XHS UI search submits the visible feeds textarea while the legacy input is hidden", async () => {
  const { page, calls } = fakePage("ready", "ready", "feeds");
  const result = await navigateXhsSearchViaUi(page, "武汉旅游攻略");

  assert.equal(result.state, "ready");
  assert.equal(calls.focused, "#search-input-in-feeds");
  assert.equal(calls.query, "武汉旅游攻略");
  assert.equal(calls.clicked, false);
  assert.equal(calls.key, "Enter");
});

// Linkedom supplies DOM ancestry; the fixture supplies measured layout values because it has no layout engine.
function selectControl(html: string) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  for (const element of Array.from(document.querySelectorAll("input, textarea"))) {
    Object.assign(element, {
      disabled: element.hasAttribute("disabled"),
      readOnly: element.hasAttribute("readonly"),
      getBoundingClientRect: () => ({ width: element.closest('[data-zero-size]') ? 0 : 400, height: 40 }),
    });
  }
  return vm.runInNewContext(`(${findVisibleXhsSearchControl.toString()})()`, {
    document,
    getComputedStyle: (element: Element) => ({
      display: "block",
      visibility: element.getAttribute("data-visibility") ?? "visible",
    }),
  }) as ReturnType<typeof findVisibleXhsSearchControl>;
}

test("serialized search field detection records both layouts and rejects unavailable controls", () => {
  const actual = {
    legacy: selectControl('<input id="search-input">'),
    feeds: selectControl('<header data-zero-size><input id="search-input"></header><textarea aria-hidden="true" placeholder="搜索小红书"></textarea><textarea id="search-input-in-feeds"></textarea>'),
    hiddenFeeds: selectControl('<textarea id="search-input-in-feeds" data-visibility="hidden"></textarea><input id="search-input">'),
    readOnlyFeeds: selectControl('<textarea id="search-input-in-feeds" readonly></textarea><input id="search-input">'),
    disabled: selectControl('<textarea id="search-input-in-feeds" disabled></textarea>'),
    hiddenAncestor: selectControl('<div aria-hidden="true"><textarea id="search-input-in-feeds"></textarea></div>'),
    inert: selectControl('<div inert><input id="search-input"></div>'),
    zeroSize: selectControl('<header data-zero-size><input id="search-input"></header>'),
    noControl: selectControl('<div>首页</div>'),
  };
  assert.deepEqual(actual, JSON.parse(readFileSync(new URL("./expected/xhs-search-controls.json", import.meta.url), "utf8")));
});

test("XHS UI search identifies a field that cannot gain focus before sending query text", async () => {
  const { page, calls } = fakePage();
  page.focus = async () => false;
  const result = await navigateXhsSearchViaUi(page, "武汉旅游攻略");
  assert.equal(result.state, "search-control-unavailable");
  assert.equal(result.stage, "explore");
  assert.equal(calls.query, "");
  assert.equal(calls.submitted, false);
});

test("XHS UI search waits for a usable field while the page finishes changing layout", async () => {
  const { page, calls } = fakePage("ready", "ready", "feeds", 1);
  assert.equal((await navigateXhsSearchViaUi(page, "武汉旅游攻略")).state, "ready");
  assert.equal(calls.controlSamples, 2);
  assert.equal(calls.focused, "#search-input-in-feeds");
});
