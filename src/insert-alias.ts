import type { Editor, EditorPosition } from "obsidian";

interface PendingAlias {
  alias: string;
  start: EditorPosition;
}

export const INVALID_ALIAS_MESSAGE =
  "toolbar+: an alias must be a single line and cannot contain ]].";

export class InsertAliasController {
  private readonly pending = new WeakMap<Editor, PendingAlias>();

  insert(editor: Editor): boolean {
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

  onEditorChange(editor: Editor): void {
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
      if (
        cursor.line !== start.line ||
        cursor.ch < targetStart ||
        cursor.ch > targetEnd
      ) {
        this.pending.delete(editor);
      }
      return;
    }

    const originalEnd = start.ch + link[0].length;
    const completedTargetEnd = start.ch + 2 + body.length;
    if (
      body.length === 0 ||
      body.includes("|") ||
      cursor.line !== start.line ||
      cursor.ch < completedTargetEnd
    ) {
      this.pending.delete(editor);
      return;
    }

    // Some autocomplete paths replace the complete wikilink. Restore only the
    // alias created by this command, then end the short-lived tracking session.
    this.pending.delete(editor);
    const closingBrackets = { line: start.line, ch: originalEnd - 2 };
    editor.replaceRange(aliasSuffix, closingBrackets);
    editor.setCursor({
      line: start.line,
      ch: originalEnd + aliasSuffix.length,
    });
  }
}
