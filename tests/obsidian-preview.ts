// Browser-only fixture. The shipped plugin imports real Obsidian instead.
export const Platform = { isMobile: true };
export class MarkdownView {}
export class PluginSettingTab {
  constructor(
    public app: any,
    public plugin: any,
  ) {}
}
export class Plugin {
  app: any;
  async loadData() {
    return { desktop: true };
  }
  async saveData() {}
  addSettingTab() {}
  addCommand() {}
  register() {}
  registerEvent() {}
  addChild() {}
  registerDomEvent(el: any, type: string, fn: any) {
    el.addEventListener(type, fn);
  }
}
export class Component extends Plugin {
  unload() {}
}
export class Notice {
  constructor(message: string) {
    document.querySelector("#result")!.textContent = message;
  }
}
export function getIconIds() {
  return [
    "undo-2",
    "redo-2",
    "link",
    "heading",
    "list-todo",
    "indent",
    "outdent",
    "terminal",
  ];
}
export function setIcon(el: HTMLElement, icon: string) {
  el.textContent =
    (
      {
        "undo-2": "↶",
        "redo-2": "↷",
        link: "↗",
        heading: "H",
        "list-todo": "☑",
        indent: "⇥",
        outdent: "⇤",
        terminal: ">_",
        "arrow-up": "↑",
        "arrow-down": "↓",
        "trash-2": "×",
        minus: "−",
      } as any
    )[icon] ?? "◇";
}
export class Modal {
  contentEl: HTMLElement;
  modalEl: HTMLElement;
  constructor(public app: any) {
    this.modalEl = document.createElement("section");
    this.modalEl.className = "modal";
    this.contentEl = document.createElement("div");
    this.contentEl.className = "modal-content";
    this.modalEl.append(this.contentEl);
  }
  setTitle(text: string) {
    const h = document.createElement("h2");
    h.className = "modal-title";
    h.textContent = text;
    this.modalEl.prepend(h);
  }
  open() {
    const close = document.createElement("button");
    close.className = "modal-close-button";
    close.textContent = "Close";
    close.onclick = () => this.close();
    this.modalEl.prepend(close);
    document.body.append(this.modalEl);
    (this as any).onOpen?.();
  }
  close() {
    this.modalEl.remove();
    (this as any).onClose?.();
  }
  onClose() {}
}
export class FuzzySuggestModal<T> extends Modal {
  setPlaceholder() {}
  open() {
    super.open();
    for (const item of (this as any).getItems()) {
      const b = document.createElement("button");
      b.textContent = (this as any).getItemText(item);
      b.onclick = () => {
        (this as any).onChooseItem(item);
        this.close();
      };
      this.contentEl.append(b);
    }
  }
}
export class Setting {
  settingEl: any;
  control: any;
  name: any;
  desc: any;
  constructor(el: any) {
    this.settingEl = el.createDiv({ cls: "setting-item" });
    const info = this.settingEl.createDiv({ cls: "setting-item-info" });
    this.name = info.createDiv({ cls: "setting-item-name" });
    this.desc = info.createDiv({ cls: "setting-item-description" });
    this.control = this.settingEl.createDiv({ cls: "setting-item-control" });
  }
  setName(s: string) {
    this.name.textContent = s;
    return this;
  }
  setDesc(s: string) {
    this.desc.textContent = s;
    return this;
  }
  addButton(fn: any) {
    return this.add(fn, "button");
  }
  addExtraButton(fn: any) {
    return this.add(fn, "button");
  }
  addToggle(fn: any) {
    return this.add(fn, "checkbox");
  }
  addSlider(fn: any) {
    return this.add(fn, "range");
  }
  add(fn: any, type: string) {
    const e = document.createElement(type === "button" ? "button" : "input");
    if (e instanceof HTMLInputElement) e.type = type;
    this.control.append(e);
    const api: any = {
      setButtonText(s: string) {
        e.textContent = s;
        return api;
      },
      setCta() {
        return api;
      },
      setIcon(s: string) {
        setIcon(e, s);
        return api;
      },
      setTooltip(s: string) {
        e.title = s;
        return api;
      },
      setDisabled(v: boolean) {
        (e as HTMLButtonElement).disabled = v;
        return api;
      },
      onClick(cb: any) {
        e.onclick = cb;
        return api;
      },
      setValue(v: any) {
        (e as HTMLInputElement).value = v;
        (e as HTMLInputElement).checked = !!v;
        return api;
      },
      onChange(cb: any) {
        e.onchange = () =>
          cb(
            type === "checkbox"
              ? (e as HTMLInputElement).checked
              : Number((e as HTMLInputElement).value),
          );
        return api;
      },
      setLimits(a: number, b: number, c: number) {
        Object.assign(e, { min: a, max: b, step: c });
        return api;
      },
      setDynamicTooltip() {
        return api;
      },
    };
    fn(api);
    return this;
  }
}
