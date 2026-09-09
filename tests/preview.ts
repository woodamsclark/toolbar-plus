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
document
  .querySelector("#configure")!
  .addEventListener("click", () => p.configure());
document
  .querySelector("#float")!
  .addEventListener("click", () => p.setMode("floating"));
document
  .querySelector("#dock")!
  .addEventListener("click", () => p.setMode("docked"));
