// 场景：SideMenu 合同 — 折叠手柄接入 TipTap；六点拖动手柄已移除。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("notes side menu plane contract", () => {
  const side = readFileSync(resolve(__dirname, "side-menu.ts"), "utf8");
  const tip = readFileSync(resolve(__dirname, "tiptap-editor.tsx"), "utf8");
  const css = readFileSync(resolve(__dirname, "editor-styles.ts"), "utf8");

  it("creates fold-only side menu DOM ids", () => {
    expect(side).toMatch(/editor-side-menu/);
    expect(side).toMatch(/fold-handle/);
    expect(side).toMatch(/createNotesSideMenuExtension/);
    expect(side).not.toMatch(/id = "drag-handle"/);
  });

  it("wires side menu + fold gutter into tip tap (block/bubble menus removed)", () => {
    expect(tip).toMatch(/createNotesSideMenuExtension/);
    expect(tip).toMatch(/NotesFoldGutter/);
    expect(tip).not.toMatch(/NotesBlockMenu/);
    expect(tip).not.toMatch(/NotesBubbleMenu/);
  });

  it("styles side menu + fold handle", () => {
    expect(css).toMatch(/agnx-notes-side-menu/);
    expect(css).toMatch(/agnx-notes-fold-handle/);
  });
});
