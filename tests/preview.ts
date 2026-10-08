import ToolbarPlus from "../src/main";
const proto: any = HTMLElement.prototype;
proto.createEl = function (tag: string, o: any = {}) {
  const e = document.createElement(tag);
  e.className = o.cls ?? "";
  e.textContent = o.text ?? "";
  for (const [k, v] of Object.entries(o.attr ?? {}))
    e.setAttribute(k, String(v));
  this.append(e);
  return e;
};
proto.createDiv = function (o: any) {
  return this.createEl("div", typeof o === "string" ? { cls: o } : o);
};
proto.createSpan = function (o: any) {
  return this.createEl("span", o);
};
proto.empty = function () {
  this.replaceChildren();
};
proto.addClass = function (...c: string[]) {
  this.classList.add(...c);
};
proto.removeClass = function (...c: string[]) {
  this.classList.remove(...c);
};
proto.toggleClass = function (c: string, v: boolean) {
  this.classList.toggle(c, v);
};
proto.setText = function (s: string) {
  this.textContent = s;
};
let ready: () => void;
const commands = [
  ["undo", "Undo"],
  ["redo", "Redo"],
  ["insert-link", "Insert link"],
  ["set-heading", "Heading"],
  ["toggle-checklist-status", "Toggle checkbox"],
  ["indent-list", "Indent"],
  ["unindent-list", "Outdent"],
].map(([id, name]) => ({ id: `editor:${id}`, name }));
commands.push({ id: "command-palette:open", name: "Command palette" });
const p = new ToolbarPlus();
(p as any).app = {
  workspace: {
    onLayoutReady: (fn: any) => (ready = fn),
    getActiveViewOfType: () => ({}),
    on: () => ({}),
  },
  commands: {
    listCommands: () => commands,
    executeCommandById: (id: string) => {
      document.querySelector("#result")!.textContent = `Executed: ${id}`;
      return true;
    },
  },
};
await p.onload();
ready!();
const measure = () => {
  const editor = document.querySelector<HTMLElement>("#editor")!;
  const native = document.querySelector<HTMLElement>(".mobile-toolbar");
  const keyboard = document.querySelector<HTMLElement>(".fixture-keyboard")!;
  const bar = document.querySelector<HTMLElement>(".tp-bar")!;
  const handle = document.querySelector<HTMLElement>(".tp-handle")!;
  const commands = document.querySelector<HTMLElement>(".tp-commands")!;
  const state =
    document.querySelector<HTMLElement>(".toolbar-plus")!.dataset.tpHostState;
  const expectedBottom =
    state === "docked" && native
      ? native.getBoundingClientRect().top
      : keyboard.getBoundingClientRect().top;
  const gap = expectedBottom - editor.getBoundingClientRect().bottom;
  const metric = document.querySelector<HTMLOutputElement>("#metrics")!;
  metric.textContent = [
    `state=${state}`,
    `native=${native ? getComputedStyle(native).display : "detached"}/${native?.getBoundingClientRect().height.toFixed(0) ?? "0"}px`,
    `bar=${bar.getBoundingClientRect().height.toFixed(0)}px`,
    `bubble=${handle.getBoundingClientRect().width.toFixed(0)}×${handle.getBoundingClientRect().height.toFixed(0)}px`,
    `capsule=${commands.getBoundingClientRect().height.toFixed(0)}px`,
    `editor-gap=${gap.toFixed(0)}px`,
  ].join(" · ");
};
const measureNextFrame = () =>
  requestAnimationFrame(() => requestAnimationFrame(measure));
document
  .querySelector("#configure")!
  .addEventListener("click", () => p.configure());
document.querySelector("#float")!.addEventListener("click", () => {
  p.setMode("floating");
  // Model Obsidian inserting a replacement host and rewriting body classes
  // after the keyboard animation. The controller must detach it as well.
  const replacement = document.createElement("div");
  replacement.className = "mobile-toolbar";
  replacement.setAttribute("aria-label", "Delayed replacement toolbar host");
  document.querySelector(".fixture-app")!.append(replacement);
  document.body.className = "mod-toolbar-open theme-light";
  measureNextFrame();
});
document.querySelector("#dock")!.addEventListener("click", () => {
  p.setMode("docked");
  measureNextFrame();
});
document.querySelector("#theme")!.addEventListener("click", (event) => {
  const dark = document.body.classList.toggle("theme-dark");
  document.body.classList.toggle("theme-light", !dark);
  (event.currentTarget as HTMLButtonElement).textContent = dark
    ? "Light theme"
    : "Dark theme";
  measureNextFrame();
});
new ResizeObserver(measureNextFrame).observe(
  document.querySelector(".fixture")!,
);
measureNextFrame();
