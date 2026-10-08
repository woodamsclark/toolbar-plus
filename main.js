/* toolbar+ | generated from src/main.ts */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ToolbarPlus
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/insert-alias.ts
var INVALID_ALIAS_MESSAGE = "toolbar+: an alias must be a single line and cannot contain ]].";
var InsertAliasController = class {
  constructor() {
    this.pending = /* @__PURE__ */ new WeakMap();
  }
  insert(editor) {
    const alias = editor.getSelection();
    if (alias.includes("\n") || alias.includes("\r") || alias.includes("]]")) {
      return false;
    }
    const start = editor.getCursor("from");
    editor.replaceSelection(`[[|${alias}]]`);
    editor.setCursor({ line: start.line, ch: start.ch + 2 });
    this.pending.set(editor, { alias, start });
    return true;
  }
  onEditorChange(editor) {
    const pending = this.pending.get(editor);
    if (!pending) return;
    if (pending.start.line >= editor.lineCount()) {
      this.pending.delete(editor);
      return;
    }
    const { alias, start } = pending;
    const remainder = editor.getLine(start.line).slice(start.ch);
    const link = remainder.match(/^\[\[([^\n]*?)\]\]/);
    if (!link) {
      this.pending.delete(editor);
      return;
    }
    const body = link[1];
    const aliasSuffix = `|${alias}`;
    const cursor = editor.getCursor();
    if (body.endsWith(aliasSuffix)) {
      const targetLength = body.length - aliasSuffix.length;
      const targetStart = start.ch + 2;
      const targetEnd = targetStart + targetLength;
      if (cursor.line !== start.line || cursor.ch < targetStart || cursor.ch > targetEnd) {
        this.pending.delete(editor);
      }
      return;
    }
    const originalEnd = start.ch + link[0].length;
    const completedTargetEnd = start.ch + 2 + body.length;
    if (body.length === 0 || body.includes("|") || cursor.line !== start.line || cursor.ch < completedTargetEnd) {
      this.pending.delete(editor);
      return;
    }
    this.pending.delete(editor);
    const closingBrackets = { line: start.line, ch: originalEnd - 2 };
    editor.replaceRange(aliasSuffix, closingBrackets);
    editor.setCursor({
      line: start.line,
      ch: originalEnd + aliasSuffix.length
    });
  }
};

// src/model.ts
var directions = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];
var arrows = {
  nw: "\u2196",
  n: "\u2191",
  ne: "\u2197",
  w: "\u2190",
  e: "\u2192",
  sw: "\u2199",
  s: "\u2193",
  se: "\u2198"
};
var binding = (id, icon) => ({ id, icon });
function defaults() {
  const gestures = {
    nw: binding("editor:undo", "undo-2"),
    n: binding("command-palette:open", "lucide-terminal-square"),
    ne: binding("editor:redo", "redo-2"),
    w: binding("workspace:goto-last-tab", "outdent"),
    e: binding("workspace:next-tab", "lucide-arrow-right"),
    sw: binding("editor:copy", "lucide-copy"),
    s: binding("editor:toggle-keyboard", "keyboard-toggle"),
    se: binding("editor:paste", "lucide-clipboard-type")
  };
  return {
    version: 1,
    mode: "docked",
    position: { x: 0.85, y: 0.65 },
    docked: [
      binding("editor:undo", "undo-2"),
      binding("editor:redo", "redo-2"),
      binding("editor:insert-link", "link"),
      binding("editor:set-heading", "heading"),
      binding("editor:toggle-checklist-status", "list-todo"),
      binding("editor:indent-list", "indent"),
      binding("editor:unindent-list", "outdent"),
      binding("command-palette:open", "terminal")
    ],
    gestures,
    haptics: true,
    showGrid: true,
    desktop: false,
    holdMs: 450,
    threshold: 28
  };
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(n, Math.max(min, max)));
}
function directionAt(dx, dy, threshold) {
  if (Math.hypot(dx, dy) < threshold) return null;
  return ["e", "se", "s", "sw", "w", "nw", "n", "ne"][(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}
function normalize(raw) {
  var _a;
  const d = defaults();
  if (!raw || typeof raw !== "object") return d;
  const r = raw;
  const valid = (b) => !!b && typeof b === "object" && typeof b.id === "string" && typeof b.icon === "string";
  if (r.mode === "floating") d.mode = r.mode;
  if (r.position && Number.isFinite(r.position.x) && Number.isFinite(r.position.y))
    d.position = { x: clamp(r.position.x, 0, 1), y: clamp(r.position.y, 0, 1) };
  if (Array.isArray(r.docked))
    d.docked = r.docked.filter(valid).slice(0, 40).map((b) => ({ ...b }));
  for (const dir of directions)
    if (valid((_a = r.gestures) == null ? void 0 : _a[dir])) d.gestures[dir] = { ...r.gestures[dir] };
  for (const key of ["haptics", "showGrid", "desktop"])
    if (typeof r[key] === "boolean") d[key] = r[key];
  if (Number.isFinite(r.holdMs)) d.holdMs = clamp(r.holdMs, 300, 1200);
  if (Number.isFinite(r.threshold)) d.threshold = clamp(r.threshold, 16, 80);
  return d;
}

// src/settings-writer.ts
var SettingsWriter = class {
  constructor(save, failed) {
    this.writing = false;
    this.closed = false;
    this.save = save;
    this.failed = failed;
  }
  enqueue(config) {
    if (this.closed) return;
    this.pending = JSON.parse(JSON.stringify(config));
    if (!this.writing) void this.flush();
  }
  close() {
    this.closed = true;
  }
  async flush() {
    this.writing = true;
    try {
      while (this.pending) {
        const snapshot = this.pending;
        this.pending = void 0;
        try {
          await this.save(snapshot);
        } catch (e) {
          this.failed();
        }
      }
    } finally {
      this.writing = false;
    }
  }
};

// src/mobile-toolbar-host.ts
function desiredHostState({
  mobile,
  mode,
  pluginVisible,
  movingFromDocked,
  movingFromFloating,
  nativeToolbarOpen,
  nativeHostAvailable
}) {
  if (!mobile) return "restored";
  if (movingFromFloating)
    return nativeToolbarOpen && nativeHostAvailable ? "dock-target" : "floating";
  if (movingFromDocked) return "floating";
  if (mode === "floating") return "floating";
  return pluginVisible && nativeToolbarOpen && nativeHostAvailable ? "docked" : "restored";
}
var _MobileToolbarHost = class _MobileToolbarHost {
  constructor(doc, root, bar, target) {
    this.native = null;
    this.detachedElements = [];
    this.state = "restored";
    this.doc = doc;
    this.root = root;
    this.bar = bar;
    this.target = target;
  }
  get hasNativeHost() {
    return !!this.native && (this.native.isConnected || this.isDetached(this.native));
  }
  get currentState() {
    return this.state;
  }
  containsNativeHost(node) {
    if (node.nodeType !== 1) return false;
    const element = node;
    return element.matches(".mobile-toolbar, .mobile-toolbar-spacer") || !!element.querySelector(".mobile-toolbar, .mobile-toolbar-spacer");
  }
  refreshNativeHost() {
    const next = this.doc.querySelector(".mobile-toolbar");
    if (!next && this.native && this.isDetached(this.native)) return;
    if (next !== this.native) {
      if (this.native && this.isDetached(this.native)) {
        this.restoreNative(this.native);
        this.forgetDetached(this.native);
      } else {
        this.restoreNative(this.native);
      }
      this.native = next;
    }
  }
  reconcile(state) {
    this.state = state;
    this.refreshNativeHost();
    this.apply();
  }
  dispose() {
    this.state = "restored";
    this.doc.documentElement.classList.remove(
      _MobileToolbarHost.collapsedDocumentClass
    );
    this.moveBarToOverlay();
    this.moveTargetToOverlay();
    this.restoreDetachedElements();
    this.restoreNative(this.native);
    delete this.root.dataset.tpHostState;
    this.native = null;
  }
  apply() {
    this.root.dataset.tpHostState = this.state;
    this.doc.documentElement.classList.toggle(
      _MobileToolbarHost.collapsedDocumentClass,
      this.state === "floating"
    );
    if (this.state === "floating") {
      this.moveBarToOverlay();
      this.moveTargetToOverlay();
      const native2 = this.native;
      if (native2 == null ? void 0 : native2.isConnected) {
        native2.dataset.tpHostState = this.state;
        native2.classList.add("tp-native-replaced", "tp-native-collapsed");
        this.detach(native2);
      }
      this.doc.querySelectorAll(".mobile-toolbar-spacer").forEach((spacer) => this.detach(spacer));
      return;
    }
    this.restoreDetachedElements();
    const native = this.native;
    if (!(native == null ? void 0 : native.isConnected) || this.state === "restored") {
      this.moveBarToOverlay();
      this.moveTargetToOverlay();
      this.restoreNative(native);
      return;
    }
    native.dataset.tpHostState = this.state;
    native.classList.add("tp-native-replaced");
    native.classList.remove("tp-native-collapsed");
    if (this.state === "docked") {
      this.moveTargetToOverlay();
      if (this.bar.parentElement !== native) native.append(this.bar);
      this.bar.classList.add("tp-in-native");
      return;
    }
    if (this.state === "dock-target") {
      this.moveBarToOverlay();
      if (this.target.parentElement !== native) native.append(this.target);
      this.target.classList.add("tp-target-in-native");
    }
  }
  moveBarToOverlay() {
    if (this.bar.parentElement !== this.root) this.root.prepend(this.bar);
    this.bar.classList.remove("tp-in-native");
  }
  moveTargetToOverlay() {
    if (this.target.parentElement !== this.root) this.root.append(this.target);
    this.target.classList.remove("tp-target-in-native");
  }
  restoreNative(native) {
    if (!native) return;
    native.classList.remove("tp-native-replaced", "tp-native-collapsed");
    delete native.dataset.tpHostState;
  }
  isDetached(element) {
    return this.detachedElements.some((entry) => entry.element === element);
  }
  forgetDetached(element) {
    this.detachedElements = this.detachedElements.filter(
      (entry) => entry.element !== element
    );
  }
  detach(element) {
    if (this.isDetached(element)) return;
    const parent = element.parentNode;
    if (!parent) return;
    this.detachedElements.push({
      element,
      parent,
      nextSibling: element.nextSibling
    });
    element.remove();
  }
  restoreDetachedElements() {
    const nativeToolbarOpen = this.doc.body.classList.contains("mod-toolbar-open");
    for (const { element, parent, nextSibling } of this.detachedElements.slice().reverse()) {
      if (nativeToolbarOpen && !element.isConnected && parent.isConnected) {
        parent.insertBefore(
          element,
          (nextSibling == null ? void 0 : nextSibling.parentNode) === parent ? nextSibling : null
        );
      }
    }
    this.detachedElements = [];
  }
};
_MobileToolbarHost.collapsedDocumentClass = "tp-mobile-toolbar-collapsed";
var MobileToolbarHost = _MobileToolbarHost;

// src/viewport-layout.ts
function clamp2(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
var FLOATING_HANDLE_SIZE = 48;
var HORIZONTAL_PLACEMENT_MARGIN = 8;
var VERTICAL_PLACEMENT_MARGIN = 8;
var BOTTOM_HANDLE_CLEARANCE = 8;
function viewportBounds(viewport, innerWidth, innerHeight) {
  var _a, _b;
  return {
    // Fixed controls use coordinates local to the visual viewport. Its page
    // offset must not be added again when iOS pans around the keyboard.
    left: 0,
    top: 0,
    width: (_a = viewport == null ? void 0 : viewport.width) != null ? _a : innerWidth,
    height: (_b = viewport == null ? void 0 : viewport.height) != null ? _b : innerHeight
  };
}
function placementSize(bounds, innerWidth, innerHeight, documentWidth, documentHeight) {
  return {
    width: Math.max(bounds.width, innerWidth || 0, documentWidth || 0),
    height: Math.max(bounds.height, innerHeight || 0, documentHeight || 0)
  };
}
function pointFromNormalized(position, placement) {
  return {
    x: HORIZONTAL_PLACEMENT_MARGIN + position.x * Math.max(0, placement.width - 64),
    y: VERTICAL_PLACEMENT_MARGIN + position.y * Math.max(0, placement.height - 80)
  };
}
function normalizedFromPoint(point, placement) {
  return {
    x: clamp2(
      (point.x - HORIZONTAL_PLACEMENT_MARGIN) / Math.max(1, placement.width - 64),
      0,
      1
    ),
    y: clamp2(
      (point.y - VERTICAL_PLACEMENT_MARGIN) / Math.max(1, placement.height - 80),
      0,
      1
    )
  };
}
function clampHandlePoint(point, bounds, insets) {
  return {
    x: clamp2(
      point.x,
      bounds.left + Math.max(8, insets.left),
      bounds.left + bounds.width - FLOATING_HANDLE_SIZE - Math.max(8, insets.right)
    ),
    y: clamp2(
      point.y,
      bounds.top + Math.max(8, insets.top),
      bounds.top + bounds.height - FLOATING_HANDLE_SIZE - BOTTOM_HANDLE_CLEARANCE - Math.max(8, insets.bottom)
    )
  };
}
function toolbarPositions(bounds, requestedHeight) {
  const height = clamp2(
    Number.isFinite(requestedHeight) && requestedHeight > 0 ? requestedHeight : 48,
    1,
    bounds.height
  );
  const top = bounds.height - height;
  return {
    height,
    top,
    targetTop: clamp2(top - 4, 0, Math.max(0, bounds.height - 60))
  };
}

// src/main.ts
function registry(app) {
  return app.commands;
}
var editorActions = {
  "editor:undo": {
    name: "Undo",
    icon: "undo-2",
    run: (view) => view.editor.undo()
  },
  "editor:redo": {
    name: "Redo",
    icon: "redo-2",
    run: (view) => view.editor.redo()
  }
};
function availableCommands(app) {
  const commands = registry(app);
  let listed = [];
  try {
    const found = typeof (commands == null ? void 0 : commands.listCommands) === "function" ? commands.listCommands() : void 0;
    listed = Array.isArray(found) ? found : (commands == null ? void 0 : commands.commands) ? Object.values(commands.commands) : [];
  } catch (error) {
    console.error("toolbar+: could not read Obsidian commands", error);
    listed = (commands == null ? void 0 : commands.commands) ? Object.values(commands.commands) : [];
  }
  const ids = new Set(listed.map((command) => command.id));
  return [
    ...listed,
    ...Object.entries(editorActions).filter(([id]) => !ids.has(id)).map(([id, action]) => ({ id, name: action.name, icon: action.icon }))
  ];
}
function runCommand(app, id) {
  var _a, _b;
  try {
    if (((_b = (_a = registry(app)) == null ? void 0 : _a.executeCommandById) == null ? void 0 : _b.call(_a, id)) === true) return true;
    const action = editorActions[id];
    const view = action && app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    if (!action || !view) return false;
    action.run(view);
    return true;
  } catch (error) {
    console.error(`toolbar+: command failed: ${id}`, error);
    return false;
  }
}
function availableIcons() {
  try {
    return typeof import_obsidian.getIconIds === "function" ? [...(0, import_obsidian.getIconIds)()] : [];
  } catch (error) {
    console.error("toolbar+: could not read Obsidian icons", error);
    return [];
  }
}
var Picker = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, items, label, choose, placeholder, closed) {
    super(app);
    this.items = items;
    this.label = label;
    this.choose = choose;
    this.closed = closed;
    this.setPlaceholder(placeholder);
  }
  getItems() {
    return this.items;
  }
  getItemText(item) {
    return this.label(item);
  }
  onChooseItem(item) {
    this.choose(item);
  }
  onClose() {
    var _a;
    super.onClose();
    (_a = this.closed) == null ? void 0 : _a.call(this);
  }
};
var ToolbarPlus = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.config = defaults();
    this.frame = 0;
    this.disposed = false;
    this.ready = false;
    this.ui = new import_obsidian.Component();
    this.insertAlias = new InsertAliasController();
    this.modals = /* @__PURE__ */ new Set();
    this.pickers = /* @__PURE__ */ new Set();
    this.suspended = 0;
    this.settingsReadable = true;
    this.writer = new SettingsWriter(
      (snapshot) => this.saveData(snapshot),
      () => new import_obsidian.Notice(
        "toolbar+: settings could not be saved. Your changes remain in this session."
      )
    );
  }
  async onload() {
    this.addChild(this.ui);
    try {
      const saved = await this.loadData();
      if (saved && typeof saved === "object" && "version" in saved && saved.version !== 1) {
        throw new Error(
          "Unsupported settings version; use the matching toolbar+ version."
        );
      }
      this.config = normalize(saved);
    } catch (error) {
      console.error(
        "toolbar+: could not read saved settings; using defaults",
        error
      );
      this.config = defaults();
      this.settingsReadable = false;
      new import_obsidian.Notice(
        "toolbar+: saved settings could not be read. Using temporary defaults; reload after sync finishes before editing settings.",
        1e4
      );
    }
    if (this.disposed) return;
    this.addSettingTab(new ToolbarSettings(this.app, this));
    this.addCommand({
      id: "configure",
      name: "Configure toolbar and gestures",
      callback: () => this.configure()
    });
    this.addCommand({
      id: "insert-alias",
      name: "Insert alias",
      editorCallback: (editor) => {
        if (!this.insertAlias.insert(editor)) {
          new import_obsidian.Notice(INVALID_ALIAS_MESSAGE);
        }
      }
    });
    this.addCommand({
      id: "dock",
      name: "Dock toolbar",
      callback: () => this.setMode("docked")
    });
    this.addCommand({
      id: "float",
      name: "Float gesture control",
      callback: () => this.setMode("floating")
    });
    this.registerEvent(
      this.app.workspace.on(
        "editor-change",
        (editor) => this.insertAlias.onEditorChange(editor)
      )
    );
    this.app.workspace.onLayoutReady(() => {
      if (this.disposed) return;
      try {
        this.mount();
      } catch (error) {
        console.error("toolbar+: mobile toolbar initialization failed", error);
        this.cleanupUi();
        new import_obsidian.Notice(
          `toolbar+ could not create its toolbar: ${error instanceof Error ? error.message : String(error)}`,
          1e4
        );
      }
    });
  }
  persist() {
    if (this.disposed) return;
    if (!this.settingsReadable) {
      new import_obsidian.Notice(
        "toolbar+: changes are temporary because saved settings could not be read. Reload after sync finishes to restore saving."
      );
      return;
    }
    this.writer.enqueue(this.config);
  }
  mount() {
    var _a;
    if ((_a = this.root) == null ? void 0 : _a.isConnected) return;
    this.root = document.body.createDiv({ cls: "toolbar-plus" });
    this.bar = this.root.createDiv({
      cls: "tp-bar",
      attr: { role: "toolbar", "aria-label": "toolbar+" }
    });
    this.commandsEl = this.bar.createDiv({ cls: "tp-commands" });
    this.handleSlot = this.bar.createDiv({ cls: "tp-handle-slot" });
    this.handle = this.handleSlot.createEl("button", {
      cls: "tp-handle",
      attr: {
        "aria-label": "Configure toolbar+. Swipe down when docked to hide the keyboard; hold to move.",
        title: "toolbar+ \xB7 tap to configure \xB7 swipe down to hide keyboard \xB7 hold to move"
      }
    });
    for (let i = 0; i < 9; i++) this.handle.createSpan();
    this.grid = this.root.createDiv({
      cls: "tp-grid",
      attr: { "aria-hidden": "true" }
    });
    this.target = this.root.createDiv({
      cls: "tp-dock-target",
      text: "Release here"
    });
    this.status = this.root.createDiv({
      cls: "tp-sr",
      attr: { role: "status", "aria-live": "polite" }
    });
    this.host = new MobileToolbarHost(
      document,
      this.root,
      this.bar,
      this.target
    );
    this.ui.registerDomEvent(this.handle, "pointerdown", (e) => this.down(e));
    this.ui.registerDomEvent(document, "pointermove", (e) => this.move(e));
    this.ui.registerDomEvent(document, "pointerup", (e) => this.up(e));
    this.ui.registerDomEvent(document, "pointercancel", (e) => {
      var _a2;
      if (((_a2 = this.interaction) == null ? void 0 : _a2.id) === e.pointerId) this.cancel();
    });
    this.ui.registerDomEvent(
      this.handle,
      "contextmenu",
      (e) => e.preventDefault()
    );
    this.ui.registerDomEvent(this.handle, "click", (e) => {
      if (e.detail === 0) this.configure();
    });
    this.ui.registerDomEvent(document, "keydown", (e) => {
      if (e.key === "Escape") this.cancel();
    });
    this.ui.registerDomEvent(window, "blur", () => this.cancel());
    this.ui.registerDomEvent(document, "visibilitychange", () => {
      if (document.hidden) this.cancel();
    });
    this.ui.registerDomEvent(window, "resize", () => {
      this.cancel();
      this.scheduleLayout();
    });
    this.ui.registerDomEvent(
      document,
      "focusin",
      () => this.scheduleKeyboardLayout()
    );
    this.ui.registerDomEvent(
      document,
      "focusout",
      () => this.scheduleKeyboardLayout()
    );
    if (window.visualViewport) {
      const viewport = window.visualViewport;
      const update = () => {
        this.cancel();
        this.scheduleKeyboardLayout();
      };
      viewport.addEventListener("resize", update);
      viewport.addEventListener("scroll", update);
      this.ui.register(() => {
        viewport.removeEventListener("resize", update);
        viewport.removeEventListener("scroll", update);
      });
    }
    this.ui.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.cancel();
        this.scheduleLayout();
      })
    );
    this.ui.registerEvent(
      this.app.workspace.on("layout-change", () => this.scheduleLayout())
    );
    if (typeof MutationObserver !== "undefined") {
      const keyboardObserver = new MutationObserver(() => {
        this.scheduleKeyboardLayout();
      });
      keyboardObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"]
      });
      this.ui.register(() => keyboardObserver.disconnect());
      const observer = new MutationObserver((records) => {
        const toolbarChanged = records.some(
          (record) => record.type === "childList" && [
            ...Array.from(record.addedNodes),
            ...Array.from(record.removedNodes)
          ].some((node) => {
            var _a2;
            return (_a2 = this.host) == null ? void 0 : _a2.containsNativeHost(node);
          })
        );
        if (toolbarChanged) this.scheduleLayout();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      this.ui.register(() => observer.disconnect());
    }
    this.ready = true;
    this.refresh();
  }
  bounds() {
    return viewportBounds(
      window.visualViewport,
      window.innerWidth,
      window.innerHeight
    );
  }
  placementSize(bounds = this.bounds()) {
    const documentElement = document.documentElement;
    return placementSize(
      bounds,
      window.innerWidth,
      window.innerHeight,
      (documentElement == null ? void 0 : documentElement.clientWidth) || 0,
      (documentElement == null ? void 0 : documentElement.clientHeight) || 0
    );
  }
  scheduleLayout() {
    if (this.disposed || !this.ready) return;
    if (!this.frame)
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.layout();
      });
  }
  scheduleKeyboardLayout() {
    this.scheduleLayout();
  }
  layout() {
    var _a, _b, _c, _d, _e, _f, _g;
    if (this.disposed || !this.ready) return;
    const b = this.bounds();
    const active = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    (_a = this.host) == null ? void 0 : _a.refreshNativeHost();
    const nativeAvailable = (_c = (_b = this.host) == null ? void 0 : _b.hasNativeHost) != null ? _c : false;
    const nativeToolbarOpen = document.body.classList.contains("mod-toolbar-open");
    const dockedVisible = import_obsidian.Platform.isMobile ? nativeAvailable && nativeToolbarOpen : this.config.desktop && !!active;
    const visible = !this.suspended && (import_obsidian.Platform.isMobile || this.config.desktop) && (this.config.mode === "floating" || this.config.mode === "docked" && dockedVisible);
    if (!visible && this.interaction) this.finish();
    this.root.hidden = !visible;
    this.bar.hidden = !visible;
    const moving = ((_d = this.interaction) == null ? void 0 : _d.kind) === "moving";
    (_g = this.host) == null ? void 0 : _g.reconcile(
      desiredHostState({
        mobile: import_obsidian.Platform.isMobile,
        mode: this.config.mode,
        pluginVisible: visible,
        movingFromDocked: moving && ((_e = this.interaction) == null ? void 0 : _e.previousMode) === "docked",
        movingFromFloating: moving && ((_f = this.interaction) == null ? void 0 : _f.previousMode) === "floating",
        nativeToolbarOpen,
        nativeHostAvailable: nativeAvailable
      })
    );
    const configuredHeight = parseFloat(
      getComputedStyle(this.bar).getPropertyValue("--tp-height")
    );
    const { top, targetTop } = toolbarPositions(b, configuredHeight);
    this.root.style.setProperty("--tp-left", "0px");
    this.root.style.setProperty("--tp-width", `${b.width}px`);
    this.root.style.setProperty("--tp-top", `${top}px`);
    this.root.style.setProperty("--tp-target-top", `${targetTop}px`);
    if (!this.interaction || this.interaction.kind !== "moving") {
      const placement = this.placementSize(b);
      const point = pointFromNormalized(this.config.position, placement);
      this.placeHandle(point.x, point.y);
    }
  }
  placeHandle(x, y) {
    const b = this.bounds(), style = getComputedStyle(this.root);
    const inset = (side) => parseFloat(style.getPropertyValue(`padding-${side}`)) || 0;
    const point = clampHandlePoint({ x, y }, b, {
      left: inset("left"),
      right: inset("right"),
      top: inset("top"),
      bottom: inset("bottom")
    });
    this.handle.style.left = `${point.x}px`;
    this.handle.style.top = `${point.y}px`;
  }
  refresh() {
    if (this.disposed || !this.ready) return;
    this.cancel();
    this.commandsEl.empty();
    for (const binding2 of this.config.docked) {
      const button = this.commandsEl.createEl("button", {
        cls: "tp-command",
        attr: { "aria-label": this.label(binding2), title: this.label(binding2) }
      });
      (0, import_obsidian.setIcon)(button, binding2.icon || "command");
      button.addEventListener("pointerdown", (e) => e.preventDefault());
      button.addEventListener("mousedown", (e) => e.preventDefault());
      button.addEventListener("click", () => this.execute(binding2));
    }
    this.grid.empty();
    for (const dir of ["nw", "n", "ne", "w", "center", "e", "sw", "s", "se"]) {
      const cell = this.grid.createDiv({
        cls: "tp-cell",
        attr: { "data-dir": dir }
      });
      if (dir === "center") {
        cell.addClass("tp-center");
        continue;
      }
      const binding2 = this.config.gestures[dir];
      (0, import_obsidian.setIcon)(
        cell.createDiv({ cls: "tp-cell-icon" }),
        binding2.icon || "command"
      );
      cell.createSpan({ text: this.label(binding2) });
    }
    this.root.toggleClass("tp-floating", this.config.mode === "floating");
    this.layout();
  }
  label(binding2) {
    var _a, _b, _c, _d, _e;
    const commands = registry(this.app);
    if (binding2.id && commands) {
      try {
        const command = (_c = (_a = commands.findCommand) == null ? void 0 : _a.call(commands, binding2.id)) != null ? _c : (_b = commands.commands) == null ? void 0 : _b[binding2.id];
        if (command == null ? void 0 : command.name) return command.name;
      } catch (e) {
      }
    }
    const editorAction = editorActions[binding2.id];
    if (editorAction) return editorAction.name;
    return binding2.id ? (_e = (_d = availableCommands(this.app).find((c) => c.id === binding2.id)) == null ? void 0 : _d.name) != null ? _e : `Unavailable: ${binding2.id}` : "Unassigned";
  }
  execute(binding2) {
    if (!binding2.id) {
      new import_obsidian.Notice("toolbar+: this direction is unassigned.");
      return;
    }
    try {
      if (!runCommand(this.app, binding2.id))
        new import_obsidian.Notice(
          `toolbar+: ${this.label(binding2)} is not available in this context.`
        );
      else this.tick(12);
    } catch (e) {
      new import_obsidian.Notice(`toolbar+: could not run ${this.label(binding2)}.`);
    }
  }
  tick(ms = 7) {
    try {
      if (this.config.haptics && typeof navigator.vibrate === "function")
        navigator.vibrate(ms);
    } catch (e) {
    }
  }
  down(e) {
    if (this.disposed || !this.ready || this.root.hidden || e.button !== 0 || !e.isPrimary || this.interaction)
      return;
    e.preventDefault();
    const rect = this.handle.getBoundingClientRect();
    const i = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      kind: "pending",
      direction: null,
      timer: 0,
      previousMode: this.config.mode,
      previousPosition: { ...this.config.position }
    };
    this.interaction = i;
    try {
      this.handle.setPointerCapture(e.pointerId);
    } catch (e2) {
      this.interaction = void 0;
      return;
    }
    this.root.addClass("tp-pressed");
    i.timer = window.setTimeout(() => {
      if (this.interaction !== i || i.kind !== "pending") return;
      i.kind = "moving";
      this.root.addClass("tp-moving");
      if (i.previousMode === "floating") {
        this.root.addClass("tp-can-dock");
        this.target.setText("Dock toolbar");
      }
      this.layout();
      this.placeHandle(rect.left, rect.top);
      try {
        this.handle.setPointerCapture(i.id);
      } catch (e2) {
      }
      this.tick(18);
      if (i.previousMode === "floating") {
        this.status.setText(
          "Moving. Release over the bottom target to dock the toolbar."
        );
      } else {
        this.status.setText("Moving. Release to place the floating control.");
      }
    }, this.config.holdMs);
  }
  move(e) {
    const i = this.interaction;
    if (!i || i.id !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - i.x, dy = e.clientY - i.y;
    if (i.kind === "pending" && Math.hypot(dx, dy) > 10) {
      clearTimeout(i.timer);
      i.kind = this.config.mode === "floating" ? "gesture" : "keyboard";
    }
    if (i.kind === "moving") {
      this.placeHandle(e.clientX - i.offsetX, e.clientY - i.offsetY);
      this.target.toggleClass(
        "tp-over",
        i.previousMode === "floating" && this.overTarget(e.clientX, e.clientY)
      );
      return;
    }
    if (i.kind === "keyboard") {
      const dir2 = directionAt(dx, dy, this.config.threshold);
      if (dir2 !== i.direction) {
        i.direction = dir2;
        if (dir2 === "s") this.tick();
        this.status.setText(
          dir2 === "s" ? "Release to hide keyboard" : "Swipe down to hide keyboard"
        );
      }
      return;
    }
    if (i.kind !== "gesture") return;
    const dir = directionAt(dx, dy, this.config.threshold);
    this.root.toggleClass("tp-gesturing", this.config.showGrid);
    const b = this.bounds(), size = Math.max(1, Math.min(252, b.width - 16, b.height - 16));
    this.grid.style.width = `${size}px`;
    this.grid.style.height = `${size}px`;
    this.grid.style.left = `${clamp(i.x - size / 2, b.left + 8, b.left + b.width - size - 8)}px`;
    this.grid.style.top = `${clamp(i.y - size / 2, b.top + 8, b.top + b.height - size - 8)}px`;
    if (dir !== i.direction) {
      i.direction = dir;
      if (dir) this.tick();
      this.grid.querySelectorAll(".tp-cell").forEach(
        (cell) => cell.classList.toggle(
          "tp-selected",
          cell.getAttribute("data-dir") === dir
        )
      );
      this.status.setText(
        dir ? this.label(this.config.gestures[dir]) : "Release to cancel"
      );
    }
  }
  overTarget(x, y) {
    const r = this.target.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top - 16 && y <= r.bottom + 16;
  }
  up(e) {
    const i = this.interaction;
    if (!i || i.id !== e.pointerId) return;
    e.preventDefault();
    const kind = i.kind, dir = i.kind === "gesture" || i.kind === "keyboard" ? directionAt(e.clientX - i.x, e.clientY - i.y, this.config.threshold) : null, overTarget = kind === "moving" && i.previousMode === "floating" && this.overTarget(e.clientX, e.clientY), hideKeyboard = kind === "keyboard" && dir === "s";
    if (kind === "moving") {
      this.placeHandle(e.clientX - i.offsetX, e.clientY - i.offsetY);
      this.config.mode = overTarget ? "docked" : "floating";
      const r = this.handle.getBoundingClientRect(), placement = this.placementSize();
      this.config.position = normalizedFromPoint(
        { x: r.left, y: r.top },
        placement
      );
      this.persist();
    }
    this.finish();
    this.root.toggleClass("tp-floating", this.config.mode === "floating");
    if (hideKeyboard) this.hideKeyboard();
    this.layout();
    if (kind === "pending") this.configure();
    else if (kind === "gesture" && dir) this.execute(this.config.gestures[dir]);
  }
  hideKeyboard() {
    try {
      if (runCommand(this.app, "editor:toggle-keyboard")) {
        this.scheduleKeyboardLayout();
        return;
      }
      const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
      if (!view) return;
      view.editor.blur();
      this.scheduleKeyboardLayout();
    } catch (error) {
      console.error("toolbar+: could not hide the keyboard", error);
    }
  }
  finish() {
    const i = this.interaction;
    if (!i) return;
    clearTimeout(i.timer);
    this.interaction = void 0;
    try {
      if (this.handle.hasPointerCapture(i.id))
        this.handle.releasePointerCapture(i.id);
    } catch (e) {
    }
    this.root.removeClass(
      "tp-moving",
      "tp-can-dock",
      "tp-gesturing",
      "tp-pressed"
    );
    this.target.removeClass("tp-over");
    this.grid.querySelectorAll(".tp-selected").forEach((c) => c.classList.remove("tp-selected"));
  }
  cancel() {
    const i = this.interaction;
    if (!i) return;
    this.config.mode = i.previousMode;
    this.config.position = i.previousPosition;
    this.finish();
    this.layout();
  }
  setMode(mode) {
    this.cancel();
    this.config.mode = mode;
    this.persist();
    this.refresh();
  }
  configure() {
    if (this.disposed || this.modals.size) return;
    const modal = new ConfigModal(this.app, this);
    this.modals.add(modal);
    this.suspended++;
    this.cancel();
    this.layout();
    modal.open();
  }
  pick(items, label, choose, placeholder) {
    if (this.disposed) return;
    const picker = new Picker(
      this.app,
      items,
      label,
      (item) => {
        if (!this.disposed) choose(item);
      },
      placeholder,
      () => {
        this.pickers.delete(picker);
      }
    );
    this.pickers.add(picker);
    picker.open();
  }
  closed(modal) {
    this.modals.delete(modal);
    this.suspended = Math.max(0, this.suspended - 1);
    this.refresh();
  }
  cleanupUi() {
    var _a, _b;
    this.ready = false;
    this.finish();
    this.ui.unload();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    (_a = this.host) == null ? void 0 : _a.dispose();
    this.host = void 0;
    (_b = this.root) == null ? void 0 : _b.remove();
  }
  onunload() {
    this.disposed = true;
    this.writer.close();
    for (const picker of [...this.pickers]) picker.close();
    for (const modal of [...this.modals]) modal.close();
    this.cleanupUi();
  }
};
var ConfigModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.tab = plugin.config.mode;
  }
  onOpen() {
    this.modalEl.addClass("tp-config-modal");
    this.setTitle("toolbar+ commands");
    this.render();
  }
  render() {
    renderCommandModal(this.contentEl, this.plugin, this.tab, (tab) => {
      this.tab = tab;
      this.render();
    });
  }
  onClose() {
    this.contentEl.empty();
    this.plugin.closed(this);
  }
};
var ToolbarSettings = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    renderPluginSettings(this.containerEl, this.plugin);
  }
};
function chooseCommand(p, binding2, done) {
  p.pick(
    availableCommands(p.app),
    (command) => command.name,
    (command) => {
      var _a, _b;
      binding2.id = command.id;
      binding2.icon = (_b = (_a = command.icon) != null ? _a : binding2.icon) != null ? _b : "command";
      done();
    },
    "Find an Obsidian command\u2026"
  );
}
function chooseIcon(p, binding2, done) {
  p.pick(
    availableIcons(),
    (icon) => icon,
    (icon) => {
      binding2.icon = icon;
      done();
    },
    "Find an icon\u2026"
  );
}
function commandIconButton(parent, icon, label, action, disabled = false) {
  const button = parent.createEl("button", {
    cls: "tp-icon-button",
    attr: { "aria-label": label, title: label }
  });
  (0, import_obsidian.setIcon)(button, icon);
  button.disabled = disabled;
  button.onclick = action;
  return button;
}
function renderCommandModal(el, p, tab, selectTab) {
  el.empty();
  el.addClass("tp-command-editor");
  const changed = () => {
    p.persist();
    p.refresh();
    renderCommandModal(el, p, tab, selectTab);
  };
  const tabs = el.createDiv({ cls: "tp-tabs", attr: { role: "tablist" } });
  const activate = (value) => {
    var _a;
    selectTab(value);
    (_a = el.querySelector(
      `[role="tab"][aria-selected="true"]`
    )) == null ? void 0 : _a.focus();
  };
  for (const [value, label] of [
    ["docked", "Docked"],
    ["floating", "Floating"]
  ]) {
    const button = tabs.createEl("button", {
      cls: "tp-tab",
      text: label,
      attr: {
        role: "tab",
        id: `tp-tab-${value}`,
        "aria-controls": "tp-command-panel",
        "aria-selected": String(tab === value),
        tabindex: tab === value ? "0" : "-1"
      }
    });
    button.onclick = () => activate(value);
    button.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      activate(
        event.key === "Home" ? "docked" : event.key === "End" ? "floating" : value === "docked" ? "floating" : "docked"
      );
    };
  }
  const panel = el.createDiv({
    cls: "tp-command-panel",
    attr: {
      role: "tabpanel",
      id: "tp-command-panel",
      "aria-labelledby": `tp-tab-${tab}`
    }
  });
  if (tab === "floating") {
    panel.createEl("p", {
      cls: "tp-panel-hint",
      text: "Tap a direction to change its swipe command."
    });
    const grid = panel.createDiv({ cls: "tp-binding-grid" });
    for (const dir of ["nw", "n", "ne", "w", "center", "e", "sw", "s", "se"]) {
      if (dir === "center") {
        grid.createDiv({ cls: "tp-binding-center", text: "\u283F" });
        continue;
      }
      const direction = dir;
      const binding2 = p.config.gestures[direction];
      const cell = grid.createDiv({ cls: "tp-binding-cell" });
      const button = cell.createEl("button", {
        text: `${arrows[direction]} ${p.label(binding2)}`,
        attr: {
          "aria-label": `Bind ${direction}: ${p.label(binding2)}`
        }
      });
      button.onclick = () => chooseCommand(p, binding2, changed);
      const clear = cell.createEl("button", {
        cls: "tp-clear",
        text: "\xD7",
        attr: {
          "aria-label": `Clear ${direction} binding`,
          title: "Clear binding"
        }
      });
      clear.onclick = () => {
        p.config.gestures[direction] = { id: "", icon: "minus" };
        changed();
      };
    }
    return;
  }
  panel.createEl("p", {
    cls: "tp-panel-hint",
    text: "Commands appear from left to right in the docked capsule."
  });
  const list = panel.createDiv({ cls: "tp-docked-list" });
  if (p.config.docked.length === 0)
    list.createEl("p", {
      cls: "tp-panel-hint",
      text: "No docked commands yet."
    });
  p.config.docked.forEach((binding2, index) => {
    const row = list.createDiv({ cls: "tp-docked-binding" });
    commandIconButton(
      row,
      binding2.icon || "command",
      `Change icon for ${p.label(binding2)}`,
      () => chooseIcon(p, binding2, changed)
    );
    const command = row.createEl("button", {
      cls: "tp-command-name",
      text: p.label(binding2),
      attr: { title: `${p.label(binding2)} \u2014 Change command` }
    });
    command.onclick = () => chooseCommand(p, binding2, changed);
    commandIconButton(
      row,
      "arrow-up",
      "Move earlier",
      () => {
        [p.config.docked[index - 1], p.config.docked[index]] = [
          binding2,
          p.config.docked[index - 1]
        ];
        changed();
      },
      index === 0
    );
    commandIconButton(
      row,
      "arrow-down",
      "Move later",
      () => {
        [p.config.docked[index + 1], p.config.docked[index]] = [
          binding2,
          p.config.docked[index + 1]
        ];
        changed();
      },
      index === p.config.docked.length - 1
    );
    commandIconButton(row, "trash-2", "Remove command", () => {
      p.config.docked.splice(index, 1);
      changed();
    });
  });
  const add = panel.createEl("button", {
    cls: "tp-add-command",
    text: "+ Add command"
  });
  add.disabled = p.config.docked.length >= 40;
  add.onclick = () => {
    const binding2 = { id: "", icon: "command" };
    chooseCommand(p, binding2, () => {
      p.config.docked.push(binding2);
      changed();
    });
  };
}
function renderPluginSettings(el, p) {
  el.empty();
  el.addClass("tp-settings", "tp-plugin-settings");
  el.createEl("p", {
    cls: "tp-intro",
    text: "Edit commands from the tactile control. Adjust general behavior here."
  });
  new import_obsidian.Setting(el).setName("Command layouts").addButton(
    (button) => button.setButtonText("Edit commands").onClick(() => p.configure())
  );
  new import_obsidian.Setting(el).setName("Control position").setDesc("Switch between the docked toolbar and floating gesture control.").addButton(
    (b) => b.setButtonText(
      p.config.mode === "docked" ? "Float control" : "Dock control"
    ).onClick(() => {
      p.setMode(p.config.mode === "docked" ? "floating" : "docked");
      renderPluginSettings(el, p);
    })
  );
  el.createEl("h3", { text: "Behavior" });
  new import_obsidian.Setting(el).setName("Gesture grid").setDesc("Show command directions while swiping.").addToggle(
    (t) => t.setValue(p.config.showGrid).onChange((v) => {
      p.config.showGrid = v;
      p.persist();
    })
  );
  new import_obsidian.Setting(el).setName("Haptic feedback").setDesc("Vibrate on a selection or long press.").addToggle(
    (t) => t.setValue(p.config.haptics).onChange((v) => {
      p.config.haptics = v;
      p.persist();
    })
  );
  new import_obsidian.Setting(el).setName("Show on desktop").setDesc("Use toolbar+ with a mouse or trackpad.").addToggle(
    (t) => t.setValue(p.config.desktop).onChange((v) => {
      p.config.desktop = v;
      p.persist();
      p.refresh();
    })
  );
  const holdSetting = new import_obsidian.Setting(el).setName("Hold to move").setDesc("Long-press delay, in milliseconds.").addSlider(
    (s) => s.setLimits(300, 1200, 50).setValue(p.config.holdMs).setDynamicTooltip().onChange((v) => {
      p.config.holdMs = v;
      p.persist();
    })
  );
  holdSetting.settingEl.addClass("tp-slider-setting");
  const distanceSetting = new import_obsidian.Setting(el).setName("Gesture distance").setDesc("Swipe distance needed to select a command.").addSlider(
    (s) => s.setLimits(16, 80, 2).setValue(p.config.threshold).setDynamicTooltip().onChange((v) => {
      p.config.threshold = v;
      p.persist();
    })
  );
  distanceSetting.settingEl.addClass("tp-slider-setting");
}
