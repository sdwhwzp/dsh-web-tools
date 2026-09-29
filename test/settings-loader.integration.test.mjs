/** Real Harness Loader persistence and SettingsForms policy lifecycle. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { Config, installConfig } from "../lib/host/config.js";

const runtime = process.env.DSH_TOOL_WEB_NM;
test("Harness 0.2 persists custom Loader settings and restores them without losing live reads", {
  skip: runtime ? false : "set DSH_TOOL_WEB_NM to validate real Loader persistence",
}, async (t) => {
  const load = (name) => import(pathToFileURL(join(runtime, name, "lib/index.js")).href);
  const { boot, initProfile, readProfilePatches } = await load("dsh-app-boot");
  const { default: ConfigEditor } = await load("dsh-config-editor");
  const { default: Settings } = await load("dsh-settings");
  const home = realpathSync(mkdtempSync(join(tmpdir(), "web-tools-settings-")));
  const roots = [];
  t.after(async () => {
    for (const root of roots.reverse()) await root.fiber.dispose();
    rmSync(home, { recursive: true, force: true });
  });
  const dir = join(home, "profiles", "test");
  initProfile(dir, ["test-bundle"]);
  const bundle = join(dir, "node_modules", "test-bundle");
  mkdirSync(bundle, { recursive: true });
  writeFileSync(join(home, "package.json"), '{"name":"test-installation"}\n');
  writeFileSync(join(bundle, "package.json"), JSON.stringify({ name: "test-bundle", version: "1.0.0", dsh: { bundle: { patch: "cordis.patch.yml" } } }));
  writeFileSync(join(bundle, "cordis.patch.yml"), JSON.stringify([{ insert: [
    { id: "config-editor", name: "cordis:editor" },
    { id: "settings", name: "cordis:settings" },
    { id: "custom-web-tools", name: "cordis:probe", config: { defaultProvider: "tavily", cacheTtlSeconds: 120 } },
    { id: "other-web-tools", name: "cordis:probe", config: { defaultProvider: "bing" } },
  ] }]));
  writeFileSync(join(dir, "cordis.yml"), "[]\n");
  const profile = {
    name: "test", startedBundles: ["test-bundle"], dir, patchPath: join(dir, "cordis.patch.yml"),
    installAnchor: join(home, "package.json"), cwd: home, home, overlays: [], telemetryDisabledEnv: undefined,
  };
  const handles = new Map();
  const start = async () => {
    const ctx = await boot("test", join(dir, "cordis.yml"), readProfilePatches("test", profile), (ctx) => {
      ctx.provide("profileContext", profile);
      ctx.provide("appReady", { onReady: (listener) => { listener(); return () => {}; } });
      Object.assign(ctx.loader.builtins, {
        editor: ConfigEditor, settings: Settings,
        probe: { Config, apply: (owner, config) => { handles.set(owner.fiber.entry.options.id, installConfig(owner, config)); } },
      });
    });
    roots.push(ctx);
    await ctx.loader.await();
    return ctx;
  };
  const ctx = await start();
  const handle = handles.get("custom-web-tools");
  const row = () => ctx.settings.describe().find(row => row.ns === "custom-web-tools");
  assert.equal(row().autoGenerate, false);
  assert.equal(handle.read().defaultProvider, "tavily");
  const entry = ctx.configEditor.entries().find(entry => entry.options.id === "custom-web-tools");
  const owner = entry.fiber;
  await handle.write({ cacheTtlSeconds: 90 });
  assert.equal(entry.fiber, owner, "volatile settings must preserve plugin lifetime");
  assert.equal(handle.read().cacheTtlSeconds, 90);
  assert.match(readFileSync(profile.patchPath, "utf8"), /cacheTtlSeconds: 90/);
  assert.equal(handles.get("other-web-tools").read().defaultProvider, "bing");
  await ctx.settings.update("custom-web-tools", { defaultProvider: "brave" }, row().revision);
  assert.equal(handle.read().defaultProvider, "brave");
  await assert.rejects(handle.write({ cacheTtlSeconds: 301 }), /cacheTtlSeconds|300/);
  assert.equal(handle.read().cacheTtlSeconds, 90);
  const provider = ctx.configEditor.entries().find(entry => entry.options.id === "settings");
  await provider.update({ disabled: true });
  await provider.update({ disabled: false });
  await ctx.loader.await();
  // Optional injections settle after the Loader row itself becomes active.
  const deadline = Date.now() + 5000;
  while (row().autoGenerate && Date.now() < deadline) await delay(5);
  assert.equal(row().autoGenerate, false, "presentation is reinstated after service remount");
  await handle.write({ cacheTtlSeconds: 80 });
  assert.equal(handle.read().cacheTtlSeconds, 80);
  await ctx.fiber.dispose();
  roots.splice(roots.indexOf(ctx), 1);
  await start();
  assert.equal(handles.get("custom-web-tools").read().cacheTtlSeconds, 80);
  assert.equal(handles.get("custom-web-tools").read().defaultProvider, "brave");
});
