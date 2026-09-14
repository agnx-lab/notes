// 场景：编辑器滚动容器样式不变量 — 防止 fold rail 再次弄丢 overflow-y。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("notes editor scroll contract", () => {
  it("keeps overflow-y auto on .agnx-notes-tiptap", () => {
    const css = readFileSync(resolve(__dirname, "editor-styles.ts"), "utf8");
    expect(css).toMatch(/\.agnx-notes-tiptap\s*\{[^}]*overflow-y:\s*auto/s);
    expect(css).not.toMatch(/agnx-notes-shell/);
  });

  it("keeps fold rail as absolute overlay not flex sibling scroll trap", () => {
    const css = readFileSync(resolve(__dirname, "editor-styles.ts"), "utf8");
    expect(css).toMatch(/\.agnx-notes-fold-rail\s*\{[^}]*position:\s*absolute/s);
    const tip = readFileSync(resolve(__dirname, "tiptap-editor.tsx"), "utf8");
    expect(tip).toMatch(/overflowY:\s*"auto"/);
    expect(tip).not.toMatch(/agnx-notes-shell/);
  });

  it("binds scroll memory on rich editor host", () => {
    const tip = readFileSync(resolve(__dirname, "tiptap-editor.tsx"), "utf8");
    expect(tip).toMatch(/bindNoteScrollMemory\(host,\s*props\.noteId,\s*"rich"\)/);
  });
});
