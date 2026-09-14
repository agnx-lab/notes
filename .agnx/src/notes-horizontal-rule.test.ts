// 场景：分割线可选中 + 蓝色选中框合同。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("notes horizontal rule selection", () => {
  it("扩展可选中并接入 TipTap", () => {
    const hr = readFileSync(resolve(__dirname, "notes-horizontal-rule.ts"), "utf8");
    const tip = readFileSync(resolve(__dirname, "tiptap-editor.tsx"), "utf8");
    const css = readFileSync(resolve(__dirname, "editor-styles.ts"), "utf8");
    expect(hr).toMatch(/agnx-notes-hr-wrap/);
    expect(hr).toMatch(/selectable:\s*true/);
    expect(tip).toMatch(/NotesHorizontalRule/);
    expect(tip).toMatch(/horizontalRule:\s*false/);
    expect(css).toMatch(/agnx-notes-hr-wrap\.ProseMirror-selectednode/);
    expect(css).toMatch(/#6aa8ff/);
  });
});
