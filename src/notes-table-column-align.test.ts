// 场景：列对齐标签与 helper 合同；单元格 textAlign 经 HTML 往返。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TableRow } from "@tiptap/extension-table-row";
import { JSDOM } from "jsdom";
import { NotesTable } from "./notes-table";
import {
  NotesTableCell,
  NotesTableHeader,
  renderNotesTableCellExtraAttrs,
} from "./notes-table-cell";
import {
  NOTES_TABLE_BLOCK_ALIGN_LABELS,
  NOTES_TABLE_COLUMN_ALIGN_LABELS,
} from "./notes-table-column-align";

function installDom(): HTMLElement {
  const dom = new JSDOM("<!doctype html><html><body><div id='e'></div></body></html>", {
    pretendToBeVisual: true,
  });
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    DocumentFragment: window.DocumentFragment,
    Node: window.Node,
    Element: window.Element,
    innerHeight: 800,
    innerWidth: 1200,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number,
  });
  return window.document.getElementById("e")!;
}

describe("notes table column align", () => {
  it("工具条文案区分表格对齐与列对齐", () => {
    expect(NOTES_TABLE_BLOCK_ALIGN_LABELS.center).toBe("表格居中");
    expect(NOTES_TABLE_BLOCK_ALIGN_LABELS.left).toBe("表格左对齐");
    expect(NOTES_TABLE_COLUMN_ALIGN_LABELS.center).toBe("列居中");
    const chrome = readFileSync(resolve(__dirname, "table-view-container.tsx"), "utf8");
    expect(chrome).toMatch(/notes-table-column-align-cycle/);
    expect(chrome).toMatch(/NOTES_TABLE_BLOCK_ALIGN_LABELS/);
  });

  it("render 合并 width 与 text-align", () => {
    expect(renderNotesTableCellExtraAttrs({ colwidth: [120], textAlign: "center" })).toMatchObject({
      "data-colwidth": "120",
      "data-text-align": "center",
      style: "width: 120px; text-align: center",
    });
  });

  it("HTML 解析保留 data-text-align", () => {
    const el = installDom();
    const editor = new Editor({
      element: el,
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        NotesTable,
        TableRow,
        NotesTableHeader,
        NotesTableCell,
      ],
      content: `<table class="agnx-notes-table"><tr><th data-text-align="center">A</th><th>B</th></tr><tr><td data-text-align="center">1</td><td>2</td></tr></table>`,
    });
    const aligns: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
        aligns.push(String(node.attrs.textAlign ?? ""));
      }
    });
    expect(aligns).toEqual(["center", "left", "center", "left"]);
    const html = editor.getHTML();
    expect(html).toContain('data-text-align="center"');
    editor.destroy();
  });
});
