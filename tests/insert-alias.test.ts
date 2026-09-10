import { test } from "node:test";
import assert from "node:assert/strict";
import type { Editor, EditorPosition } from "obsidian";
import { InsertAliasController } from "../src/insert-alias.ts";

class FakeEditor {
  cursor = 0;
  selection: [number, number] = [0, 0];
  value: string;

  constructor(value: string) {
    this.value = value;
  }

  getSelection(): string {
    return this.value.slice(...this.selection);
  }

  getCursor(side?: "from" | "to"): EditorPosition {
    const offset = side === "from" ? this.selection[0] : this.cursor;
    return { line: 0, ch: offset };
  }

  replaceSelection(replacement: string): void {
    const [from, to] = this.selection;
    this.value = this.value.slice(0, from) + replacement + this.value.slice(to);
    this.cursor = from + replacement.length;
    this.selection = [this.cursor, this.cursor];
  }

  replaceRange(replacement: string, from: EditorPosition): void {
    this.value =
      this.value.slice(0, from.ch) + replacement + this.value.slice(from.ch);
    if (this.cursor >= from.ch) this.cursor += replacement.length;
  }

  setCursor(position: EditorPosition): void {
    this.cursor = position.ch;
    this.selection = [this.cursor, this.cursor];
  }

  getLine(): string {
    return this.value;
  }

  lineCount(): number {
    return 1;
  }
}

function asEditor(editor: FakeEditor): Editor {
  return editor as unknown as Editor;
}

test("insert alias wraps the selection and places the caret before the pipe", () => {
  const controller = new InsertAliasController();
  const editor = new FakeEditor("before Display label after");
  editor.selection = [7, 20];

  assert.equal(controller.insert(asEditor(editor)), true);
  assert.equal(editor.value, "before [[|Display label]] after");
  assert.equal(editor.cursor, 9);
});

test("insert alias supports an empty selection", () => {
  const controller = new InsertAliasController();
  const editor = new FakeEditor("text");
  editor.selection = [4, 4];
  editor.cursor = 4;

  assert.equal(controller.insert(asEditor(editor)), true);
  assert.equal(editor.value, "text[[|]]");
  assert.equal(editor.cursor, 6);
});

test("autocomplete fallback restores an alias removed by whole-link replacement", () => {
  const controller = new InsertAliasController();
  const editor = new FakeEditor("Display label");
  editor.selection = [0, editor.value.length];
  controller.insert(asEditor(editor));

  editor.value = "[[Note title]]";
  editor.cursor = editor.value.length;
  editor.selection = [editor.cursor, editor.cursor];
  controller.onEditorChange(asEditor(editor));

  assert.equal(editor.value, "[[Note title|Display label]]");
  assert.equal(editor.cursor, editor.value.length);
});

test("autocomplete fallback also handles a caret left before the closing brackets", () => {
  const controller = new InsertAliasController();
  const editor = new FakeEditor("Label");
  editor.selection = [0, editor.value.length];
  controller.insert(asEditor(editor));

  editor.value = "[[Note]]";
  editor.cursor = "[[Note".length;
  editor.selection = [editor.cursor, editor.cursor];
  controller.onEditorChange(asEditor(editor));

  assert.equal(editor.value, "[[Note|Label]]");
  assert.equal(editor.cursor, editor.value.length);
});

test("typing a link target leaves the remembered alias untouched", () => {
  const controller = new InsertAliasController();
  const editor = new FakeEditor("Label");
  editor.selection = [0, editor.value.length];
  controller.insert(asEditor(editor));

  editor.value = "[[No|Label]]";
  editor.cursor = "[[No".length;
  editor.selection = [editor.cursor, editor.cursor];
  controller.onEditorChange(asEditor(editor));
  assert.equal(editor.value, "[[No|Label]]");
  assert.equal(editor.cursor, "[[No".length);
});

test("native autocomplete that preserves the alias ends tracking", () => {
  const controller = new InsertAliasController();
  const editor = new FakeEditor("Display label");
  editor.selection = [0, editor.value.length];
  controller.insert(asEditor(editor));

  editor.value = "[[Note title|Display label]]";
  editor.cursor = editor.value.length;
  editor.selection = [editor.cursor, editor.cursor];
  controller.onEditorChange(asEditor(editor));

  editor.value = "[[Different note]]";
  editor.cursor = editor.value.length;
  editor.selection = [editor.cursor, editor.cursor];
  controller.onEditorChange(asEditor(editor));
  assert.equal(editor.value, "[[Different note]]");
});

test("invalid aliases do not change the editor", () => {
  const controller = new InsertAliasController();
  for (const value of ["two\nlines", "text ]] close"]) {
    const editor = new FakeEditor(value);
    editor.selection = [0, value.length];
    assert.equal(controller.insert(asEditor(editor)), false);
    assert.equal(editor.value, value);
  }
});
