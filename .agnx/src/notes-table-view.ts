// 场景：TipTap TableView 子类 — 在 create/update 时把 align/tableId/class 写到 DOM（上游 TableView 忽略 attrs）。
import { TableView } from "@tiptap/extension-table";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { parseNotesMediaAlign } from "./notes-media-align";

type TableViewCtor = new (
  node: ProseMirrorNode,
  cellMinWidth: number,
) => TableView & {
  node: ProseMirrorNode;
  dom: HTMLElement;
  table: HTMLTableElement;
  update: (node: ProseMirrorNode) => boolean;
};

const BaseTableView = TableView as unknown as TableViewCtor;

function syncNotesTableDomAttrs(
  wrapper: HTMLElement,
  table: HTMLTableElement,
  node: ProseMirrorNode,
): void {
  table.classList.add("agnx-notes-table");
  const align = parseNotesMediaAlign(node.attrs.align);
  const tableId = typeof node.attrs.tableId === "string" ? node.attrs.tableId.trim() : "";

  if (align === "left") {
    table.removeAttribute("data-align");
    wrapper.removeAttribute("data-align");
  } else {
    table.setAttribute("data-align", align);
    wrapper.setAttribute("data-align", align);
  }

  if (tableId) {
    table.setAttribute("data-table-id", tableId);
  } else {
    table.removeAttribute("data-table-id");
  }
}

/** columnResizing 使用的 View：补齐 attrs → DOM。 */
export class NotesTableView extends BaseTableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    syncNotesTableDomAttrs(this.dom, this.table, node);
    // 上游 TableView 把 update 声明为实例属性；用属性覆盖避免 TS2425
    const baseUpdate = this.update;
    this.update = (next: ProseMirrorNode) => {
      const ok = baseUpdate.call(this, next);
      if (ok) {
        syncNotesTableDomAttrs(this.dom, this.table, next);
      }
      return ok;
    };
  }
}
