import assert from "node:assert/strict";
import test from "node:test";
import { RemoteLoginSession, DEFAULT_BROWSER_SETTINGS, remoteLoginOptions, parseRemoteLoginInput } from "../src/host/browser/remote-login.ts";
import type { CdpClient } from "../src/host/browser/cdp/client.ts";
import { readFile } from "node:fs/promises";
import { remoteLoginStatusKey } from "../src/client/platform-login.ts";
import { zhDict, enDict } from "../src/client/i18n-dict.ts";

function fixture() {
  let now = 1000;
  let url = "https://x.com/i/flow/login";
  const calls: Array<{ method: string; params: Record<string, unknown>; sessionId?: string }> = [];
  const cdp = { async send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    calls.push({ method, params, sessionId });
    if (method === "Target.getTargetInfo") return { targetInfo: { url } };
    if (method === "Page.captureScreenshot") return { data: "dGVzdA==" };
    return {};
  } } as unknown as CdpClient;
  const options = remoteLoginOptions(DEFAULT_BROWSER_SETTINGS);
  const remote = new RemoteLoginSession("x", options, () => now);
  return { remote, options, cdp, calls, advance: (ms: number) => { now += ms; }, navigate: (next: string) => { url = next; } };
}

test("remote view captures one fixed platform tab and translates only bounded input", async () => {
  const f = fixture();
  try {
    assert.equal(f.remote.view().state, "starting");
    await f.remote.attach(f.cdp, "login-target", "login-session");
    const [one, two] = await Promise.all([f.remote.frame(), f.remote.frame()]);
    assert.equal(one.image, "data:image/jpeg;base64,dGVzdA==");
    assert.equal(one, two);
    assert.equal(f.calls.filter(c => c.method === "Page.captureScreenshot").length, 1);
    await f.remote.input({ type: "pointer", action: "down", x: 10, y: 20 });
    await f.remote.input({ type: "pointer", action: "move", x: 30, y: 20 });
    await f.remote.input({ type: "pointer", action: "up", x: 30, y: 20 });
    await f.remote.input({ type: "text", text: "用户输入" });
    await f.remote.input({ type: "key", key: "Tab", shift: true });
    await f.remote.input({ type: "wheel", x: 100, y: 100, deltaY: 300 });
    const inputs = f.calls.filter(c => c.method.startsWith("Input."));
    assert.ok(inputs.every(c => c.sessionId === "login-session"));
    assert.equal(inputs[1].params.buttons, 1);
    assert.equal(inputs[2].params.buttons, 0);
    assert.deepEqual(inputs[3].params, { text: "用户输入" });
    assert.equal(inputs[4].params.modifiers, 8);
    f.remote.finish(true);
    assert.equal((await f.remote.frame()).state, "authenticated");
    assert.equal((await f.remote.frame()).image, undefined);
    await assert.rejects(f.remote.input({ type: "text", text: "not sent" }), /not active/);
  } finally { await f.remote.close(); }
});

test("remote login output snapshot follows startup, active control and authentication", async () => {
  const f = fixture();
  try {
    const views = [f.remote.view()];
    await f.remote.attach(f.cdp, "target", "session");
    views.push(await f.remote.frame());
    f.remote.finish(true);
    views.push(await f.remote.frame());
    const actual = views.map(view => ({ state: view.state, width: view.width, height: view.height,
      image: Boolean(view.image), zh: zhDict[remoteLoginStatusKey(view.state)], en: enDict[remoteLoginStatusKey(view.state)] }));
    assert.deepEqual(actual, JSON.parse(await readFile(new URL("./expected/remote-login.json", import.meta.url), "utf8")));
  } finally { await f.remote.close(); }
});

test("remote login refuses arbitrary commands, out-of-range coordinates and oversized input", () => {
  const { options } = fixture();
  for (const value of [null, [], { type: "evaluate", expression: "document.cookie" }, { type: "key", key: "F12" },
    { type: "text", text: "x".repeat(4097) }, { type: "pointer", action: "down", x: NaN, y: 1 },
    { type: "pointer", action: "down", x: options.width, y: 1 }, { type: "wheel", x: 1, y: 1, deltaY: 2001 }]) {
    assert.throws(() => parseRemoteLoginInput(value, options), /Invalid remote login/);
  }
});

test("a remote login rejects another domain and expires after no heartbeat", async () => {
  const f = fixture();
  try {
    await f.remote.attach(f.cdp, "target", "session");
    f.navigate("http://127.0.0.1/admin");
    await assert.rejects(f.remote.frame(), /left the selected platform/);
    await assert.rejects(f.remote.input({ type: "text", text: "never send" }), /left the selected platform/);
    assert.equal(f.calls.some(c => c.method === "Page.captureScreenshot" || c.method === "Input.insertText"), false);
    f.advance(f.options.idleTimeoutMs);
    assert.equal(f.remote.expired(), true);
    f.remote.touch();
    f.advance(f.options.timeoutMs);
    assert.equal(f.remote.expired(), true);
  } finally { await f.remote.close(); }
});

test("revocation waits for an issued input and prevents queued input from reaching the page", async () => {
  const f = fixture();
  let entered!: () => void, release!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const send = f.cdp.send.bind(f.cdp);
  f.cdp.send = async (method, ...args) => {
    if (method === "Input.insertText") { entered(); await gate; }
    return send(method, ...args);
  };
  await f.remote.attach(f.cdp, "target", "session");
  const first = f.remote.input({ type: "text", text: "first" });
  await ready;
  const second = assert.rejects(f.remote.input({ type: "text", text: "second" }), /not active/);
  let closed = false;
  const close = f.remote.close().then(() => { closed = true; });
  try {
    assert.equal(closed, false);
  } finally {
    release();
    await Promise.all([first, second, close]);
  }
  assert.equal(f.calls.filter(c => c.method === "Input.insertText").length, 1);
  assert.equal(closed, true);
});
