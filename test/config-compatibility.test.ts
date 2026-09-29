/** Loader settings lifecycle, live getter reads, and legacy namespace compatibility. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { installConfig, DEFAULT_SETTINGS, SETTINGS_NS } from "../src/host/config.ts";
import type { WebToolsContext, WebToolsWebSeam } from "../src/host/context-types.ts";
import { apply } from "../src/host/index.ts";

function fixture() {
  let value: Record<string, unknown> | undefined;
  let revision = 3;
  let reject = false;
  let mount: (() => void) | undefined;
  const writes: Array<{ ns: string; patch: object; revision?: number }> = [];
  const disposers: Array<() => void> = [];
  let presentation: object | undefined;
  let search: Parameters<WebToolsWebSeam["registerSearchProvider"]>[0] | undefined;
  const ctx: WebToolsContext = {
    fiber: { entry: { options: { id: "custom-web-tools" } } },
    settings: {
      describe: () => [{ ns: "custom-web-tools", value, revision, applies: "live" }],
      update: async (ns, patch, expected) => {
        writes.push({ ns, patch, revision: expected });
        if (reject) throw new Error("stale form revision");
        assert.equal(expected, revision);
        value = { ...value, ...patch };
        revision++;
      },
      configure: (options, owner) => {
        assert.equal(owner, ctx.fiber);
        presentation = options;
        return () => { presentation = undefined; };
      },
    },
    webServer: { register: () => () => {} },
    webRuntime: { trustedHosts: ["127.0.0.1"] },
    credentials: {
      resolve: async () => undefined, set: async () => {}, unset: async () => {}, describe: async () => ({}),
    },
    web: {
      registerSearchProvider: (provider) => { search = provider; return () => {}; },
      registerFetchProvider: () => () => {},
    },
    commands: { register: () => () => {} },
    on: () => () => {},
    get: () => undefined,
    effect: (callback) => { const dispose = callback(); if (dispose) disposers.push(dispose); },
    inject: (_deps, callback) => { mount = () => callback(ctx); },
  };
  return {
    ctx, writes, mount: () => mount!(), dispose: () => disposers.splice(0).reverse().forEach(fn => fn()),
    setValue: (next: Record<string, unknown>) => { value = next; revision++; },
    rejectWrites: () => { reject = true; },
    presentation: () => presentation, search: () => search,
  };
}

test("Loader config is readable before mount and callbacks run before and after injection", () => {
  const f = fixture();
  const handle = installConfig(f.ctx, { defaultProvider: "tavily", enabled: undefined });
  assert.equal(handle.read().defaultProvider, "tavily");
  assert.equal(handle.read().enabled, DEFAULT_SETTINGS.enabled);
  let callbacks = 0;
  handle.onMounted(() => callbacks++);
  assert.equal(callbacks, 0);
  f.mount();
  assert.equal(callbacks, 1);
  handle.onMounted(() => callbacks++);
  assert.equal(callbacks, 2);
  assert.deepEqual(f.presentation(), { auto: false });
  f.dispose();
  assert.equal(f.presentation(), undefined);
});

test("live form reads and writes use the custom Loader row and latest revision", async () => {
  const f = fixture();
  const handle = installConfig(f.ctx, { defaultProvider: "tavily" });
  f.mount();
  await handle.write({ defaultProvider: "brave" });
  assert.deepEqual(f.writes[0], { ns: "custom-web-tools", patch: { defaultProvider: "brave" }, revision: 3 });
  assert.equal(handle.read().defaultProvider, "brave");
  f.setValue({ defaultProvider: "bing" });
  assert.equal(handle.read().defaultProvider, "bing");
  await handle.write({ enabled: false });
  assert.equal(f.writes[1].revision, 5);
  assert.equal(handle.read().enabled, false);
  f.rejectWrites();
  await assert.rejects(handle.write({ defaultProvider: "exa" }), /stale form revision/);
  assert.equal(handle.read().defaultProvider, "bing");
  f.dispose();
});

test("volatile getters are reread from initial config, Loader config, and form values", () => {
  const f = fixture();
  let provider = "tavily";
  const getters = { defaultProvider: { get: () => provider }, fallbackOrder: [{ get: () => "bing" }] };
  const handle = installConfig(f.ctx, getters);
  assert.equal(handle.read().defaultProvider, "tavily");
  provider = "brave";
  assert.equal(handle.read().defaultProvider, "brave");
  assert.deepEqual(handle.read().fallbackOrder, ["bing"]);
  f.ctx.fiber!.config = getters;
  f.mount();
  provider = "ddg";
  assert.equal(handle.read().defaultProvider, "ddg");
  f.setValue({ defaultProvider: { get: () => "searxng" } });
  assert.equal(handle.read().defaultProvider, "searxng");
  f.dispose();
});

test("legacy namespace registration receives Loader defaults and reads the persisted scope", async () => {
  const f = fixture();
  let value = { ...DEFAULT_SETTINGS, defaultProvider: "searxng" };
  f.ctx.settings.register = <T>(ns: string, _schema: unknown, options?: { base?: Partial<T> }) => {
    assert.equal(ns, SETTINGS_NS);
    assert.equal((options?.base as Partial<typeof DEFAULT_SETTINGS>).defaultProvider, "tavily");
    return {
      get: () => value as T, watch: () => () => {}, replace: async () => {},
      update: async (patch: object) => { value = { ...value, ...patch }; },
    };
  };
  const handle = installConfig(f.ctx, { defaultProvider: "tavily" });
  f.mount();
  assert.equal(handle.read().defaultProvider, "searxng");
  await handle.write({ enabled: false });
  assert.equal(handle.read().enabled, false);
});

test("writes before settings mount are rejected", async () => {
  const f = fixture();
  const handle = installConfig(f.ctx);
  await assert.rejects(handle.write({ enabled: false }), /settings namespace is not mounted/);
  assert.equal(handle.read().enabled, true);
});

test("apply propagates initial Loader config into the registered provider and follows live edits", () => {
  const f = fixture();
  // Cordis may resolve an already-present dependency during apply().
  f.ctx.inject = (_deps, callback) => callback(f.ctx);
  apply(f.ctx, { enabled: false, defaultProvider: "tavily" });
  assert.ok(f.search());
  assert.equal(f.search()!.available(), false);
  f.setValue({ enabled: true });
  assert.equal(f.search()!.available(), true);
  f.dispose();
});

test("peer ranges admit Harness 0.1.7 and 0.2 while retaining the modern icon floor", async () => {
  const { readFileSync } = await import("node:fs");
  const { satisfies } = await import("semver");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  for (const [name, range] of Object.entries(pkg.peerDependencies)) {
    if (!name.startsWith("@deepseek-ai/dsh-")) continue;
    assert.equal(typeof range, "string");
    for (const runtime of ["0.1.7", "0.2.0-rc.1", "0.2.0"]) {
      assert.ok(satisfies(runtime, range as string), `${name} must admit ${runtime}`);
    }
    assert.equal(satisfies("0.3.0", range as string), false, `${name} must exclude unadapted 0.3`);
  }
  const icons = pkg.peerDependencies["@deepseek-ai/dsh-client-ui-primitives"];
  assert.ok(satisfies("0.1.7-alpha.2", icons));
  assert.equal(satisfies("0.1.0-rc.6", icons), false);
});
