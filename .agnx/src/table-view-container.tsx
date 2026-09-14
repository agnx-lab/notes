// 场景：选中表格后浮动工具条 — 表格块对齐 + 列文本对齐 + 增删行列。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- DOM chrome 内联 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { AlignCenter, AlignLeft, AlignRight, Columns3, Plus, Rows3 } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { cycleNotesMediaAlign, type NotesMediaAlign } from "./notes-media-align";
import { findNotesTableNearSelection, updateTableAlign } from "./notes-table";
import {
  NOTES_TABLE_BLOCK_ALIGN_LABELS,
  NOTES_TABLE_COLUMN_ALIGN_LABELS,
  readFocusedColumnTextAlign,
  updateCurrentColumnTextAlign,
} from "./notes-table-column-align";
import { computeNotesChromeAboveEnd, isNotesTargetInHostView } from "./notes-chrome-position";

function applyNotesTableChromeThemeVars(
  el: HTMLElement,
  colors: {
    popover: string;
    border: string;
    foreground: string;
    foregroundMuted: string;
    accent: string;
    input: string;
  },
) {
  el.style.setProperty("--agnx-notes-chip-bg", colors.popover);
  el.style.setProperty("--agnx-notes-chip-input", colors.input);
  el.style.setProperty("--agnx-notes-chip-border", colors.border);
  el.style.setProperty("--agnx-notes-chip-fg", colors.foreground);
  el.style.setProperty("--agnx-notes-chip-muted", colors.foregroundMuted);
  el.style.setProperty("--agnx-notes-link-accent", colors.accent);
}

interface TableChromeState {
  pos: number;
  align: NotesMediaAlign;
  columnAlign: NotesMediaAlign;
  tableId: string;
}

const ALIGN_ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
} as const;

const CHROME_WIDTH_ESTIMATE = 560;
const CHROME_HEIGHT_ESTIMATE = 44;

export function NotesTableViewContainer(props: {
  editor: Editor | null;
  scrollHost: HTMLElement | null;
}) {
  const { theme } = useUnistyles();
  const editor = props.editor;
  const host = props.scrollHost;
  const [state, setState] = useState<TableChromeState | null>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const floatingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!host) {
      return;
    }
    applyNotesTableChromeThemeVars(host, theme.colors);
  }, [host, theme.colors]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !host) {
      setState(null);
      return;
    }

    const syncFromSelection = () => {
      const found = findNotesTableNearSelection(editor);
      if (!found) {
        setState(null);
        return;
      }
      const dom = editor.view.nodeDOM(found.pos);
      let target: HTMLElement | null = null;
      if (dom instanceof HTMLElement) {
        target =
          (dom.closest?.(".tableWrapper") as HTMLElement | null) ||
          (dom.classList?.contains("tableWrapper") ? dom : null) ||
          (dom.matches?.("table") ? dom : (dom.querySelector?.("table") as HTMLElement | null)) ||
          dom;
      }
      if (!target || !host.contains(target)) {
        setState(null);
        return;
      }
      const hostRect = host.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      if (!isNotesTargetInHostView(hostRect, rect)) {
        setState(null);
        return;
      }
      const chromeWidth = floatingRef.current?.offsetWidth || CHROME_WIDTH_ESTIMATE;
      const chromeHeight = floatingRef.current?.offsetHeight || CHROME_HEIGHT_ESTIMATE;
      const nextPos = computeNotesChromeAboveEnd({
        host: hostRect,
        target: rect,
        chromeWidth,
        chromeHeight,
        gap: 8,
      });
      setPos(nextPos);
      const columnAlign = readFocusedColumnTextAlign(editor) ?? "left";
      setState((prev) => {
        if (
          prev &&
          prev.pos === found.pos &&
          prev.align === found.align &&
          prev.columnAlign === columnAlign &&
          prev.tableId === found.tableId
        ) {
          return prev;
        }
        return {
          pos: found.pos,
          align: found.align,
          columnAlign,
          tableId: found.tableId,
        };
      });
    };

    syncFromSelection();
    editor.on("selectionUpdate", syncFromSelection);
    editor.on("transaction", syncFromSelection);
    host.addEventListener("scroll", syncFromSelection, { passive: true });
    return () => {
      editor.off("selectionUpdate", syncFromSelection);
      editor.off("transaction", syncFromSelection);
      host.removeEventListener("scroll", syncFromSelection);
    };
  }, [editor, host]);

  const applyAlign = useCallback(
    (align: NotesMediaAlign) => {
      if (!editor || !state || !editor.isEditable) {
        return;
      }
      const found = findNotesTableNearSelection(editor);
      const tablePos = found?.pos ?? state.pos;
      if (updateTableAlign(editor, tablePos, align)) {
        setState((prev) =>
          prev
            ? {
                ...prev,
                pos: tablePos,
                align,
                tableId: found?.tableId ?? prev.tableId,
              }
            : prev,
        );
      }
    },
    [editor, state],
  );

  const applyColumnAlign = useCallback(
    (align: NotesMediaAlign) => {
      if (!editor || !editor.isEditable) {
        return;
      }
      if (updateCurrentColumnTextAlign(editor, align)) {
        setState((prev) => (prev ? { ...prev, columnAlign: align } : prev));
      }
    },
    [editor],
  );

  const runTableCommand = useCallback(
    (command: "addColumnAfter" | "addRowAfter" | "deleteColumn" | "deleteRow") => {
      if (!editor || !editor.isEditable) {
        return;
      }
      const chain = editor.chain().focus();
      switch (command) {
        case "addColumnAfter":
          chain.addColumnAfter().run();
          break;
        case "addRowAfter":
          chain.addRowAfter().run();
          break;
        case "deleteColumn":
          chain.deleteColumn().run();
          break;
        case "deleteRow":
          chain.deleteRow().run();
          break;
        default:
          break;
      }
    },
    [editor],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!editor.isEditable || !editor.isActive("table")) {
        return;
      }
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }
      const selection = editor.state.selection;
      if (!(selection instanceof CellSelection)) {
        return;
      }
      if (selection.isColSelection()) {
        event.preventDefault();
        event.stopPropagation();
        editor.chain().focus().deleteColumn().run();
        return;
      }
      if (selection.isRowSelection()) {
        event.preventDefault();
        event.stopPropagation();
        editor.chain().focus().deleteRow().run();
      }
    };
    editor.view.dom.addEventListener("keydown", onKeyDown);
    return () => {
      editor.view.dom.removeEventListener("keydown", onKeyDown);
    };
  }, [editor]);

  if (!state || !editor) {
    return null;
  }

  const BlockAlignIcon = ALIGN_ICONS[state.align];
  const ColumnAlignIcon = ALIGN_ICONS[state.columnAlign];
  const blockAlignLabel = NOTES_TABLE_BLOCK_ALIGN_LABELS[state.align];
  const columnAlignLabel = NOTES_TABLE_COLUMN_ALIGN_LABELS[state.columnAlign];
  const muted = theme.colors.foregroundMuted;
  const accent = theme.colors.accent;
  const editable = editor.isEditable;

  const textBtn = (
    testId: string,
    label: string,
    onClick: () => void,
    icon: ReturnType<typeof createElement>,
    active?: boolean,
  ) =>
    createElement(
      "button",
      {
        type: "button",
        className: `agnx-notes-mermaid-chrome-btn${active ? " is-active" : ""}`,
        title: label,
        "aria-label": label,
        "data-testid": testId,
        disabled: !editable,
        onMouseDown: (event: { preventDefault: () => void }) => {
          event.preventDefault();
        },
        onClick,
      },
      icon,
      createElement("span", { className: "agnx-notes-mermaid-chrome-label" }, label),
    );

  return createElement(
    "div",
    { className: "agnx-notes-table-chrome", "data-testid": "notes-table-chrome" },
    createElement(
      "div",
      {
        ref: (node: HTMLDivElement | null) => {
          floatingRef.current = node;
          if (node) {
            applyNotesTableChromeThemeVars(node, theme.colors);
          }
        },
        className: "agnx-notes-table-view",
        "data-testid": "notes-table-align-chrome",
        style: {
          top: `${Math.round(pos.top)}px`,
          right: `${Math.round(pos.right)}px`,
          left: "auto",
        },
      },
      createElement(
        "div",
        {
          className: "agnx-notes-mermaid-pill agnx-notes-table-edit",
          role: "toolbar",
          "aria-label": "表格工具",
        },
        textBtn(
          "notes-table-align-cycle",
          blockAlignLabel,
          () => applyAlign(cycleNotesMediaAlign(state.align)),
          createElement(BlockAlignIcon, { size: 14, color: accent }),
          true,
        ),
        textBtn(
          "notes-table-column-align-cycle",
          columnAlignLabel,
          () => applyColumnAlign(cycleNotesMediaAlign(state.columnAlign)),
          createElement(ColumnAlignIcon, { size: 14, color: accent }),
          true,
        ),
        textBtn(
          "notes-table-add-column",
          "加列",
          () => runTableCommand("addColumnAfter"),
          createElement(Plus, { size: 14, color: muted }),
        ),
        textBtn(
          "notes-table-add-row",
          "加行",
          () => runTableCommand("addRowAfter"),
          createElement(Plus, { size: 14, color: muted }),
        ),
        textBtn(
          "notes-table-delete-column",
          "删列",
          () => runTableCommand("deleteColumn"),
          createElement(Columns3, { size: 14, color: theme.colors.destructive || muted }),
        ),
        textBtn(
          "notes-table-delete-row",
          "删行",
          () => runTableCommand("deleteRow"),
          createElement(Rows3, { size: 14, color: theme.colors.destructive || muted }),
        ),
      ),
    ),
  );
}
