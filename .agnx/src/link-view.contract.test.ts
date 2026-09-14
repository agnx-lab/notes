// 场景：链接路径条合同 — 点击打开编辑输入；无 URL 预览打开页。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("notes link path chrome", () => {
  const tip = readFileSync(resolve(__dirname, "tiptap-editor.tsx"), "utf8");
  const container = readFileSync(resolve(__dirname, "link-view-container.tsx"), "utf8");
  const edit = readFileSync(resolve(__dirname, "link-edit-view.tsx"), "utf8");
  const css = readFileSync(resolve(__dirname, "editor-styles.ts"), "utf8");

  it("wires LinkViewContainer：点击打开路径编辑条", () => {
    expect(tip).toMatch(/NotesLinkViewContainer/);
    expect(container).toMatch(/addEventListener\("click"/);
    expect(container).toMatch(/pointerdown/);
    expect(container).toMatch(/NotesLinkEditView/);
    expect(container).not.toMatch(/NotesLinkPreview/);
    expect(container).not.toMatch(/mouseover/);
  });

  it("edit view：输入框可改路径；按钮开 Browser Tab；可取消链接", () => {
    expect(edit).toMatch(/addMark/);
    expect(edit).toMatch(/removeMark/);
    expect(edit).toMatch(/onBlur/);
    expect(edit).toMatch(/notes-link-unlink/);
    expect(edit).toMatch(/notes-link-open-browser/);
    expect(edit).toMatch(/openNotesLinkHref/);
  });

  it("uses theme CSS variables for chip and link accent/hover", () => {
    expect(css).toMatch(/--agnx-notes-chip-bg/);
    expect(css).toMatch(/var\(--agnx-notes-chip-bg/);
    expect(css).toMatch(/--agnx-notes-link-accent-hover/);
    expect(css).toMatch(/\.agnx-notes-tiptap \.ProseMirror a\.agnx-notes-link:hover/);
  });
});
