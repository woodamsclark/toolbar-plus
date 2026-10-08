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
    '<body class="mod-toolbar-open"><div class="app-container"><main></main><div class="mobile-toolbar-spacer"></div><div class="mobile-toolbar"><button id="native"></button></div></div><div id="root"><div id="bar"></div><div id="target"></div></div></body>',
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

test("closing the keyboard while floating does not resurrect the native row on dock or unload", () => {
  for (const action of ["dock", "unload"] as const) {
    const dom = new JSDOM(
      '<body class="mod-toolbar-open"><main><div class="mobile-toolbar-spacer"></div><div class="mobile-toolbar"><button id="native-command"></button></div></main><div id="root"><div id="bar"></div><div id="target"></div></div></body>',
    );
    const doc = dom.window.document;
    const native = doc.querySelector<HTMLElement>(".mobile-toolbar")!;
    const spacer = doc.querySelector<HTMLElement>(".mobile-toolbar-spacer")!;
    const host = new MobileToolbarHost(
      doc,
      doc.querySelector<HTMLElement>("#root")!,
      doc.querySelector<HTMLElement>("#bar")!,
      doc.querySelector<HTMLElement>("#target")!,
    );
    host.reconcile("floating");
    native.remove();
    spacer.remove();
    doc.body.classList.remove("mod-toolbar-open");
    if (action === "dock") host.reconcile("restored");
    else host.dispose();
    assert.equal(native.isConnected, false, action);
    assert.equal(spacer.isConnected, false, action);
    assert.equal(native.classList.contains("tp-native-replaced"), false);
    assert.equal(
      doc.documentElement.classList.contains("tp-mobile-toolbar-collapsed"),
      false,
    );
    if (action === "dock") {
      doc.body.classList.add("mod-toolbar-open");
      doc.querySelector("main")!.append(spacer, native);
      host.reconcile("docked");
      assert.equal(doc.querySelector("#bar")!.parentElement, native);
      host.dispose();
      assert.equal(native.isConnected, true);
      assert.equal(spacer.isConnected, true);
    }
    dom.window.close();
  }
});
