// 场景：表格单元格高亮 + 点左缘选整行 / 点上缘选整列（避开列宽拖拽热区）。
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { CellSelection, TableMap } from "@tiptap/pm/tables";

export const NOTES_TABLE_CELL_FOCUS_CLASS = "agnx-notes-table-cell-focus";

const pluginKey = new PluginKey("agnxNotesTableCellFocus");

/** 与 prosemirror-tables columnResizing handleWidth 对齐，避免抢拖拽。 */
export const NOTES_TABLE_RESIZE_ZONE_PX = 6;
/** 首列左侧选行热区（可覆盖 resize 区；非首列左缘留给拖拽）。 */
export const NOTES_TABLE_ROW_GUTTER_PX = 14;
/** 上缘选列热区（左右两侧 resize 区除外）。 */
export const NOTES_TABLE_COL_GUTTER_PX = 10;

function cellPosFromResolved($pos: {
  depth: number;
  node: (depth: number) => { type: { name: string }; nodeSize: number };
  before: (depth: number) => number;
}): number | null {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const name = $pos.node(depth).type.name;
    if (name === "tableCell" || name === "tableHeader") {
      return $pos.before(depth);
    }
  }
  return null;
}

function resolveCellPosFromDom(view: EditorView, cellEl: HTMLElement): number | null {
  try {
    const inside = view.posAtDOM(cellEl, 0);
    if (inside < 0) {
      return null;
    }
    return cellPosFromResolved(view.state.doc.resolve(inside));
  } catch {
    return null;
  }
}

function isFirstColumnCell(view: EditorView, cellPos: number): boolean {
  const $cell = view.state.doc.resolve(cellPos);
  let tableDepth = -1;
  for (let depth = $cell.depth; depth > 0; depth -= 1) {
    if ($cell.node(depth).type.name === "table") {
      tableDepth = depth;
      break;
    }
  }
  if (tableDepth < 0) {
    return false;
  }
  const table = $cell.node(tableDepth);
  const tableStart = $cell.start(tableDepth);
  const map = TableMap.get(table);
  const rel = cellPos - tableStart;
  try {
    return map.findCell(rel).left === 0;
  } catch {
    return false;
  }
}

function buildCellFocusDecorations(doc: import("@tiptap/pm/model").Node, selection: unknown) {
  const decos: Decoration[] = [];
  if (selection instanceof CellSelection) {
    selection.forEachCell((node, pos) => {
      decos.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: NOTES_TABLE_CELL_FOCUS_CLASS,
        }),
      );
    });
    return DecorationSet.create(doc, decos);
  }
  const sel = selection as { $from: Parameters<typeof cellPosFromResolved>[0] };
  const cellPos = cellPosFromResolved(sel.$from);
  if (cellPos == null) {
    return DecorationSet.empty;
  }
  const cell = doc.nodeAt(cellPos);
  if (!cell || (cell.type.name !== "tableCell" && cell.type.name !== "tableHeader")) {
    return DecorationSet.empty;
  }
  return DecorationSet.create(doc, [
    Decoration.node(cellPos, cellPos + cell.nodeSize, {
      class: NOTES_TABLE_CELL_FOCUS_CLASS,
    }),
  ]);
}

function trySelectRowOrColumn(view: EditorView, event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }
  const target = event.target as HTMLElement | null;
  const cellEl = target?.closest?.("td, th") as HTMLElement | null;
  if (!cellEl || !view.dom.contains(cellEl)) {
    return false;
  }
  const rect = cellEl.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const width = rect.width;

  // 列分割线拖拽热区：交给 columnResizing，不抢 mousedown
  if (x >= width - NOTES_TABLE_RESIZE_ZONE_PX) {
    return false;
  }
  const cellPos = resolveCellPosFromDom(view, cellEl);
  if (cellPos == null) {
    return false;
  }
  if (x <= NOTES_TABLE_RESIZE_ZONE_PX && !isFirstColumnCell(view, cellPos)) {
    return false;
  }

  const selectRow = x <= NOTES_TABLE_ROW_GUTTER_PX;
  const selectCol =
    y <= NOTES_TABLE_COL_GUTTER_PX &&
    x > NOTES_TABLE_ROW_GUTTER_PX &&
    x < width - NOTES_TABLE_RESIZE_ZONE_PX;
  if (!selectRow && !selectCol) {
    return false;
  }
  const $cell = view.state.doc.resolve(cellPos);
  const next = selectRow ? CellSelection.rowSelection($cell) : CellSelection.colSelection($cell);
  view.dispatch(view.state.tr.setSelection(next).scrollIntoView());
  event.preventDefault();
  return true;
}

function trySelectCellOnDoubleClick(view: EditorView, event: MouseEvent): boolean {
  const target = event.target as HTMLElement | null;
  const cellEl = target?.closest?.("td, th") as HTMLElement | null;
  if (!cellEl || !view.dom.contains(cellEl)) {
    return false;
  }
  const rect = cellEl.getBoundingClientRect();
  const x = event.clientX - rect.left;
  if (x <= NOTES_TABLE_RESIZE_ZONE_PX || x >= rect.width - NOTES_TABLE_RESIZE_ZONE_PX) {
    return false;
  }
  const cellPos = resolveCellPosFromDom(view, cellEl);
  if (cellPos == null) {
    return false;
  }
  view.dispatch(
    view.state.tr.setSelection(CellSelection.create(view.state.doc, cellPos)).scrollIntoView(),
  );
  event.preventDefault();
  return true;
}

export function createNotesTableCellFocusExtension() {
  return Extension.create({
    name: "agnxNotesTableCellFocus",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: pluginKey,
          state: {
            init: (_, state) => buildCellFocusDecorations(state.doc, state.selection),
            apply: (tr, old, _oldState, newState) => {
              if (tr.docChanged || tr.selectionSet) {
                return buildCellFocusDecorations(newState.doc, newState.selection);
              }
              return old;
            },
          },
          props: {
            decorations(state) {
              return pluginKey.getState(state);
            },
            handleDOMEvents: {
              mousedown(view, event) {
                return trySelectRowOrColumn(view, event as MouseEvent);
              },
              dblclick(view, event) {
                return trySelectCellOnDoubleClick(view, event as MouseEvent);
              },
            },
          },
        }),
      ];
    },
  });
}
