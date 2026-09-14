// 场景：笔记编辑 ActionBar 动作表 — 顶栏左格式 / 底栏右状态，同源 id 供 entity-menu 投影。
import {
  ALargeSmall,
  Bold,
  CheckSquare,
  ChevronsDownUp,
  Code,
  Code2,
  FileDown,
  History,
  Italic,
  List,
  ListOrdered,
  ListTree,
  Mic,
  Minus,
  Paperclip,
  Redo2,
  Rows3,
  Space,
  StretchHorizontal,
  Palette,
  Table,
  Type,
  Underline,
  Undo2,
  WrapText,
  type LucideIcon,
} from "lucide-react-native";

/** 编辑 chrome 实体菜单家族（非 segmentId）。 */
export const NOTES_EDITOR_CHROME_MENU_ID = "editor-chrome";

export const NOTES_EDITOR_CHROME_SURFACE = {
  left: "left",
  right: "right",
} as const;

export type NotesEditorChromeSurfaceId =
  (typeof NOTES_EDITOR_CHROME_SURFACE)[keyof typeof NOTES_EDITOR_CHROME_SURFACE];

/** 右组（底栏右对齐）：排版 + 源码/换行/折叠/大纲/版本/导出。 */
export const NOTES_EDITOR_RIGHT_ACTION_IDS = [
  "fontSize",
  "lineHeight",
  "paragraphSpacing",
  "pageWidth",
  "markdownTheme",
  "toggleSource",
  "toggleWordWrap",
  "toggleFoldAll",
  "toggleOutline",
  "toggleVersions",
  "exportMarkdown",
] as const;

export type NotesEditorRightActionId = (typeof NOTES_EDITOR_RIGHT_ACTION_IDS)[number];

export const NOTES_EDITOR_RIGHT_ACTION_LABELS: Record<NotesEditorRightActionId, string> = {
  fontSize: "字号",
  lineHeight: "行间距",
  paragraphSpacing: "段落间距",
  pageWidth: "页面宽度",
  markdownTheme: "主题",
  toggleSource: "富文本/源码",
  toggleWordWrap: "换行",
  toggleFoldAll: "全部折叠",
  toggleOutline: "大纲",
  toggleVersions: "版本",
  exportMarkdown: "导出 MD",
};

export const NOTES_EDITOR_RIGHT_ACTION_ICONS: Record<NotesEditorRightActionId, LucideIcon> = {
  fontSize: ALargeSmall,
  lineHeight: Rows3,
  paragraphSpacing: Space,
  pageWidth: StretchHorizontal,
  markdownTheme: Palette,
  toggleSource: Code2,
  toggleWordWrap: WrapText,
  toggleFoldAll: ChevronsDownUp,
  toggleOutline: ListTree,
  toggleVersions: History,
  exportMarkdown: FileDown,
};

/** 左组：Apple Notes 风格格式工具（骨架；下轮接 TipTap）。 */
export const NOTES_EDITOR_LEFT_ACTION_IDS = [
  "dictation",
  "addFile",
  "bold",
  "textStyle",
  "underline",
  "italic",
  "inlineCode",
  "horizontalRule",
  "tableOrLines",
  "bulletList",
  "orderedList",
  "checklist",
  "undo",
  "redo",
] as const;

export type NotesEditorLeftActionId = (typeof NOTES_EDITOR_LEFT_ACTION_IDS)[number];

export const NOTES_EDITOR_LEFT_ACTION_LABELS: Record<NotesEditorLeftActionId, string> = {
  dictation: "听写",
  addFile: "添加文件",
  bold: "粗体",
  textStyle: "正文样式",
  underline: "下划线",
  italic: "斜体",
  inlineCode: "行内代码",
  horizontalRule: "分割线",
  tableOrLines: "表格",
  bulletList: "项目符号",
  orderedList: "编号列表",
  checklist: "待办",
  undo: "撤销",
  redo: "重做",
};

export const NOTES_EDITOR_LEFT_ACTION_ICONS: Record<NotesEditorLeftActionId, LucideIcon> = {
  dictation: Mic,
  addFile: Paperclip,
  bold: Bold,
  textStyle: Type,
  underline: Underline,
  italic: Italic,
  inlineCode: Code,
  horizontalRule: Minus,
  tableOrLines: Table,
  bulletList: List,
  orderedList: ListOrdered,
  checklist: CheckSquare,
  undo: Undo2,
  redo: Redo2,
};

export function resolveRightActionLabel(
  id: NotesEditorRightActionId,
  state: {
    editorMode: "rich" | "source";
    wordWrap: boolean;
    foldAllActive: boolean;
  },
): string {
  switch (id) {
    case "toggleSource":
      return state.editorMode === "source" ? "源码" : "富文本";
    case "toggleWordWrap":
      return state.wordWrap ? "换行" : "不换行";
    case "toggleFoldAll":
      return state.foldAllActive ? "全部展开" : "全部折叠";
    default:
      return NOTES_EDITOR_RIGHT_ACTION_LABELS[id];
  }
}
