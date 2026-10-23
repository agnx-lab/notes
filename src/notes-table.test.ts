// 场景：NotesTable attrs — align/tableId 解析与 colwidth 渲染往返。
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TableRow } from "@tiptap/extension-table-row";
import { JSDOM } from "jsdom";
import { NotesTable, createNotesTableId } from "./notes-table";
import { NotesTableCell, NotesTableHeader } from "./notes-table-cell";
import { cycleNotesMediaAlign, parseNotesMediaAlign } from "./notes-media-align";

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

function createNotesTableEditor(content: string): Editor {
  const el = installDom();
  return new Editor({
    element: el,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      NotesTable,
      TableRow,
      NotesTableHeader,
      NotesTableCell,
    ],
    content,
  });
}

describe("NotesTable attrs", () => {
  it("createNotesTableId 稳定前缀", () => {
    expect(createNotesTableId().startsWith("tbl_")).toBe(true);
  });

  it("插入表格后自动生成 tableId", () => {
    const editor = createNotesTableEditor("<p></p>");
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    let tableId = "";
    let align = "";
    editor.state.doc.descendants((node) => {
      if (node.type.name === "table") {
        tableId = String(node.attrs.tableId ?? "");
        align = String(node.attrs.align ?? "");
      }
    });
    expect(tableId.startsWith("tbl_")).toBe(true);
    expect(parseNotesMediaAlign(align)).toBe("left");
    editor.destroy();
  });

  it("解析 HTML data-align / data-table-id", () => {
    const editor = createNotesTableEditor(
      `<table class="agnx-notes-table" data-align="center" data-table-id="tbl_fixed"><tr><th>A</th></tr><tr><td>1</td></tr></table>`,
    );
    let found = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "table") {
        found = true;
        expect(parseNotesMediaAlign(node.attrs.align)).toBe("center");
        expect(node.attrs.tableId).toBe("tbl_fixed");
      }
    });
    expect(found).toBe(true);
    editor.destroy();
  });

  it("colwidth 经 data-colwidth 往返", () => {
    const editor = createNotesTableEditor(
      `<table class="agnx-notes-table" data-table-id="tbl_w"><tr><th data-colwidth="140" style="width: 140px">A</th><th data-colwidth="90">B</th></tr><tr><td>1</td><td>2</td></tr></table>`,
    );
    const widths: number[][] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "tableHeader" || node.type.name === "tableCell") {
        if (Array.isArray(node.attrs.colwidth)) {
          widths.push(node.attrs.colwidth as number[]);
        }
      }
    });
    expect(widths.some((w) => w[0] === 140)).toBe(true);
    expect(widths.some((w) => w[0] === 90)).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain("data-colwidth");
    expect(html).toContain("140");
    editor.destroy();
  });

  it("对齐循环复用 notes-media-align", () => {
    expect(cycleNotesMediaAlign("left")).toBe("center");
    expect(cycleNotesMediaAlign(cycleNotesMediaAlign("center"))).toBe("left");
  });
});
