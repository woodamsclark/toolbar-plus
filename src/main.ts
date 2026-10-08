import {
  App,
  Command,
  Component,
  FuzzySuggestModal,
  getIconIds,
  MarkdownView,
  Modal,
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  Setting,
  setIcon,
} from "obsidian";
import type { Editor, SettingDefinitionItem } from "obsidian";
import { InsertAliasController, INVALID_ALIAS_MESSAGE } from "./insert-alias";
import {
  arrows,
  Binding,
  clamp,
  Config,
  defaults,
  Direction,
  directionAt,
  normalize,
} from "./model";
import { SettingsWriter } from "./settings-writer";
import { desiredHostState, MobileToolbarHost } from "./mobile-toolbar-host";
import {
  clampHandlePoint,
  normalizedFromPoint,
  placementSize as resolvePlacementSize,
  pointFromNormalized,
  toolbarPositions,
  viewportBounds,
} from "./viewport-layout";
interface CommandRegistry {
  findCommand?: (id: string) => Command | undefined;
  listCommands?: () => Command[];
  executeCommandById?: (id: string) => boolean;
  commands?: Record<string, Command>;
}
// Obsidian exposes the command registry at runtime, but does not publish it in App's typings.
function registry(app: App): CommandRegistry | undefined {
  return (app as App & { commands?: CommandRegistry }).commands;
}
const editorActions: Record<
  string,
  { name: string; icon: string; run: (view: MarkdownView) => void }
> = {
  "editor:undo": {
    name: "Undo",
    icon: "undo-2",
    run: (view) => view.editor.undo(),
  },
  "editor:redo": {
    name: "Redo",
    icon: "redo-2",
    run: (view) => view.editor.redo(),
  },
};
function availableCommands(app: App): Command[] {
  const commands = registry(app);
  let listed: Command[] = [];
  try {
    const found =
      typeof commands?.listCommands === "function"
        ? commands.listCommands()
        : undefined;
    listed = Array.isArray(found)
      ? found
      : commands?.commands
        ? Object.values(commands.commands)
        : [];
  } catch (error) {
    console.error("toolbar+: could not read Obsidian commands", error);
    listed = commands?.commands ? Object.values(commands.commands) : [];
  }
  const ids = new Set(listed.map((command) => command.id));
  return [
    ...listed,
    ...Object.entries(editorActions)
      .filter(([id]) => !ids.has(id))
      .map(([id, action]) => ({ id, name: action.name, icon: action.icon })),
  ];
}
function runCommand(app: App, id: string): boolean {
  try {
    if (registry(app)?.executeCommandById?.(id) === true) return true;
    const action = editorActions[id];
    const view = action && app.workspace.getActiveViewOfType(MarkdownView);
    if (!action || !view) return false;
    action.run(view);
    return true;
  } catch (error) {
    console.error(`toolbar+: command failed: ${id}`, error);
    return false;
  }
}
function availableIcons(): string[] {
  try {
    return typeof getIconIds === "function" ? [...getIconIds()] : [];
  } catch (error) {
    console.error("toolbar+: could not read Obsidian icons", error);
    return [];
  }
}
class Picker<T> extends FuzzySuggestModal<T> {
  constructor(
    app: App,
    private items: T[],
    private label: (item: T) => string,
    private choose: (item: T) => void,
    placeholder: string,
    private closed?: () => void,
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }
  getItems() {
    return this.items;
  }
  getItemText(item: T) {
    return this.label(item);
  }
  onChooseItem(item: T) {
    this.choose(item);
  }
  onClose() {
    super.onClose();
    this.closed?.();
  }
}
interface Interaction {
  id: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  kind: "pending" | "gesture" | "keyboard" | "moving" | "cancelled";
  direction: Direction | null;
  timer: number;
  previousMode: Config["mode"];
  previousPosition: { x: number; y: number };
}
export default class ToolbarPlus extends Plugin {
  config: Config = defaults();
  private root!: HTMLElement;
  private bar!: HTMLElement;
  private commandsEl!: HTMLElement;
  private handleSlot!: HTMLElement;
  private handle!: HTMLButtonElement;
  private grid!: HTMLElement;
  private target!: HTMLElement;
  private status!: HTMLElement;
  private interaction?: Interaction;
  private host?: MobileToolbarHost;
  private keyboardEntrance?: { top: number; travel: number };
  private frame = 0;
  private disposed = false;
  private ready = false;
  private readonly ui = new Component();
  private readonly insertAlias = new InsertAliasController();
  private modals = new Set<Modal>();
  private pickers = new Set<Modal>();
  private suspended = 0;
  private settingsReadable = true;
  private readonly writer = new SettingsWriter(
    (snapshot) => this.saveData(snapshot),
    () =>
      new Notice(
        "toolbar+: settings could not be saved. Your changes remain in this session.",
      ),
  );
  async onload() {
    this.addChild(this.ui);
    try {
      const saved: unknown = await this.loadData();
      if (
        saved &&
        typeof saved === "object" &&
        "version" in saved &&
        saved.version !== 1
      ) {
        throw new Error(
          "Unsupported settings version; use the matching toolbar+ version.",
        );
      }
      this.config = normalize(saved);
    } catch (error) {
      console.error(
        "toolbar+: could not read saved settings; using defaults",
        error,
      );
      this.config = defaults();
      this.settingsReadable = false;
      new Notice(
        "toolbar+: saved settings could not be read. Using temporary defaults; reload after sync finishes before editing settings.",
        10000,
      );
    }
    if (this.disposed) return;
    this.addSettingTab(new ToolbarSettings(this.app, this));
    this.addCommand({
      id: "configure",
      name: "Configure toolbar and gestures",
      callback: () => this.configure(),
    });
    this.addCommand({
      id: "insert-alias",
      name: "Insert alias",
      editorCallback: (editor: Editor) => {
        if (!this.insertAlias.insert(editor)) {
          new Notice(INVALID_ALIAS_MESSAGE);
        }
      },
    });
    this.addCommand({
      id: "dock",
      name: "Dock toolbar",
      callback: () => this.setMode("docked"),
    });
    this.addCommand({
      id: "float",
      name: "Float gesture control",
      callback: () => this.setMode("floating"),
    });
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor) =>
        this.insertAlias.onEditorChange(editor),
      ),
    );
    this.app.workspace.onLayoutReady(() => {
      if (this.disposed) return;
      try {
        this.mount();
      } catch (error) {
        console.error("toolbar+: mobile toolbar initialization failed", error);
        this.cleanupUi();
        new Notice(
          `toolbar+ could not create its toolbar: ${error instanceof Error ? error.message : String(error)}`,
          10000,
        );
      }
    });
  }
  persist() {
    if (this.disposed) return;
    if (!this.settingsReadable) {
      new Notice(
        "toolbar+: changes are temporary because saved settings could not be read. Reload after sync finishes to restore saving.",
      );
      return;
    }
    this.writer.enqueue(this.config);
  }
  private mount() {
    if (this.root?.isConnected) return;
    this.root = document.body.createDiv({ cls: "toolbar-plus" });
    this.bar = this.root.createDiv({
      cls: "tp-bar",
      attr: { role: "toolbar", "aria-label": "toolbar+" },
    });
    this.commandsEl = this.bar.createDiv({ cls: "tp-commands" });
    this.handleSlot = this.bar.createDiv({ cls: "tp-handle-slot" });
    this.handle = this.handleSlot.createEl("button", {
      cls: "tp-handle",
      attr: {
        "aria-label":
          "Configure toolbar+. Swipe down when docked to hide the keyboard; hold to move.",
        title:
          "toolbar+ · tap to configure · swipe down to hide keyboard · hold to move",
      },
    });
    for (let i = 0; i < 9; i++) this.handle.createSpan();
    this.grid = this.root.createDiv({
      cls: "tp-grid",
      attr: { "aria-hidden": "true" },
    });
    this.target = this.root.createDiv({
      cls: "tp-dock-target",
      text: "Release here",
    });
    this.status = this.root.createDiv({
      cls: "tp-sr",
      attr: { role: "status", "aria-live": "polite" },
    });
    this.host = new MobileToolbarHost(
      document,
      this.root,
      this.bar,
      this.target,
    );
    this.ui.registerDomEvent(this.handle, "pointerdown", (e) => this.down(e));
    this.ui.registerDomEvent(document, "pointermove", (e) => this.move(e));
    this.ui.registerDomEvent(document, "pointerup", (e) => this.up(e));
    this.ui.registerDomEvent(document, "pointercancel", (e) => {
      if (this.interaction?.id === e.pointerId) this.cancel();
    });
    this.ui.registerDomEvent(this.handle, "contextmenu", (e) =>
      e.preventDefault(),
    );
    this.ui.registerDomEvent(this.handle, "click", (e) => {
      if (e.detail === 0) this.configure();
    });
    this.ui.registerDomEvent(document, "keydown", (e) => {
      if (e.key === "Escape") this.cancel();
    });
    this.ui.registerDomEvent(window, "blur", () => this.cancel());
    if (Platform.isMobile) {
      const beginKeyboardShow = (event: Event) => {
        this.host?.beginKeyboardShow();
        this.cancel();
        const height = (event as Event & { keyboardHeight?: number })
          .keyboardHeight;
        if (
          !this.keyboardEntrance &&
          this.bar.hidden &&
          !this.suspended &&
          this.config.mode === "docked" &&
          document.body.classList.contains("mod-toolbar-open") &&
          typeof height === "number" &&
          Number.isFinite(height) &&
          height > 0
        ) {
          const closedHeight = this.placementSize().height;
          const barHeight =
            parseFloat(
              getComputedStyle(this.bar).getPropertyValue("--tp-height"),
            ) || 42;
          const top = Math.max(0, closedHeight - height - barHeight);
          this.keyboardEntrance = { top, travel: closedHeight - top };
        }
        this.scheduleKeyboardLayout();
      };
      const showKeyboard = () => {
        this.clearKeyboardEntrance();
        this.host?.setKeyboardVisible(true);
        this.cancel();
        this.scheduleKeyboardLayout();
      };
      const hideKeyboard = (event: Event) => {
        this.clearKeyboardEntrance();
        const physicalKeyboard =
          (event as Event & { hasPhysicalKeyboard?: boolean })
            .hasPhysicalKeyboard === true;
        this.host?.setKeyboardVisible(physicalKeyboard);
        this.cancel();
        this.scheduleKeyboardLayout();
      };
      // Native mobile events are not part of TypeScript's WindowEventMap.
      window.addEventListener("keyboardWillShow", beginKeyboardShow);
      window.addEventListener("keyboardDidShow", showKeyboard);
      window.addEventListener("keyboardWillHide", hideKeyboard);
      this.ui.register(() => {
        window.removeEventListener("keyboardWillShow", beginKeyboardShow);
        window.removeEventListener("keyboardDidShow", showKeyboard);
        window.removeEventListener("keyboardWillHide", hideKeyboard);
      });
    }
    this.ui.registerDomEvent(document, "visibilitychange", () => {
      if (document.hidden) this.cancel();
    });
    this.ui.registerDomEvent(window, "resize", () => {
      this.cancel();
      this.scheduleLayout();
    });
    this.ui.registerDomEvent(document, "focusin", () =>
      this.scheduleKeyboardLayout(),
    );
    this.ui.registerDomEvent(document, "focusout", () =>
      this.scheduleKeyboardLayout(),
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
      }),
    );
    this.ui.registerEvent(
      this.app.workspace.on("layout-change", () => this.scheduleLayout()),
    );
    if (typeof MutationObserver !== "undefined") {
      const keyboardObserver = new MutationObserver(() => {
        // Obsidian may rewrite the body's complete class list during keyboard
        // transitions. Always reconcile so the floating host marker is
        // restored even when mod-toolbar-open itself did not change.
        this.scheduleKeyboardLayout();
      });
      keyboardObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
      });
      keyboardObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style"],
      });
      this.ui.register(() => keyboardObserver.disconnect());
      const observer = new MutationObserver((records) => {
        // Ignore editor text churn: only toolbar insertion/removal and the
        // keyboard class can change docking. No polling or idle frame loop.
        const toolbarChanged = records.some(
          (record) =>
            record.type === "childList" &&
            [
              ...Array.from(record.addedNodes),
              ...Array.from(record.removedNodes),
            ].some((node) => this.host?.containsNativeHost(node)),
        );
        if (toolbarChanged) this.scheduleLayout();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      this.ui.register(() => observer.disconnect());
    }
    this.ready = true;
    this.refresh();
  }
  private bounds() {
    return viewportBounds(
      window.visualViewport,
      window.innerWidth,
      window.innerHeight,
    );
  }
  private placementSize(bounds = this.bounds()) {
    const documentElement = document.documentElement;
    return resolvePlacementSize(
      bounds,
      window.innerWidth,
      window.innerHeight,
      documentElement?.clientWidth || 0,
      documentElement?.clientHeight || 0,
    );
  }
  private scheduleLayout() {
    if (this.disposed || !this.ready) return;
    if (!this.frame)
      this.frame = window.requestAnimationFrame(() => {
        this.frame = 0;
        this.layout();
      });
  }
  private scheduleKeyboardLayout() {
    this.scheduleLayout();
  }
  private clearKeyboardEntrance() {
    this.keyboardEntrance = undefined;
    this.bar?.removeClass("tp-keyboard-entering");
  }
  private layout() {
    if (this.disposed || !this.ready) return;
    const b = this.bounds();
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    this.host?.refreshNativeHost();
    const nativeAvailable = this.host?.hasNativeHost ?? false;
    const nativeToolbarOpen = this.host?.nativeToolbarOpen ?? false;
    const dockedVisible = Platform.isMobile
      ? nativeAvailable && nativeToolbarOpen
      : this.config.desktop && !!active;
    const entering =
      Platform.isMobile &&
      !this.suspended &&
      this.config.mode === "docked" &&
      !!this.keyboardEntrance;
    const visible =
      !this.suspended &&
      (Platform.isMobile || this.config.desktop) &&
      (this.config.mode === "floating" ||
        (this.config.mode === "docked" && (dockedVisible || entering)));
    if (!visible && this.interaction) this.finish();
    this.root.hidden = !visible;
    this.bar.hidden = !visible;
    const moving = this.interaction?.kind === "moving";
    this.host?.reconcile(
      desiredHostState({
        mobile: Platform.isMobile,
        mode: this.config.mode,
        pluginVisible: visible,
        movingFromDocked: moving && this.interaction?.previousMode === "docked",
        movingFromFloating:
          moving && this.interaction?.previousMode === "floating",
        nativeToolbarOpen,
        nativeHostAvailable: nativeAvailable,
      }),
    );
    const configuredHeight = parseFloat(
      getComputedStyle(this.bar).getPropertyValue("--tp-height"),
    );
    const { top, targetTop } = toolbarPositions(b, configuredHeight);
    this.root.setCssProps({
      "--tp-left": "0px",
      "--tp-width": `${b.width}px`,
      "--tp-top": `${entering ? this.keyboardEntrance!.top : top}px`,
      "--tp-target-top": `${targetTop}px`,
    });
    if (entering)
      this.bar.setCssProps({
        "--tp-keyboard-travel": `${this.keyboardEntrance!.travel}px`,
      });
    this.bar.toggleClass("tp-keyboard-entering", entering);
    if (!this.interaction || this.interaction.kind !== "moving") {
      const placement = this.placementSize(b);
      const point = pointFromNormalized(this.config.position, placement);
      this.placeHandle(point.x, point.y);
    }
  }
  private placeHandle(x: number, y: number) {
    const b = this.bounds(),
      style = getComputedStyle(this.root);
    const inset = (side: string) =>
      parseFloat(style.getPropertyValue(`padding-${side}`)) || 0;
    const point = clampHandlePoint({ x, y }, b, {
      left: inset("left"),
      right: inset("right"),
      top: inset("top"),
      bottom: inset("bottom"),
    });
    this.handle.setCssStyles({ left: `${point.x}px`, top: `${point.y}px` });
  }
  refresh() {
    if (this.disposed || !this.ready) return;
    this.cancel();
    this.commandsEl.empty();
    for (const binding of this.config.docked) {
      const button = this.commandsEl.createEl("button", {
        cls: "tp-command",
        attr: { "aria-label": this.label(binding), title: this.label(binding) },
      });
      setIcon(button, binding.icon || "command");
      button.addEventListener("pointerdown", (e) => e.preventDefault());
      button.addEventListener("mousedown", (e) => e.preventDefault());
      button.addEventListener("click", () => this.execute(binding));
    }
    this.grid.empty();
    for (const dir of ["nw", "n", "ne", "w", "center", "e", "sw", "s", "se"]) {
      const cell = this.grid.createDiv({
        cls: "tp-cell",
        attr: { "data-dir": dir },
      });
      if (dir === "center") {
        cell.addClass("tp-center");
        continue;
      }
      const binding = this.config.gestures[dir as Direction];
      setIcon(
        cell.createDiv({ cls: "tp-cell-icon" }),
        binding.icon || "command",
      );
      cell.createSpan({ text: this.label(binding) });
    }
    this.root.toggleClass("tp-floating", this.config.mode === "floating");
    this.layout();
  }
  label(binding: Binding) {
    const commands = registry(this.app);
    if (binding.id && commands) {
      try {
        const command =
          commands.findCommand?.(binding.id) ?? commands.commands?.[binding.id];
        if (command?.name) return command.name;
      } catch {
        /* Fall back to enumeration for alternate registry versions. */
      }
    }
    const editorAction = editorActions[binding.id];
    if (editorAction) return editorAction.name;
    return binding.id
      ? (availableCommands(this.app).find((c) => c.id === binding.id)?.name ??
          `Unavailable: ${binding.id}`)
      : "Unassigned";
  }
  private execute(binding: Binding) {
    if (!binding.id) {
      new Notice("toolbar+: this direction is unassigned.");
      return;
    }
    try {
      if (!runCommand(this.app, binding.id))
        new Notice(
          `toolbar+: ${this.label(binding)} is not available in this context.`,
        );
      else this.tick(12);
    } catch {
      new Notice(`toolbar+: could not run ${this.label(binding)}.`);
    }
  }
  private tick(ms = 7) {
    try {
      if (this.config.haptics && typeof navigator.vibrate === "function")
        navigator.vibrate(ms);
    } catch {
      /* Optional device feedback must never interrupt a gesture. */
    }
  }
  private down(e: PointerEvent) {
    if (
      this.disposed ||
      !this.ready ||
      this.keyboardEntrance ||
      this.root.hidden ||
      e.button !== 0 ||
      !e.isPrimary ||
      this.interaction
    )
      return;
    e.preventDefault();
    const rect = this.handle.getBoundingClientRect();
    const i: Interaction = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      kind: "pending",
      direction: null,
      timer: 0,
      previousMode: this.config.mode,
      previousPosition: { ...this.config.position },
    };
    this.interaction = i;
    try {
      this.handle.setPointerCapture(e.pointerId);
    } catch {
      this.interaction = undefined;
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
        // WebKit can release pointer capture when an active pointer's ancestor
        // moves to another DOM host. Reacquire it after the move; document-level
        // listeners remain the fallback if capture is unavailable.
        this.handle.setPointerCapture(i.id);
      } catch {
        /* Document-level pointer events keep the drag active. */
      }
      this.tick(18);
      if (i.previousMode === "floating") {
        this.status.setText(
          "Moving. Release over the bottom target to dock the toolbar.",
        );
      } else {
        this.status.setText("Moving. Release to place the floating control.");
      }
    }, this.config.holdMs);
  }
  private move(e: PointerEvent) {
    const i = this.interaction;
    if (!i || i.id !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - i.x,
      dy = e.clientY - i.y;
    if (i.kind === "pending" && Math.hypot(dx, dy) > 10) {
      window.clearTimeout(i.timer);
      i.kind = this.config.mode === "floating" ? "gesture" : "keyboard";
    }
    if (i.kind === "moving") {
      this.placeHandle(e.clientX - i.offsetX, e.clientY - i.offsetY);
      this.target.toggleClass(
        "tp-over",
        i.previousMode === "floating" && this.overTarget(e.clientX, e.clientY),
      );
      return;
    }
    if (i.kind === "keyboard") {
      const dir = directionAt(dx, dy, this.config.threshold);
      if (dir !== i.direction) {
        i.direction = dir;
        if (dir === "s") this.tick();
        this.status.setText(
          dir === "s"
            ? "Release to hide keyboard"
            : "Swipe down to hide keyboard",
        );
      }
      return;
    }
    if (i.kind !== "gesture") return;
    const dir = directionAt(dx, dy, this.config.threshold);
    this.root.toggleClass("tp-gesturing", this.config.showGrid);
    const b = this.bounds(),
      size = Math.max(1, Math.min(252, b.width - 16, b.height - 16));
    this.grid.setCssStyles({
      width: `${size}px`,
      height: `${size}px`,
      left: `${clamp(i.x - size / 2, b.left + 8, b.left + b.width - size - 8)}px`,
      top: `${clamp(i.y - size / 2, b.top + 8, b.top + b.height - size - 8)}px`,
    });
    if (dir !== i.direction) {
      i.direction = dir;
      if (dir) this.tick();
      this.grid
        .querySelectorAll(".tp-cell")
        .forEach((cell) =>
          cell.classList.toggle(
            "tp-selected",
            cell.getAttribute("data-dir") === dir,
          ),
        );
      this.status.setText(
        dir ? this.label(this.config.gestures[dir]) : "Release to cancel",
      );
    }
  }
  private overTarget(x: number, y: number) {
    const r = this.target.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top - 16 && y <= r.bottom + 16;
  }
  private up(e: PointerEvent) {
    const i = this.interaction;
    if (!i || i.id !== e.pointerId) return;
    e.preventDefault();
    const kind = i.kind,
      dir =
        i.kind === "gesture" || i.kind === "keyboard"
          ? directionAt(e.clientX - i.x, e.clientY - i.y, this.config.threshold)
          : null,
      overTarget =
        kind === "moving" &&
        i.previousMode === "floating" &&
        this.overTarget(e.clientX, e.clientY),
      hideKeyboard = kind === "keyboard" && dir === "s";
    if (kind === "moving") {
      this.placeHandle(e.clientX - i.offsetX, e.clientY - i.offsetY);
      this.config.mode = overTarget ? "docked" : "floating";
      const r = this.handle.getBoundingClientRect(),
        placement = this.placementSize();
      this.config.position = normalizedFromPoint(
        { x: r.left, y: r.top },
        placement,
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
  private hideKeyboard() {
    try {
      if (runCommand(this.app, "editor:toggle-keyboard")) {
        this.scheduleKeyboardLayout();
        return;
      }
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) return;
      view.editor.blur();
      this.scheduleKeyboardLayout();
    } catch (error) {
      console.error("toolbar+: could not hide the keyboard", error);
    }
  }
  private finish() {
    const i = this.interaction;
    if (!i) return;
    window.clearTimeout(i.timer);
    this.interaction = undefined;
    try {
      if (this.handle.hasPointerCapture(i.id))
        this.handle.releasePointerCapture(i.id);
    } catch {
      /* A removed pointer or detached WebView may already have released it. */
    }
    this.root.removeClass(
      "tp-moving",
      "tp-can-dock",
      "tp-gesturing",
      "tp-pressed",
    );
    this.target.removeClass("tp-over");
    this.grid
      .querySelectorAll(".tp-selected")
      .forEach((c) => c.classList.remove("tp-selected"));
  }
  private cancel() {
    const i = this.interaction;
    if (!i) return;
    this.config.mode = i.previousMode;
    this.config.position = i.previousPosition;
    this.finish();
    this.layout();
  }
  setMode(mode: Config["mode"]) {
    this.clearKeyboardEntrance();
    this.cancel();
    this.config.mode = mode;
    this.persist();
    this.refresh();
  }
  configure() {
    if (this.disposed || this.modals.size) return;
    this.clearKeyboardEntrance();
    const modal = new ConfigModal(this.app, this);
    this.modals.add(modal);
    this.suspended++;
    this.cancel();
    this.layout();
    modal.open();
  }
  pick<T>(
    items: T[],
    label: (item: T) => string,
    choose: (item: T) => void,
    placeholder: string,
  ) {
    if (this.disposed) return;
    const picker: Picker<T> = new Picker(
      this.app,
      items,
      label,
      (item) => {
        if (!this.disposed) choose(item);
      },
      placeholder,
      () => {
        this.pickers.delete(picker);
      },
    );
    this.pickers.add(picker);
    picker.open();
  }
  closed(modal: Modal) {
    this.modals.delete(modal);
    this.suspended = Math.max(0, this.suspended - 1);
    this.refresh();
  }
  private cleanupUi() {
    this.clearKeyboardEntrance();
    this.ready = false;
    this.finish();
    this.ui.unload();
    window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.host?.dispose();
    this.host = undefined;
    this.root?.remove();
  }
  onunload() {
    this.disposed = true;
    this.writer.close();
    for (const picker of [...this.pickers]) picker.close();
    for (const modal of [...this.modals]) modal.close();
    this.cleanupUi();
  }
}
class ConfigModal extends Modal {
  private tab: Config["mode"];

  constructor(
    app: App,
    private plugin: ToolbarPlus,
  ) {
    super(app);
    this.tab = plugin.config.mode;
  }
  onOpen() {
    this.modalEl.addClass("tp-config-modal");
    this.setTitle("toolbar+ commands");
    this.render();
  }
  private render() {
    renderCommandModal(this.contentEl, this.plugin, this.tab, (tab) => {
      this.tab = tab;
      this.render();
    });
  }
  onClose() {
    this.contentEl.empty();
    this.plugin.closed(this);
  }
}
class ToolbarSettings extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: ToolbarPlus,
  ) {
    super(app, plugin);
  }
  getSettingDefinitions(): SettingDefinitionItem[] {
    const p = this.plugin;
    return [
      {
        type: "group",
        cls: "tp-settings tp-plugin-settings",
        items: [
          {
            name: "Command layouts",
            desc: "Edit commands from the tactile control.",
            aliases: ["docked buttons", "floating gestures"],
            render: (setting) => {
              setting.addButton((button) =>
                button
                  .setButtonText("Edit commands")
                  .onClick(() => p.configure()),
              );
            },
          },
          {
            name: "Control position",
            desc: "Switch between the docked toolbar and floating gesture control.",
            aliases: ["dock", "float"],
            render: (setting) => {
              setting.addButton((button) =>
                button
                  .setButtonText(
                    p.config.mode === "docked"
                      ? "Float control"
                      : "Dock control",
                  )
                  .onClick(() => {
                    p.setMode(
                      p.config.mode === "docked" ? "floating" : "docked",
                    );
                    this.update();
                  }),
              );
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Behavior",
        cls: "tp-settings tp-plugin-settings",
        items: [
          {
            name: "Gesture grid",
            desc: "Show command directions while swiping.",
            control: { type: "toggle", key: "showGrid" },
          },
          {
            name: "Haptic feedback",
            desc: "Vibrate on a selection or long press.",
            control: { type: "toggle", key: "haptics" },
          },
          {
            name: "Show on desktop",
            desc: "Use toolbar+ with a mouse or trackpad.",
            control: { type: "toggle", key: "desktop" },
          },
          {
            name: "Hold to move",
            desc: "Long-press delay, in milliseconds.",
            control: {
              type: "slider",
              key: "holdMs",
              min: 300,
              max: 1200,
              step: 50,
              displayFormat: (value) => `${value} ms`,
            },
          },
          {
            name: "Gesture distance",
            desc: "Swipe distance needed to select a command.",
            control: {
              type: "slider",
              key: "threshold",
              min: 16,
              max: 80,
              step: 2,
              displayFormat: (value) => `${value} px`,
            },
          },
        ],
      },
    ];
  }
  getControlValue(key: string): unknown {
    switch (key) {
      case "showGrid":
      case "haptics":
      case "desktop":
      case "holdMs":
      case "threshold":
        return this.plugin.config[key];
    }
  }
  setControlValue(key: string, value: unknown): void {
    const p = this.plugin;
    switch (key) {
      case "showGrid":
      case "haptics":
      case "desktop":
        if (typeof value !== "boolean") return;
        p.config[key] = value;
        break;
      case "holdMs":
      case "threshold":
        if (typeof value !== "number" || !Number.isFinite(value)) return;
        p.config[key] =
          key === "holdMs" ? clamp(value, 300, 1200) : clamp(value, 16, 80);
        break;
      default:
        return;
    }
    p.persist();
    if (key === "desktop") p.refresh();
  }
}

function chooseCommand(p: ToolbarPlus, binding: Binding, done: () => void) {
  p.pick(
    availableCommands(p.app),
    (command) => command.name,
    (command) => {
      binding.id = command.id;
      binding.icon = command.icon ?? binding.icon ?? "command";
      done();
    },
    "Find an Obsidian command…",
  );
}

function chooseIcon(p: ToolbarPlus, binding: Binding, done: () => void) {
  p.pick(
    availableIcons(),
    (icon) => icon,
    (icon) => {
      binding.icon = icon;
      done();
    },
    "Find an icon…",
  );
}

function commandIconButton(
  parent: HTMLElement,
  icon: string,
  label: string,
  action: () => void,
  disabled = false,
) {
  const button = parent.createEl("button", {
    cls: "tp-icon-button",
    attr: { "aria-label": label, title: label },
  });
  setIcon(button, icon);
  button.disabled = disabled;
  button.onclick = action;
  return button;
}

function renderCommandModal(
  el: HTMLElement,
  p: ToolbarPlus,
  tab: Config["mode"],
  selectTab: (tab: Config["mode"]) => void,
) {
  el.empty();
  el.addClass("tp-command-editor");
  const changed = () => {
    p.persist();
    p.refresh();
    renderCommandModal(el, p, tab, selectTab);
  };

  const tabs = el.createDiv({ cls: "tp-tabs", attr: { role: "tablist" } });
  const activate = (value: Config["mode"]) => {
    selectTab(value);
    el.querySelector<HTMLButtonElement>(
      `[role="tab"][aria-selected="true"]`,
    )?.focus();
  };
  for (const [value, label] of [
    ["docked", "Docked"],
    ["floating", "Floating"],
  ] as const) {
    const button = tabs.createEl("button", {
      cls: "tp-tab",
      text: label,
      attr: {
        role: "tab",
        id: `tp-tab-${value}`,
        "aria-controls": "tp-command-panel",
        "aria-selected": String(tab === value),
        tabindex: tab === value ? "0" : "-1",
      },
    });
    button.onclick = () => activate(value);
    button.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      activate(
        event.key === "Home"
          ? "docked"
          : event.key === "End"
            ? "floating"
            : value === "docked"
              ? "floating"
              : "docked",
      );
    };
  }

  const panel = el.createDiv({
    cls: "tp-command-panel",
    attr: {
      role: "tabpanel",
      id: "tp-command-panel",
      "aria-labelledby": `tp-tab-${tab}`,
    },
  });
  if (tab === "floating") {
    panel.createEl("p", {
      cls: "tp-panel-hint",
      text: "Tap a direction to change its swipe command.",
    });
    const grid = panel.createDiv({ cls: "tp-binding-grid" });
    for (const dir of ["nw", "n", "ne", "w", "center", "e", "sw", "s", "se"]) {
      if (dir === "center") {
        grid.createDiv({ cls: "tp-binding-center", text: "⠿" });
        continue;
      }
      const direction = dir as Direction;
      const binding = p.config.gestures[direction];
      const cell = grid.createDiv({ cls: "tp-binding-cell" });
      const button = cell.createEl("button", {
        text: `${arrows[direction]} ${p.label(binding)}`,
        attr: {
          "aria-label": `Bind ${direction}: ${p.label(binding)}`,
        },
      });
      button.onclick = () => chooseCommand(p, binding, changed);
      const clear = cell.createEl("button", {
        cls: "tp-clear",
        text: "×",
        attr: {
          "aria-label": `Clear ${direction} binding`,
          title: "Clear binding",
        },
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
    text: "Commands appear from left to right in the docked capsule.",
  });
  const list = panel.createDiv({ cls: "tp-docked-list" });
  if (p.config.docked.length === 0)
    list.createEl("p", {
      cls: "tp-panel-hint",
      text: "No docked commands yet.",
    });
  p.config.docked.forEach((binding, index) => {
    const row = list.createDiv({ cls: "tp-docked-binding" });
    commandIconButton(
      row,
      binding.icon || "command",
      `Change icon for ${p.label(binding)}`,
      () => chooseIcon(p, binding, changed),
    );
    const command = row.createEl("button", {
      cls: "tp-command-name",
      text: p.label(binding),
      attr: { title: `${p.label(binding)} — Change command` },
    });
    command.onclick = () => chooseCommand(p, binding, changed);
    commandIconButton(
      row,
      "arrow-up",
      "Move earlier",
      () => {
        [p.config.docked[index - 1], p.config.docked[index]] = [
          binding,
          p.config.docked[index - 1],
        ];
        changed();
      },
      index === 0,
    );
    commandIconButton(
      row,
      "arrow-down",
      "Move later",
      () => {
        [p.config.docked[index + 1], p.config.docked[index]] = [
          binding,
          p.config.docked[index + 1],
        ];
        changed();
      },
      index === p.config.docked.length - 1,
    );
    commandIconButton(row, "trash-2", "Remove command", () => {
      p.config.docked.splice(index, 1);
      changed();
    });
  });
  const add = panel.createEl("button", {
    cls: "tp-add-command",
    text: "+ Add command",
  });
  add.disabled = p.config.docked.length >= 40;
  add.onclick = () => {
    const binding = { id: "", icon: "command" };
    chooseCommand(p, binding, () => {
      p.config.docked.push(binding);
      changed();
    });
  };
}
