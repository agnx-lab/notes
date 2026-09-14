// 场景：代码块 UI 合同 — 行数、折叠阈值、语言列表、chrome 接入。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  NOTES_CODE_BLOCK_COLLAPSE_LINES,
  NOTES_CODE_BLOCK_LANGUAGES,
  countCodeBlockLines,
  normalizeNotesCodeLanguage,
} from "./notes-code-block-ui";

describe("notes code block ui", () => {
  it("折叠阈值为 5 行且语言表非空", () => {
    expect(NOTES_CODE_BLOCK_COLLAPSE_LINES).toBe(5);
    expect(NOTES_CODE_BLOCK_LANGUAGES.length).toBeGreaterThan(8);
    expect(NOTES_CODE_BLOCK_LANGUAGES.some((item) => item.id === "typescript")).toBe(true);
  });

  it("countCodeBlockLines 按换行计数", () => {
    expect(countCodeBlockLines("")).toBe(1);
    expect(countCodeBlockLines("a")).toBe(1);
    expect(countCodeBlockLines("a\nb\nc")).toBe(3);
  });

  it("normalize 语言小写", () => {
    expect(normalizeNotesCodeLanguage("TypeScript")).toBe("typescript");
    expect(normalizeNotesCodeLanguage("  ")).toBe("");
  });

  it("NodeView / chrome / 样式已接入", () => {
    const block = readFileSync(resolve(__dirname, "notes-code-block.ts"), "utf8");
    const tip = readFileSync(resolve(__dirname, "tiptap-editor.tsx"), "utf8");
    const css = readFileSync(resolve(__dirname, "editor-styles.ts"), "utf8");
    expect(block).toMatch(/agnx-notes-codeblock-gutter/);
    expect(block).toMatch(/ignoreMutation/);
    expect(block).toMatch(/agnx-notes-codeblock-fade/);
    expect(block).toMatch(/NOTES_CODE_BLOCK_COLLAPSE_LINES/);
    expect(tip).toMatch(/NotesCodeBlockViewContainer/);
    expect(css).toMatch(/is-collapsed/);
    expect(css).toMatch(/is-word-wrap/);
    expect(css).toMatch(/notes-codeblock-fade/);
    expect(css).toMatch(/:not\(\.has-edge-chip\)/);
    expect(css).toMatch(/attachment-name/);
    expect(css).toMatch(/--agnx-notes-fg/);
    expect(block).toMatch(/notes-codeblock-collapse-edge/);
    expect(block).toMatch(/toggleWordWrap/);
    expect(css).not.toMatch(/agnx-notes-codeblock-expand \{/);
  });
});
