// 场景：表格当前列文本对齐 — 写入单元格 textAlign attrs，整列同步。
import type { Editor } from "@tiptap/core";
import { CellSelection, TableMap, cellAround } from "@tiptap/pm/tables";
import { parseNotesMediaAlign, type NotesMediaAlign } from "./notes-media-align";

export const NOTES_TABLE_BLOCK_ALIGN_LABELS: Record<NotesMediaAlign, string> = {
  left: "表格左对齐",
  center: "表格居中",
  right: "表格右对齐",
};

export const NOTES_TABLE_COLUMN_ALIGN_LABELS: Record<NotesMediaAlign, string> = {
  left: "列左对齐",
  center: "列居中",
  right: "列右对齐",
};

function findCellNearSelection(
  editor: Editor,
): { pos: number; node: import("@tiptap/pm/model").Node } | null {
  if (editor.isDestroyed) {
    return null;
  }
  const { selection } = editor.state;
  if (selection instanceof CellSelection) {
    const $cell = selection.$anchorCell;
    const node = $cell.nodeAfter;
    if (!node) {
      return null;
    }
    return { pos: $cell.pos, node };
  }
  const $cell = cellAround(selection.$from);
  if (!$cell) {
    return null;
  }
  const node = $cell.nodeAfter;
  if (!node) {
    return null;
  }
  return { pos: $cell.pos, node };
}

/** 读当前焦点单元格的列文本对齐（默认 left）。 */
export function readFocusedColumnTextAlign(editor: Editor): NotesMediaAlign | null {
  const found = findCellNearSelection(editor);
  if (!found) {
    return null;
  }
  return parseNotesMediaAlign(found.node.attrs.textAlign);
}

/** 将当前列所有单元格的 textAlign 设为同一值。 */
export function updateCurrentColumnTextAlign(editor: Editor, align: NotesMediaAlign): boolean {
  if (editor.isDestroyed || !editor.isEditable) {
    return false;
  }
  const found = findCellNearSelection(editor);
  if (!found) {
    return false;
  }
  const $at = editor.state.doc.resolve(found.pos);
  let tableDepth = -1;
  for (let depth = $at.depth; depth > 0; depth -= 1) {
    if ($at.node(depth).type.name === "table") {
      tableDepth = depth;
      break;
    }
  }
  if (tableDepth < 0) {
    return false;
  }
  const table = $at.node(tableDepth);
  const tableStart = $at.start(tableDepth);
  const map = TableMap.get(table);
  const cellRel = found.pos - tableStart;
  if (cellRel < 0 || cellRel >= table.content.size) {
    return false;
  }
  let rect: { left: number; right: number; top: number; bottom: number };
  try {
    rect = map.findCell(cellRel);
  } catch {
    return false;
  }
  const next = parseNotesMediaAlign(align);
  let tr = editor.state.tr;
  let changed = false;
  for (let row = 0; row < map.height; row += 1) {
    const cellPos = tableStart + map.positionAt(row, rect.left, table);
    const cell = tr.doc.nodeAt(cellPos);
    if (!cell || (cell.type.name !== "tableCell" && cell.type.name !== "tableHeader")) {
      continue;
    }
    if (parseNotesMediaAlign(cell.attrs.textAlign) === next) {
      continue;
    }
    tr = tr.setNodeMarkup(cellPos, undefined, {
      ...cell.attrs,
      textAlign: next,
    });
    changed = true;
  }
  if (changed) {
    editor.view.dispatch(tr);
  }
  return true;
}
