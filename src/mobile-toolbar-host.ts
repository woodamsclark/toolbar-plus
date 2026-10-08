export type MobileHostState =
  "restored" | "docked" | "hidden" | "floating" | "dock-target";

export interface DesiredHostStateInput {
  mobile: boolean;
  mode: "docked" | "floating";
  pluginVisible: boolean;
  movingFromDocked: boolean;
  movingFromFloating: boolean;
  nativeToolbarOpen: boolean;
  nativeHostAvailable: boolean;
}

export function desiredHostState({
  mobile,
  mode,
  pluginVisible,
  movingFromDocked,
  movingFromFloating,
  nativeToolbarOpen,
  nativeHostAvailable,
}: DesiredHostStateInput): MobileHostState {
  if (!mobile) return "restored";
  if (movingFromFloating)
    return nativeToolbarOpen && nativeHostAvailable
      ? "dock-target"
      : "floating";
  if (movingFromDocked) return "floating";
  if (mode === "floating") return "floating";
  if (!nativeToolbarOpen) return "hidden";
  return pluginVisible && nativeToolbarOpen && nativeHostAvailable
    ? "docked"
    : "restored";
}

export class MobileToolbarHost {
  private static readonly collapsedDocumentClass =
    "tp-mobile-toolbar-collapsed";
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly target: HTMLElement;
  private native: HTMLElement | null = null;
  private detachedElements: {
    element: HTMLElement;
    parent: Node;
    nextSibling: Node | null;
  }[] = [];
  private state: MobileHostState = "restored";
  private keyboardVisible?: boolean;

  constructor(
    doc: Document,
    root: HTMLElement,
    bar: HTMLElement,
    target: HTMLElement,
  ) {
    this.doc = doc;
    this.root = root;
    this.bar = bar;
    this.target = target;
  }

  get hasNativeHost() {
    return (
      !!this.native && (this.native.isConnected || this.isDetached(this.native))
    );
  }

  // On iOS, the native toolbar marker follows editor focus, not necessarily
  // software-keyboard visibility. Use keyboard lifecycle/height as well.
  get nativeToolbarOpen() {
    if (!this.doc.body.classList.contains("mod-toolbar-open")) return false;
    if (this.keyboardVisible !== undefined) return this.keyboardVisible;
    const height = parseFloat(
      this.doc.defaultView
        ?.getComputedStyle(this.doc.documentElement)
        .getPropertyValue("--keyboard-height") ?? "",
    );
    return Number.isFinite(height) ? height > 0 : true;
  }

  setKeyboardVisible(visible: boolean) {
    this.keyboardVisible = visible;
  }

  get currentState() {
    return this.state;
  }

  containsNativeHost(node: Node) {
    if (node.nodeType !== 1) return false;
    const element = node as Element;
    return (
      element.matches(".mobile-toolbar, .mobile-toolbar-spacer") ||
      !!element.querySelector(".mobile-toolbar, .mobile-toolbar-spacer")
    );
  }

  refreshNativeHost() {
    const next = this.doc.querySelector<HTMLElement>(".mobile-toolbar");
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

  reconcile(state: MobileHostState) {
    this.state = state;
    this.refreshNativeHost();
    this.apply();
  }

  dispose() {
    this.state = "restored";
    this.doc.documentElement.classList.remove(
      MobileToolbarHost.collapsedDocumentClass,
    );
    this.doc.documentElement.classList.remove("tp-mobile-keyboard-open");
    this.moveBarToOverlay();
    this.moveTargetToOverlay();
    this.restoreDetachedElements();
    this.restoreNative(this.native);
    delete this.root.dataset.tpHostState;
    this.native = null;
  }

  private apply() {
    this.root.dataset.tpHostState = this.state;
    this.doc.documentElement.classList.toggle(
      MobileToolbarHost.collapsedDocumentClass,
      this.state === "floating" || this.state === "hidden",
    );
    this.doc.documentElement.classList.toggle(
      "tp-mobile-keyboard-open",
      this.nativeToolbarOpen,
    );
    if (this.state === "floating" || this.state === "hidden") {
      this.moveBarToOverlay();
      this.moveTargetToOverlay();
      const native = this.native;
      if (native) {
        native.dataset.tpHostState = this.state;
        native.classList.add("tp-native-replaced", "tp-native-collapsed");
        if (native.isConnected) this.detach(native);
      }
      this.doc
        .querySelectorAll<HTMLElement>(".mobile-toolbar-spacer")
        .forEach((spacer) => this.detach(spacer));
      return;
    }

    this.restoreDetachedElements();
    const native = this.native;
    if (!native?.isConnected || this.state === "restored") {
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

  private moveBarToOverlay() {
    if (this.bar.parentElement !== this.root) this.root.prepend(this.bar);
    this.bar.classList.remove("tp-in-native");
  }

  private moveTargetToOverlay() {
    if (this.target.parentElement !== this.root) this.root.append(this.target);
    this.target.classList.remove("tp-target-in-native");
  }

  private restoreNative(native: HTMLElement | null) {
    if (!native) return;
    native.classList.remove("tp-native-replaced", "tp-native-collapsed");
    delete native.dataset.tpHostState;
  }

  private isDetached(element: HTMLElement) {
    return this.detachedElements.some((entry) => entry.element === element);
  }

  private forgetDetached(element: HTMLElement) {
    this.detachedElements = this.detachedElements.filter(
      (entry) => entry.element !== element,
    );
  }

  private detach(element: HTMLElement) {
    if (this.isDetached(element)) return;
    const parent = element.parentNode;
    if (!parent) return;
    this.detachedElements.push({
      element,
      parent,
      nextSibling: element.nextSibling,
    });
    element.remove();
  }

  private restoreDetachedElements() {
    // Obsidian hide() may run while these elements are already detached by
    // toolbar+. Both its toolbar marker and keyboard visibility must allow
    // restoration; saved parents alone resurrect a keyboard-hidden row.
    const nativeToolbarOpen = this.nativeToolbarOpen;
    for (const { element, parent, nextSibling } of this.detachedElements
      .slice()
      .reverse()) {
      if (nativeToolbarOpen && !element.isConnected && parent.isConnected) {
        parent.insertBefore(
          element,
          nextSibling?.parentNode === parent ? nextSibling : null,
        );
      }
    }
    this.detachedElements = [];
  }
}
