// 场景：表格单元格装饰高亮与点左缘选行合同。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("notes table cell focus", () => {
  const src = readFileSync(resolve(__dirname, "notes-table-cell-focus.ts"), "utf8");
  const tip = readFileSync(resolve(__dirname, "tiptap-editor.tsx"), "utf8");
  const css = readFileSync(resolve(__dirname, "editor-styles.ts"), "utf8");

  it("经 NotesTable.addExtensions 注册装饰扩展", () => {
    expect(tip).toMatch(/NotesTable/);
    const table = readFileSync(resolve(__dirname, "notes-table.ts"), "utf8");
    expect(table).toMatch(/createNotesTableCellFocusExtension/);
    expect(src).toMatch(/Decoration\.node/);
    expect(src).toMatch(/CellSelection\.rowSelection/);
    expect(src).toMatch(/CellSelection\.colSelection/);
  });

  it("避开列宽拖拽热区，并抬高 resize 手柄可视层级", () => {
    expect(src).toMatch(/NOTES_TABLE_RESIZE_ZONE_PX/);
    expect(src).toMatch(/isFirstColumnCell/);
    expect(src).toMatch(/x >= width - NOTES_TABLE_RESIZE_ZONE_PX/);
    expect(css).toMatch(/column-resize-handle/);
    expect(css).toMatch(/z-index:\s*6/);
    expect(css).toMatch(/resize-cursor/);
  });
});
