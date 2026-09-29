/** Built client compatibility with immutable modern platform modules. */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";

const MODERN_ICONS = [
  "IconChevronDownOutlineRegular", "IconChevronRightOutlineRegular", "IconGlobeOutlineRegular",
  "IconCloseOutlineRegular", "IconEditOutlineRegular", "IconPlusOutlineRegular",
  "IconRefreshOutlineRegular", "IconSearchOutlineRegular", "IconSettingsOutlineRegular", "IconTrashOutlineRegular",
];

test("built lib/client.js: loads with frozen Harness 0.2 primitives without mutating shared exports", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const vm = await import("node:vm");

  const clientJsPath = join(process.cwd(), "lib", "client.js");
  const code = readFileSync(clientJsPath, "utf8");

  const mockPrimitives: Record<string, any> = {
    Button: (props: any) => React.createElement("button", props),
    Input: (props: any) => React.createElement("input", props),
    Modal: (props: any) => React.createElement("div", props),
    Menu: (props: any) => React.createElement("div", props),
    StateDot: (props: any) => React.createElement("span", props),
  };

  // Modern DSH 0.1.7: only Regular icons are present
  for (const newName of MODERN_ICONS) {
    mockPrimitives[newName] = (props: any) => React.createElement("svg", props);
  }

  Object.freeze(mockPrimitives);
  const originalKeys = Object.keys(mockPrimitives);

  let loadedModule: any = null;
  const mockWindow: any = {
    document: {
      head: {
        appendChild: () => {},
      },
      getElementById: () => null,
      createElement: () => ({ setAttribute: () => {}, textContent: "" }),
    },
    __ModuleLoader__: {
      load: ({ id, factory }: { id: string; factory: (req: any) => any }) => {
        const mockRequire = (modName: string) => {
          if (modName === "react") return React;
          if (modName === "react/jsx-runtime") return { jsx: React.createElement, jsxs: React.createElement, Fragment: React.Fragment };
          if (modName === "@deepseek-ai/dsh-client-ui-primitives") return mockPrimitives;
          return {};
        };
        loadedModule = factory(mockRequire);
      },
    },
  };

  const context = vm.createContext({
    window: mockWindow,
    document: mockWindow.document,
    console,
    setTimeout,
    clearTimeout,
  });

  vm.runInContext(code, context);

  assert.ok(loadedModule, "lib/client.js factory must execute and return exports");
  assert.equal(typeof loadedModule.apply, "function", "apply must be exported");

  assert.deepEqual(Object.keys(mockPrimitives), originalKeys);
  for (const name of MODERN_ICONS) assert.ok(code.includes(name), `bundle uses ${name}`);
});
