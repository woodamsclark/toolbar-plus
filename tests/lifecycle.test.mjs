import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";
function harness(options = {}) {
  const dom = new JSDOM(
    '<body class="mod-toolbar-open"><div class="mobile-toolbar"></div></body>',
    {
      pretendToBeVisual: true,
    },
  );
  const w = dom.window;
  const proto = w.HTMLElement.prototype;
  proto.createEl = function (tag, options = {}) {
    const e = w.document.createElement(tag);
    if (options.cls) e.className = options.cls;
    if (options.text) e.textContent = options.text;
    for (const [k, v] of Object.entries(options.attr ?? {}))
      e.setAttribute(k, v);
    this.append(e);
    return e;
  };
  proto.createDiv = function (o) {
    return this.createEl("div", typeof o === "string" ? { cls: o } : o);
  };
  proto.createSpan = function (o) {
    return this.createEl("span", o);
  };
  proto.empty = function () {
    this.replaceChildren();
  };
  proto.addClass = function (...c) {
    this.classList.add(...c);
  };
  proto.removeClass = function (...c) {
    this.classList.remove(...c);
  };
  proto.toggleClass = function (c, b) {
    this.classList.toggle(c, b);
  };
  proto.setText = function (s) {
    this.textContent = s;
  };
  proto.setPointerCapture = function (id) {
    this.capture = id;
  };
  proto.hasPointerCapture = function (id) {
    return this.capture === id;
  };
  proto.releasePointerCapture = function () {
    delete this.capture;
  };
  const disposers = [],
    calls = [],
    editorCalls = [],
    saves = [],
    notices = [],
    errors = [];
  let settingTab;
  let ready;
  class Component {
    cleanups = [];
    register(fn) {
      this.cleanups.push(fn);
    }
    registerDomEvent(el, type, fn) {
      el.addEventListener(type, fn);
      this.register(() => el.removeEventListener(type, fn));
    }
    registerEvent() {}
    unload() {
      this.cleanups
        .splice(0)
        .reverse()
        .forEach((fn) => fn());
    }
  }
  class Plugin extends Component {
    addChild(child) {
      this.register(() => child.unload());
      return child;
    }
    register(fn) {
      disposers.push(fn);
    }
    registerDomEvent(el, type, fn) {
      el.addEventListener(type, fn);
      this.register(() => el.removeEventListener(type, fn));
    }
    registerEvent() {}
    addSettingTab(tab) {
      settingTab = tab;
    }
    addCommand() {}
    async loadData() {
      return { desktop: true };
    }
    async saveData(d) {
      saves.push(d);
    }
  }
  class Modal {
    constructor(app) {
      this.app = app;
      this.modalEl = w.document.createElement("section");
      this.contentEl = this.modalEl.createDiv();
    }
    setTitle(text) {
      this.modalEl.setAttribute("aria-label", text);
    }
    open() {
      w.document.body.append(this.modalEl);
      this.onOpen?.();
    }
    onClose() {}
    close() {
      this.onClose();
      this.modalEl.remove();
    }
  }
  const stub = {
    Plugin,
    Component,
    Platform: { isMobile: options.mobile ?? true },
    MarkdownView: class {},
    PluginSettingTab: class {
      containerEl = w.document.createElement("div");
    },
    Modal,
    FuzzySuggestModal: class extends Modal {
      setPlaceholder() {}
    },
    Notice: class {
      constructor(s) {
        notices.push(s);
      }
    },
    setIcon: (e, i) => {
      if (options.iconFails) throw Error("mount failure");
      e.setAttribute("data-icon", i);
    },
    getIconIds: () => [],
  };
  const ctx = {
    module: { exports: {} },
    exports: {},
    require: () => stub,
    window: w,
    document: w.document,
    navigator: w.navigator,
    MutationObserver: w.MutationObserver,
    Element: w.Element,
    ResizeObserver: options.ResizeObserver,
    requestAnimationFrame: w.requestAnimationFrame.bind(w),
    cancelAnimationFrame: w.cancelAnimationFrame.bind(w),
    getComputedStyle: w.getComputedStyle.bind(w),
    clearTimeout: w.clearTimeout.bind(w),
    console: { ...console, error: (...args) => errors.push(args) },
  };
  ctx.exports = ctx.module.exports;
  vm.runInNewContext(
    readFileSync(new URL("../main.js", import.meta.url), "utf8"),
    ctx,
  );
  const p = new ctx.module.exports.default();
  p.app = {
    workspace: {
      onLayoutReady: (fn) => (ready = fn),
      getActiveViewOfType: () =>
        options.activeView ?? {
          editor: {
            undo: () => editorCalls.push("undo"),
            redo: () => editorCalls.push("redo"),
            blur: () => editorCalls.push("blur"),
          },
        },
      on: () => ({}),
    },
    commands: {
      listCommands: () => [],
      executeCommandById: (id) => {
        calls.push(id);
        return id !== "missing";
      },
    },
  };
  const eventOn = (target, type, x = 100, y = 100, extra = {}) => {
    const e = new w.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientX: x,
      clientY: y,
      ...extra,
    });
    target.dispatchEvent(e);
  };
  const event = (type, x = 100, y = 100, extra = {}) =>
    eventOn(p.handle, type, x, y, extra);
  return {
    p,
    w,
    calls,
    editorCalls,
    saves,
    notices,
    errors,
    get settingTab() {
      return settingTab;
    },
    event,
    eventOn,
    async start() {
      await p.onload();
      ready();
    },
    async settle() {
      await new Promise((resolve) =>
        w.requestAnimationFrame(() => w.requestAnimationFrame(resolve)),
      );
    },
    end() {
      p.onunload();
      p.unload();
      disposers.reverse().forEach((f) => f());
      w.close();
    },
  };
}
test("immediate floating swipe executes once; returning to center cancels", async () => {
  const h = harness();
  await h.start();
  h.p.setMode("floating");
  h.event("pointerdown");
  h.event("pointermove", 150, 100);
  h.event("pointerup", 150, 100);
  assert.deepEqual(h.calls, ["workspace:next-tab"]);
  h.event("pointerdown");
  h.event("pointermove", 60, 60);
  h.event("pointermove", 100, 100);
  h.event("pointerup");
  assert.equal(h.calls.length, 1);
  h.end();
});
test("docked movement does not execute commands or open settings", async () => {
  const h = harness();
  await h.start();
  let taps = 0;
  h.p.configure = () => taps++;
  h.event("pointerdown");
  h.event("pointermove", 150, 100);
  h.event("pointerup", 150, 100);
  assert.equal(taps, 0);
  assert.equal(h.calls.length, 0);
  h.event("pointerdown");
  h.event("pointerup");
  assert.equal(taps, 1);
  h.end();
});
test("docked downward swipe hides the keyboard and other directions do nothing", async () => {
  const h = harness();
  await h.start();
  h.event("pointerdown");
  h.event("pointermove", 100, 150);
  h.event("pointerup", 100, 150);
  assert.equal(h.p.config.mode, "docked");
  assert.deepEqual(h.calls, ["editor:toggle-keyboard"]);
  h.event("pointerdown");
  h.event("pointermove", 150, 100);
  h.event("pointerup", 150, 100);
  assert.deepEqual(h.calls, ["editor:toggle-keyboard"]);
  h.end();
});
test("hold lifts, release detaches, hold over target docks, cancellation rolls back", async () => {
  const h = harness();
  const native = h.w.document.querySelector(".mobile-toolbar");
  const haptics = [];
  h.w.navigator.vibrate = (duration) => haptics.push(duration);
  await h.start();
  h.p.config.holdMs = 5;
  h.event("pointerdown");
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(h.p.interaction.kind, "moving");
  assert.equal(h.p.root.classList.contains("tp-can-dock"), false);
  assert.deepEqual(haptics, [18]);
  h.eventOn(h.w.document.body, "pointermove", 170, 200);
  h.eventOn(h.w.document.body, "pointerup", 170, 200);
  assert.equal(h.p.config.mode, "floating");
  h.p.target.getBoundingClientRect = () => ({
    left: 0,
    right: 500,
    top: 500,
    bottom: 560,
  });
  h.event("pointerdown");
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(h.p.target.textContent, "Dock toolbar");
  assert.equal(h.p.root.classList.contains("tp-can-dock"), true);
  assert.equal(h.p.target.parentElement, native);
  assert.equal(h.p.target.classList.contains("tp-target-in-native"), true);
  h.event("pointermove", 200, 530);
  h.event("pointerup", 200, 530);
  assert.equal(h.p.config.mode, "docked");
  assert.equal(h.p.target.parentElement, h.p.root);
  assert.equal(h.p.target.classList.contains("tp-target-in-native"), false);
  h.event("pointerdown");
  await new Promise((r) => setTimeout(r, 15));
  h.event("pointermove", 200, 100);
  h.event("pointercancel");
  assert.equal(h.p.config.mode, "docked");
  assert.equal(h.calls.length, 0);
  h.end();
});
test("holding a docked handle never offers a drop target and always detaches", async () => {
  const h = harness();
  await h.start();
  h.p.config.holdMs = 5;
  h.p.config.position = { x: 0.25, y: 0.4 };
  h.p.target.getBoundingClientRect = () => ({
    left: 0,
    right: 500,
    top: 500,
    bottom: 560,
  });
  h.event("pointerdown");
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(h.p.root.classList.contains("tp-can-dock"), false);
  h.event("pointermove", 200, 530);
  h.event("pointerup", 200, 530);
  assert.equal(h.p.config.mode, "floating");
  assert.deepEqual(h.calls, []);
  assert.equal(h.saves.length, 1);
  h.end();
});
test("keyboard target falls back to editor blur when toggle command is unavailable", async () => {
  const h = harness();
  h.p.app.commands.executeCommandById = (id) => {
    h.calls.push(id);
    return false;
  };
  await h.start();
  h.p.hideKeyboard();
  assert.deepEqual(h.calls, ["editor:toggle-keyboard"]);
  assert.deepEqual(h.editorCalls, ["blur"]);
  h.end();
});
test("clamps after resize; missing commands notify; unload restores native toolbar", async () => {
  const h = harness();
  await h.start();
  assert.equal(
    h.w.document
      .querySelector(".mobile-toolbar")
      .classList.contains("tp-native-replaced"),
    true,
  );
  h.p.setMode("floating");
  h.p.config.position = { x: 1, y: 1 };
  Object.defineProperty(h.w, "innerWidth", { value: 320, configurable: true });
  Object.defineProperty(h.w, "innerHeight", { value: 280, configurable: true });
  h.p.layout();
  assert.ok(parseFloat(h.p.handle.style.left) <= 264);
  assert.ok(parseFloat(h.p.handle.style.top) <= 216);
  h.p.execute({ id: "missing", icon: "x" });
  assert.equal(h.notices.length, 1);
  h.p.onunload();
  assert.equal(h.w.document.querySelector(".toolbar-plus"), null);
  assert.equal(
    h.w.document
      .querySelector(".mobile-toolbar")
      .classList.contains("tp-native-replaced"),
    false,
  );
  h.end();
});

test("docked toolbar follows the native keyboard toolbar while floating stays visible", async () => {
  const h = harness();
  const native = h.w.document.querySelector(".mobile-toolbar");
  const original = h.w.document.createElement("button");
  native.append(original);
  await h.start();
  assert.equal(h.p.root.hidden, false);
  assert.equal(h.p.bar.parentElement, native);
  assert.equal(h.p.bar.classList.contains("tp-in-native"), true);
  assert.equal(native.contains(original), true);
  assert.equal(native.classList.contains("tp-native-replaced"), true);
  h.w.document.body.classList.remove("mod-toolbar-open");
  h.p.layout();
  assert.equal(h.p.root.hidden, true);
  assert.equal(h.p.bar.parentElement, h.p.root);
  h.p.setMode("floating");
  assert.equal(h.p.root.hidden, false);
  assert.equal(h.p.bar.parentElement, h.p.root);
  assert.equal(native.contains(original), true);
  assert.equal(native.classList.contains("tp-native-replaced"), true);
  h.p.config.holdMs = 5;
  h.event("pointerdown");
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(h.p.target.parentElement, h.p.root);
  h.event("pointercancel");
  h.end();
});
test("blur cannot execute stale gestures", async () => {
  const h = harness();
  await h.start();
  h.p.setMode("floating");
  h.event("pointerdown");
  h.event("pointermove", 160, 100);
  h.w.dispatchEvent(new h.w.Event("blur"));
  h.event("pointerup", 160, 100);
  assert.equal(h.calls.length, 0);
  assert.equal(h.p.interaction, undefined);
  h.end();
});

test("mobile registry variants and unreadable settings do not prevent loading", async () => {
  const h = harness();
  h.p.loadData = async () => {
    throw new Error("mobile storage unavailable");
  };
  h.p.app.commands = {
    commands: {
      "editor:undo": { id: "editor:undo", name: "Undo from map" },
    },
  };
  await h.start();
  assert.equal(
    h.p.label({ id: "editor:undo", icon: "undo-2" }),
    "Undo from map",
  );
  assert.doesNotThrow(() => h.p.execute({ id: "editor:undo", icon: "undo-2" }));
  assert.equal(h.notices.length, 1);
  assert.deepEqual(h.editorCalls, ["undo"]);
  h.p.persist();
  await h.settle();
  assert.equal(
    h.saves.length,
    0,
    "temporary defaults must not overwrite unreadable saved bindings",
  );
  assert.ok(h.w.document.querySelector(".toolbar-plus"));
  h.end();
});

test("undo and redo use the public editor API when Obsidian omits palette commands", async () => {
  const h = harness();
  h.p.app.commands.executeCommandById = () => false;
  await h.start();
  assert.equal(h.p.label({ id: "editor:undo", icon: "undo-2" }), "Undo");
  h.p.execute({ id: "editor:undo", icon: "undo-2" });
  h.p.execute({ id: "editor:redo", icon: "redo-2" });
  assert.deepEqual(h.editorCalls, ["undo", "redo"]);
  h.end();
});

test("desktop opt-out applies to floating mode and re-enabling restores it", async () => {
  const h = harness({ mobile: false });
  await h.start();
  h.p.setMode("floating");
  h.p.config.desktop = false;
  h.p.refresh();
  assert.equal(h.p.root.hidden, true);
  h.p.config.desktop = true;
  h.p.refresh();
  assert.equal(h.p.root.hidden, false);
  h.end();
});

test("keyboard body-class changes update visibility without manual layout calls", async () => {
  const h = harness();
  await h.start();
  await h.settle();
  h.w.document.body.classList.remove("mod-toolbar-open");
  await h.settle();
  assert.equal(h.p.root.hidden, true);
  h.w.document.body.classList.add("mod-toolbar-open");
  await h.settle();
  assert.equal(h.p.root.hidden, false);
  const native = h.w.document.querySelector(".mobile-toolbar");
  native.remove();
  await h.settle();
  assert.equal(h.p.root.hidden, true);
  h.w.document.body.append(native);
  await h.settle();
  assert.equal(h.p.root.hidden, false);
  h.end();
});

test("manually docking while the keyboard is hidden returns on keyboard reopen", async () => {
  const h = harness();
  await h.start();
  h.p.setMode("floating");
  const native = h.w.document.querySelector(".mobile-toolbar");
  h.w.document.body.classList.remove("mod-toolbar-open");
  native.remove();
  await h.settle();

  h.p.setMode("docked");
  assert.equal(h.p.root.hidden, true);

  // iOS can signal focus before Obsidian restores the native toolbar.
  h.w.document.body.classList.add("mod-toolbar-open");
  h.w.document.body.dispatchEvent(new h.w.FocusEvent("focusin", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 120));
  h.w.document.body.append(native);
  await new Promise((resolve) => setTimeout(resolve, 180));
  await h.settle();

  assert.equal(h.p.root.hidden, false);
  assert.equal(native.classList.contains("tp-native-replaced"), true);
  h.end();
});

test("docked toolbar ignores native position and uses the visual viewport", async () => {
  const h = harness();
  Object.defineProperty(h.w, "visualViewport", {
    configurable: true,
    value: {
      offsetLeft: 0,
      offsetTop: 0,
      width: 390,
      height: 500,
      addEventListener() {},
      removeEventListener() {},
    },
  });
  await h.start();
  const native = h.w.document.querySelector(".mobile-toolbar");
  for (const nativeTop of [452, 480, 540]) {
    native.getBoundingClientRect = () => ({
      left: 0,
      right: 390,
      top: nativeTop,
      bottom: nativeTop + 48,
      width: 390,
      height: 48,
      x: 0,
      y: nativeTop,
      toJSON() {},
    });
    h.p.layout();
    assert.equal(h.p.root.style.getPropertyValue("--tp-top"), "452px");
  }
  assert.equal(h.p.root.style.getPropertyValue("--tp-bottom"), "");
  h.end();
});

test("visual viewport resize and scroll events reposition the docked toolbar", async () => {
  const h = harness();
  const listeners = new Map();
  const viewport = {
    offsetLeft: 12,
    offsetTop: 0,
    width: 390,
    height: 700,
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };
  Object.defineProperty(h.w, "visualViewport", {
    configurable: true,
    value: viewport,
  });
  await h.start();
  assert.equal(h.p.root.style.getPropertyValue("--tp-top"), "652px");
  viewport.height = 500;
  listeners.get("resize")();
  await h.settle();
  assert.equal(h.p.root.style.getPropertyValue("--tp-top"), "452px");
  viewport.offsetTop = 24;
  viewport.height = 460;
  listeners.get("scroll")();
  await h.settle();
  assert.equal(h.p.root.style.getPropertyValue("--tp-top"), "412px");
  assert.equal(h.p.root.style.getPropertyValue("--tp-left"), "0px");
  h.end();
});

test("typing-like DOM churn does not schedule toolbar layouts", async () => {
  const h = harness();
  await h.start();
  await h.settle();
  let layouts = 0;
  const layout = h.p.layout.bind(h.p);
  h.p.layout = () => {
    layouts++;
    layout();
  };
  const editor = h.w.document.createElement("div");
  h.w.document.body.append(editor);
  for (let i = 0; i < 100; i++)
    editor.append(h.w.document.createElement("span"));
  await h.settle();
  assert.equal(layouts, 0);
  h.end();
});

test("pointer capture failure and denied vibration cannot leave a stuck interaction", async () => {
  const h = harness();
  await h.start();
  h.p.setMode("floating");
  h.p.handle.setPointerCapture = () => {
    throw Error("pointer expired");
  };
  h.event("pointerdown");
  assert.equal(h.p.interaction, undefined);
  h.p.handle.setPointerCapture = function (id) {
    this.capture = id;
  };
  h.w.navigator.vibrate = () => {
    throw Error("not permitted");
  };
  h.event("pointerdown");
  h.event("pointermove", 150, 100);
  h.event("pointerup", 150, 100);
  assert.deepEqual(h.calls, ["workspace:next-tab"]);
  assert.equal(h.p.interaction, undefined);
  h.end();
});

test("resize cancels a gesture and ignores secondary pointers", async () => {
  const h = harness();
  await h.start();
  h.p.setMode("floating");
  h.event("pointerdown", 100, 100, { isPrimary: false, pointerId: 2 });
  assert.equal(h.p.interaction, undefined);
  h.event("pointerdown");
  h.event("pointermove", 150, 100);
  h.w.dispatchEvent(new h.w.Event("resize"));
  h.event("pointerup", 150, 100);
  assert.equal(h.calls.length, 0);
  h.end();
});

test("failed mounting releases listeners and never re-hides the native toolbar", async () => {
  const h = harness({ iconFails: true });
  await h.start();
  assert.equal(h.w.document.querySelector(".toolbar-plus"), null);
  h.w.dispatchEvent(new h.w.Event("resize"));
  await h.settle();
  assert.equal(h.p.ready, false);
  assert.equal(h.p.frame, 0);
  assert.equal(h.p.ui.cleanups.length, 0);
  h.end();
});

test("toolbar does not depend on ResizeObserver", async () => {
  const h = harness({
    ResizeObserver: class {
      constructor() {
        throw Error("unavailable");
      }
    },
  });
  await h.start();
  assert.equal(h.p.ready, true);
  assert.equal(h.p.root.hidden, false);
  h.end();
});

test("unload during settings load prevents late initialization", async () => {
  const h = harness();
  let resolve;
  h.p.loadData = () =>
    new Promise((r) => {
      resolve = r;
    });
  const loading = h.p.onload();
  h.p.onunload();
  resolve({});
  await loading;
  assert.equal(h.settingTab, undefined);
  assert.equal(h.w.document.querySelector(".toolbar-plus"), null);
  h.end();
});

test("future settings versions are not overwritten", async () => {
  const h = harness();
  h.p.loadData = async () => ({ version: 2, mode: "floating" });
  await h.start();
  h.p.persist();
  await h.settle();
  assert.equal(h.saves.length, 0);
  h.end();
});

test("modal tabs preserve bindings, open in current mode, and support keyboard navigation", async () => {
  const h = harness();
  await h.start();
  h.p.setMode("floating");
  h.p.configure();
  const modal = [...h.p.modals][0];
  assert.equal(
    modal.contentEl.querySelector('[aria-selected="true"]').textContent,
    "Floating",
  );
  assert.equal(modal.contentEl.querySelectorAll("input").length, 0);
  const before = JSON.stringify(h.p.config);
  modal.contentEl
    .querySelector('[aria-selected="true"]')
    .dispatchEvent(
      new h.w.KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      }),
    );
  assert.equal(
    modal.contentEl.querySelector('[aria-selected="true"]').textContent,
    "Docked",
  );
  assert.equal(h.w.document.activeElement.textContent, "Docked");
  assert.equal(JSON.stringify(h.p.config), before);
  modal.contentEl.querySelector(".tp-command-name").click();
  assert.equal(h.p.pickers.size, 1);
  h.p.onunload();
  assert.equal(h.p.pickers.size, 0);
  assert.equal(h.p.modals.size, 0);
  assert.equal(h.w.document.querySelector("section"), null);
  h.w.dispatchEvent(new h.w.Event("resize"));
  await h.settle();
  assert.equal(h.p.frame, 0);
  assert.equal(h.p.ui.cleanups.length, 0);
  h.end();
});
