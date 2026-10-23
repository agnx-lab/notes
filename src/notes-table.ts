// 场景：TipTap Table 扩展 — align / tableId 持久化到 data-*；缺 id 时自动补。
import { Table } from "@tiptap/extension-table";
import { Fragment } from "@tiptap/pm/model";
import { Plugin, PluginKey, NodeSelection } from "@tiptap/pm/state";
import { getHTMLFromFragment, type Editor } from "@tiptap/core";
import { parseNotesMediaAlign, type NotesMediaAlign } from "./notes-media-align";
import { NotesTableView } from "./notes-table-view";
import { createNotesTableCellFocusExtension } from "./notes-table-cell-focus";

export function createNotesTableId(): string {
  return `tbl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const ensureTableIdKey = new PluginKey("agnxNotesEnsureTableId");

/** 更新表格块对齐；按文档 pos 写 attrs（TableView 会同步到 DOM）。 */
export function updateTableAlign(editor: Editor, pos: number, align: NotesMediaAlign): boolean {
  if (editor.isDestroyed || !editor.isEditable) {
    return false;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "table") {
    return false;
  }
  const next = parseNotesMediaAlign(align);
  if (parseNotesMediaAlign(node.attrs.align) === next) {
    syncTableAlignDomAt(editor, pos, next);
    return true;
  }
  const ok = editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          align: next,
        });
      }
      return true;
    })
    .run();
  if (ok) {
    queueMicrotask(() => syncTableAlignDomAt(editor, pos, next));
  }
  return ok;
}

/** 把 data-align 同步到指定表格 DOM（TableView 本应负责；此函数作兜底）。 */
export function syncTableAlignDomAt(editor: Editor, pos: number, align: NotesMediaAlign): void {
  const dom = editor.view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) {
    return;
  }
  const table =
    (dom.matches?.("table") ? dom : null) ||
    (dom.querySelector?.("table") as HTMLElement | null) ||
    null;
  const wrapper =
    (dom.classList?.contains("tableWrapper") ? dom : null) ||
    (table?.closest?.(".tableWrapper") as HTMLElement | null) ||
    null;
  const value = parseNotesMediaAlign(align);
  for (const el of [table, wrapper]) {
    if (!el) {
      continue;
    }
    if (value === "left") {
      el.removeAttribute("data-align");
    } else {
      el.setAttribute("data-align", value);
    }
  }
}

/** @deprecated 优先用 syncTableAlignDomAt；保留给旧调用。 */
export function syncTableAlignDom(editor: Editor, align: NotesMediaAlign): void {
  const found = findNotesTableNearSelection(editor);
  if (!found) {
    return;
  }
  syncTableAlignDomAt(editor, found.pos, align);
}

/** 从当前选区定位表格节点（单元格内 / NodeSelection 均可）。 */
export function findNotesTableNearSelection(
  editor: Editor,
): { pos: number; align: NotesMediaAlign; tableId: string } | null {
  if (editor.isDestroyed) {
    return null;
  }
  const { selection } = editor.state;
  if (selection instanceof NodeSelection && selection.node.type.name === "table") {
    return {
      pos: selection.from,
      align: parseNotesMediaAlign(selection.node.attrs.align),
      tableId: String(selection.node.attrs.tableId ?? ""),
    };
  }
  const $from = selection.$from;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "table") {
      return {
        pos: $from.before(depth),
        align: parseNotesMediaAlign(node.attrs.align),
        tableId: String(node.attrs.tableId ?? ""),
      };
    }
  }
  return null;
}

export const NotesTable = Table.extend({
  name: "table",

  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "left",
        parseHTML: (element: HTMLElement) =>
          parseNotesMediaAlign(element.getAttribute("data-align") || element.dataset.align),
        renderHTML: (attributes: { align?: unknown }) => {
          const align = parseNotesMediaAlign(attributes.align);
          return align === "left" ? {} : { "data-align": align };
        },
      },
      tableId: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const id = element.getAttribute("data-table-id") || element.dataset.tableId || "";
          return id.trim() || null;
        },
        renderHTML: (attributes: { tableId?: unknown }) => {
          const id = typeof attributes.tableId === "string" ? attributes.tableId.trim() : "";
          return id ? { "data-table-id": id } : {};
        },
      },
    };
  },

  addExtensions() {
    return [createNotesTableCellFocusExtension()];
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        key: ensureTableIdKey,
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }
          let tr = newState.tr;
          let modified = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "table") {
              return;
            }
            const id = typeof node.attrs.tableId === "string" ? node.attrs.tableId.trim() : "";
            if (id) {
              return;
            }
            tr = tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              tableId: createNotesTableId(),
              align: parseNotesMediaAlign(node.attrs.align),
            });
            modified = true;
          });
          return modified ? tr : null;
        },
      }),
    ];
  },

  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        // 始终 HTML 序列化，保留 data-align / data-table-id / 单元格 colwidth。
        serialize(
          state: { write: (text: string) => void; closeBlock: (node: unknown) => void },
          node: { type: { schema: Parameters<typeof getHTMLFromFragment>[1] } },
        ) {
          const html = getHTMLFromFragment(Fragment.from(node as never), node.type.schema);
          state.write(html.trim());
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
}).configure({
  resizable: true,
  handleWidth: 6,
  allowTableNodeSelection: true,
  View: NotesTableView,
  HTMLAttributes: { class: "agnx-notes-table" },
});
