// 场景：源码面合同 — CodeMirror Markdown 高亮；禁止再退回 horizontal ScrollView。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("notes source editor scroll/highlight contract", () => {
  const src = readFileSync(resolve(__dirname, "source-editor.tsx"), "utf8");
  const css = readFileSync(resolve(__dirname, "editor-styles.ts"), "utf8");

  it("does not use horizontal={!wrap} ScrollView", () => {
    expect(src).not.toMatch(/horizontal=\{\s*!wrap\s*\}/);
  });

  it("web path uses CodeMirror markdown highlighting", () => {
    expect(src).toMatch(/@codemirror\/lang-markdown/);
    expect(src).toMatch(/EditorView/);
    expect(src).toMatch(/notesMarkdownHighlight|HighlightStyle/);
  });

  it("dims markdown punctuation via highlight style", () => {
    expect(src).toMatch(/tags\.punctuation/);
    expect(src).toMatch(/rgba\(160,\s*160,\s*160/);
  });

  it("cm host fills height", () => {
    expect(css).toMatch(/\.agnx-notes-cm\s*\{[^}]*height:\s*100%/s);
  });

  it("toggles lineWrapping via Compartment", () => {
    expect(src).toMatch(/Compartment/);
    expect(src).toMatch(/EditorView\.lineWrapping/);
    expect(src).toMatch(/reconfigure/);
  });
});
