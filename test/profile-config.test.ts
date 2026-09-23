import { test } from "node:test";
import assert from "node:assert/strict";
import { installConfig } from "../src/host/config.ts";
import type { WebToolsContext } from "../src/host/context-types.ts";

test("profile forms persist search settings on the exact Loader row", async () => {
  let value: Record<string, unknown> = { defaultProvider: "bing" };
  let revision = 3;
  let visible = true;
  let mount: (() => void) | undefined;
  const fiber: { entry?: { options: { id: string } }; config: Record<string, unknown> } = {
    entry: { options: { id: "custom-web-tools" } }, config: {},
  };
  const ctx = {
    fiber,
    settings: {
      describe: () => visible ? [{ ns: "custom-web-tools", value, revision }] : [],
      update: async (ns: string, patch: object, expected: number) => {
        assert.equal(ns, "custom-web-tools");
        assert.equal(expected, revision);
        value = { ...value, ...patch };
        revision++;
      },
    },
    inject: (_services: string[], callback: (ctx: WebToolsContext) => void) => { mount = () => callback(ctx as unknown as WebToolsContext); },
  };
  const handle = installConfig(ctx as unknown as WebToolsContext);
  let mounted = false;
  handle.onMounted(() => { mounted = true; });
  mount!();
  assert.equal(mounted, true);
  assert.equal(handle.read().defaultProvider, "bing");
  assert.equal(handle.read().enabled, true);
  await handle.write({ enabled: false });
  assert.equal(handle.read().enabled, false);
  assert.equal(handle.read().defaultProvider, "bing");
  visible = false;
  await assert.rejects(() => handle.write({ enabled: true }), /form is unavailable/);
  delete fiber.entry;
  await assert.rejects(() => handle.write({ enabled: true }), /Loader profile entry/);
});
