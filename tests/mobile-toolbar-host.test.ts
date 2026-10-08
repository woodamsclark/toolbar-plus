import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  desiredHostState,
  MobileToolbarHost,
  type MobileHostState,
} from "../src/mobile-toolbar-host.ts";

test("desired host state covers dock, float, movement, and unavailable hosts", () => {
  const base = {
    mobile: true,
    mode: "docked" as const,
    pluginVisible: true,
    movingFromDocked: false,
    movingFromFloating: false,
    nativeToolbarOpen: true,
    nativeHostAvailable: true,
  };
  assert.equal(desiredHostState(base), "docked");
  assert.equal(desiredHostState({ ...base, mode: "floating" }), "floating");
  assert.equal(
    desiredHostState({ ...base, movingFromDocked: true }),
    "floating",
  );
  assert.equal(
    desiredHostState({
      ...base,
      mode: "floating",
      movingFromFloating: true,
    }),
    "dock-target",
  );
  assert.equal(
    desiredHostState({
      ...base,
      mode: "floating",
      movingFromFloating: true,
      nativeToolbarOpen: false,
    }),
    "floating",
  );
  assert.equal(desiredHostState({ ...base, pluginVisible: false }), "restored");
  assert.equal(desiredHostState({ ...base, mobile: false }), "restored");
});

test("one host controller owns every bar and target transition", () => {
  const dom = new JSDOM(
    '<body><div class="app-container"><main></main><div class="mobile-toolbar-spacer"></div><div class="mobile-toolbar"><button id="native"></button></div></div><div id="root"><div id="bar"></div><div id="target"></div></div></body>',
  );
  const doc = dom.window.document;
  const root = doc.querySelector<HTMLElement>("#root")!;
  const bar = doc.querySelector<HTMLElement>("#bar")!;
  const target = doc.querySelector<HTMLElement>("#target")!;
  const native = doc.querySelector<HTMLElement>(".mobile-toolbar")!;
  const spacer = doc.querySelector<HTMLElement>(".mobile-toolbar-spacer")!;
  const host = new MobileToolbarHost(doc, root, bar, target);

  const reconcile = (state: MobileHostState) => {
    host.reconcile(state);
    assert.equal(root.dataset.tpHostState, state);
  };

  reconcile("docked");
  assert.equal(
    doc.documentElement.classList.contains("tp-mobile-toolbar-collapsed"),
    false,
  );
  assert.equal(bar.parentElement, native);
  assert.equal(target.parentElement, root);
  assert.equal(bar.classList.contains("tp-in-native"), true);
  assert.equal(native.dataset.tpHostState, "docked");

  reconcile("floating");
  assert.equal(
    doc.documentElement.classList.contains("tp-mobile-toolbar-collapsed"),
    true,
  );
  assert.equal(bar.parentElement, root);
  assert.equal(target.parentElement, root);
  assert.equal(native.isConnected, false);
  assert.equal(spacer.isConnected, false);
  assert.equal(doc.querySelector(".mobile-toolbar"), null);
  assert.equal(doc.querySelector(".mobile-toolbar-spacer"), null);
  assert.equal(native.classList.contains("tp-native-collapsed"), true);

  const delayedSpacer = doc.createElement("div");
  delayedSpacer.className = "mobile-toolbar-spacer";
  doc.querySelector(".app-container")!.append(delayedSpacer);
  assert.equal(host.containsNativeHost(delayedSpacer), true);
  reconcile("floating");
  assert.equal(delayedSpacer.isConnected, false);

  reconcile("dock-target");
  assert.equal(
    doc.documentElement.classList.contains("tp-mobile-toolbar-collapsed"),
    false,
  );
  assert.equal(bar.parentElement, root);
  assert.equal(target.parentElement, native);
  assert.equal(native.isConnected, true);
  assert.equal(spacer.isConnected, true);
  assert.equal(delayedSpacer.isConnected, true);
  assert.equal(target.classList.contains("tp-target-in-native"), true);
  assert.equal(native.classList.contains("tp-native-collapsed"), false);

  reconcile("docked");
  const replacement = doc.createElement("div");
  replacement.className = "mobile-toolbar";
  native.replaceWith(replacement);
  host.refreshNativeHost();
  host.reconcile(host.currentState);
  assert.equal(native.classList.contains("tp-native-replaced"), false);
  assert.equal(bar.parentElement, replacement);
  assert.equal(replacement.dataset.tpHostState, "docked");

  host.dispose();
  assert.equal(
    doc.documentElement.classList.contains("tp-mobile-toolbar-collapsed"),
    false,
  );
  assert.equal(bar.parentElement, root);
  assert.equal(target.parentElement, root);
  assert.equal(replacement.classList.contains("tp-native-replaced"), false);
  assert.equal(replacement.dataset.tpHostState, undefined);
  assert.equal(spacer.isConnected, true);
  assert.equal(root.dataset.tpHostState, undefined);
  dom.window.close();
});
