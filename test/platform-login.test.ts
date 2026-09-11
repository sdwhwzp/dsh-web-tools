import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loginUnavailableReason } from "../src/host/browser/login-environment.ts";
import { SessionManager } from "../src/host/browser/session-manager.ts";
import { platformLoginMessage } from "../src/client/platform-login.ts";
import { getPlatformPollIntervalMs, arePlatformStatusesEqual } from "../src/client/platform-polling.ts";
import { zhDict, enDict } from "../src/client/i18n-dict.ts";
import type { BrowserPlatformStatusView, PlatformStatusResponse } from "../src/shared/platform-types.ts";

test("login distinguishes a missing browser from a Linux display requirement", () => {
  assert.equal(loginUnavailableReason(false, "linux", {}), "browser-missing");
  assert.equal(loginUnavailableReason(true, "linux", {}), "display-missing");
  assert.equal(loginUnavailableReason(true, "linux", { DISPLAY: ":1" }), undefined);
  assert.equal(loginUnavailableReason(true, "linux", { WAYLAND_DISPLAY: "wayland-0" }), undefined);
  assert.equal(loginUnavailableReason(true, "darwin", {}), undefined);
});

test("concurrent login requests share startup and retain its error until retry or reset", async () => {
  const home = await mkdtemp(join(tmpdir(), "dsh-login-feedback-"));
  let signalEntered!: () => void;
  const entered = new Promise<void>((resolve) => { signalEntered = resolve; });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let launches = 0;
  const runtime = new SessionManager("auto", home, 0, async () => {
    launches++;
    signalEntered();
    await gate;
    throw new Error("Browser failed to start");
  });
  runtime.detect = async () => ({ kind: "chrome", executablePath: "/test/browser" });
  const first = assert.rejects(runtime.login("x"), /Browser failed to start/);
  const second = assert.rejects(runtime.login("x"), /Browser failed to start/);
  try {
    await entered;
    assert.equal((await runtime.status("x")).loginPending, true);
    assert.equal(launches, 1);
    release();
    await Promise.all([first, second]);
    const failed = await runtime.status("x");
    assert.equal(failed.loginPending, false);
    assert.equal(failed.lastError, "Browser failed to start");
    await assert.rejects(runtime.login("x"), /Browser failed to start/);
    assert.equal(launches, 2);
    await runtime.resetSession("x");
    assert.equal((await runtime.status("x")).lastError, undefined);
  } finally {
    release();
    await Promise.all([first, second]);
    await runtime.dispose();
    await rm(home, { recursive: true });
  }
});

test("platform login presentation snapshot covers missing prerequisites and a pending ready browser", async () => {
  const base: BrowserPlatformStatusView = { id: "x", name: "X", enabled: true, runtimeAvailable: true, runtimeState: "ready", authenticated: false };
  const cases: Array<[string, Partial<BrowserPlatformStatusView>, boolean]> = [
    ["missing-browser", { runtimeAvailable: false, loginUnavailableReason: "browser-missing" }, false],
    ["missing-display", { loginUnavailableReason: "display-missing" }, false],
    ["request-starting", {}, true],
    ["awaiting-user", { loginPending: true }, false],
    ["signed-out", {}, false],
  ];
  const actual = cases.map(([name, patch, starting]) => {
    const status = { ...base, ...patch };
    const key = platformLoginMessage(status, starting);
    return { name, message: key ? { zh: zhDict[key], en: enDict[key] } : null };
  });
  assert.deepEqual(actual, JSON.parse(await readFile(new URL("./expected/platform-login.json", import.meta.url), "utf8")));
  const stopped: PlatformStatusResponse = { platforms: { x: base, xiaohongshu: { ...base, id: "xiaohongshu" } } };
  const pending: PlatformStatusResponse = { platforms: { ...stopped.platforms, x: { ...base, loginPending: true } } };
  assert.equal(arePlatformStatusesEqual(stopped, pending), false);
  assert.equal(getPlatformPollIntervalMs(true, pending), 2000);
  assert.equal(getPlatformPollIntervalMs(false, pending), 0);
});
