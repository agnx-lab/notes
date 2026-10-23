// 场景：笔记左组格式工具 — TipTap 命令与 active/disabled 投影（听写/添加文件仍占位）。
import type { Editor } from "@tiptap/core";
import type { NotesEditorLeftActionId } from "./editor-chrome-actions";

const STUB_LEFT_ACTIONS: ReadonlySet<NotesEditorLeftActionId> = new Set(["dictation"]);

export type NotesTextStyleId = "paragraph" | "h1" | "h2" | "h3";

export const NOTES_TEXT_STYLE_OPTIONS: ReadonlyArray<{
  id: NotesTextStyleId;
  label: string;
}> = [
  { id: "paragraph", label: "正文" },
  { id: "h1", label: "标题 1" },
  { id: "h2", label: "标题 2" },
  { id: "h3", label: "标题 3" },
];

export interface NotesLeftActionUiState {
  active: Partial<Record<NotesEditorLeftActionId, boolean>>;
  disabled: Partial<Record<NotesEditorLeftActionId, boolean>>;
  canUndo: boolean;
  canRedo: boolean;
  /** 当前块级样式（下拉框选中项） */
  textStyleId: NotesTextStyleId;
}

export function emptyNotesLeftActionState(): NotesLeftActionUiState {
  const disabled: Partial<Record<NotesEditorLeftActionId, boolean>> = {
    dictation: true,
    addFile: true,
    bold: true,
    textStyle: true,
    underline: true,
    italic: true,
    inlineCode: true,
    horizontalRule: true,
    tableOrLines: true,
    bulletList: true,
    orderedList: true,
    checklist: true,
    undo: true,
    redo: true,
  };
  return { active: {}, disabled, canUndo: false, canRedo: false, textStyleId: "paragraph" };
}

export function readNotesTextStyle(editor: Editor): NotesTextStyleId {
  if (editor.isActive("heading", { level: 1 })) {
    return "h1";
  }
  if (editor.isActive("heading", { level: 2 })) {
    return "h2";
  }
  if (editor.isActive("heading", { level: 3 })) {
    return "h3";
  }
  return "paragraph";
}

export function notesTextStyleShortLabel(id: NotesTextStyleId): string {
  switch (id) {
    case "h1":
      return "H1";
    case "h2":
      return "H2";
    case "h3":
      return "H3";
    default:
      return "正文";
  }
}

export function applyNotesTextStyle(editor: Editor, id: NotesTextStyleId): boolean {
  if (editor.isDestroyed || !editor.isEditable) {
    return false;
  }
  switch (id) {
    case "h1":
      return editor.chain().focus().setHeading({ level: 1 }).run();
    case "h2":
      return editor.chain().focus().setHeading({ level: 2 }).run();
    case "h3":
      return editor.chain().focus().setHeading({ level: 3 }).run();
    default:
      return editor.chain().focus().setParagraph().run();
  }
}

export function readNotesLeftActionState(editor: Editor | null): NotesLeftActionUiState {
  if (!editor || editor.isDestroyed || !editor.isEditable) {
    return emptyNotesLeftActionState();
  }

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();
  const textStyleId = readNotesTextStyle(editor);

  return {
    canUndo,
    canRedo,
    textStyleId,
    active: {
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      inlineCode: editor.isActive("code"),
      textStyle: textStyleId !== "paragraph",
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      checklist: editor.isActive("taskList"),
      tableOrLines: editor.isActive("table"),
    },
    disabled: {
      dictation: true,
      addFile: false,
      bold: false,
      textStyle: false,
      underline: false,
      italic: false,
      inlineCode: false,
      horizontalRule: false,
      tableOrLines: false,
      bulletList: false,
      orderedList: false,
      checklist: false,
      undo: !canUndo,
      redo: !canRedo,
    },
  };
}

export function runNotesLeftAction(editor: Editor, id: NotesEditorLeftActionId): boolean {
  if (editor.isDestroyed || !editor.isEditable || STUB_LEFT_ACTIONS.has(id)) {
    return false;
  }

  switch (id) {
    case "bold":
      return editor.chain().focus().toggleBold().run();
    case "italic":
      return editor.chain().focus().toggleItalic().run();
    case "underline":
      return editor.chain().focus().toggleUnderline().run();
    case "inlineCode":
      return editor.chain().focus().toggleCode().run();
    case "horizontalRule":
      return editor.chain().focus().setHorizontalRule().run();
    case "textStyle":
      // 顶栏改为下拉选择；保留循环仅作快捷键/兜底
      return applyNotesTextStyle(
        editor,
        (() => {
          const current = readNotesTextStyle(editor);
          if (current === "paragraph") {
            return "h1";
          }
          if (current === "h1") {
            return "h2";
          }
          if (current === "h2") {
            return "h3";
          }
          return "paragraph";
        })(),
      );
    case "bulletList":
      return editor.chain().focus().toggleBulletList().run();
    case "orderedList":
      return editor.chain().focus().toggleOrderedList().run();
    case "checklist":
      return editor.chain().focus().toggleTaskList().run();
    case "tableOrLines":
      if (editor.isActive("table")) {
        return editor.chain().focus().deleteTable().run();
      }
      return editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    case "undo":
      return editor.chain().focus().undo().run();
    case "redo":
      return editor.chain().focus().redo().run();
    default:
      return false;
  }
}

export function isNotesLeftActionStub(id: NotesEditorLeftActionId): boolean {
  return STUB_LEFT_ACTIONS.has(id);
}
