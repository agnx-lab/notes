// 场景：TipTap slash 菜单扩展 — 输入 / 插入标题/列表/任务/引用/代码块。
import { Extension } from "@tiptap/core";
import { Suggestion, type SuggestionOptions } from "@tiptap/suggestion";
import type { Editor, Range } from "@tiptap/core";
import { NOTES_MERMAID_TEMPLATE } from "./notes-mermaid-template";

export interface SlashCommandItem {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  command: (props: { editor: Editor; range: Range }) => void;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: "paragraph",
    title: "正文",
    description: "普通段落",
    keywords: ["text", "paragraph", "正文", "p"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    id: "heading1",
    title: "标题 1",
    description: "大标题",
    keywords: ["h1", "heading", "标题"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    id: "heading2",
    title: "标题 2",
    description: "中标题",
    keywords: ["h2", "heading", "标题"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    id: "heading3",
    title: "标题 3",
    description: "小标题",
    keywords: ["h3", "heading", "标题"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    id: "bullet",
    title: "无序列表",
    description: "• 列表",
    keywords: ["ul", "bullet", "list", "列表"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "ordered",
    title: "有序列表",
    description: "1. 列表",
    keywords: ["ol", "ordered", "list", "列表"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "task",
    title: "任务列表",
    description: "可勾选待办",
    keywords: ["todo", "task", "checkbox", "任务"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: "quote",
    title: "引用",
    description: "引用块",
    keywords: ["quote", "blockquote", "引用"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: "code",
    title: "代码块",
    description: "多行代码",
    keywords: ["code", "codeblock", "代码"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    id: "mermaid",
    title: "Mermaid 图",
    description: "流程图 / 时序图预览",
    keywords: ["mermaid", "diagram", "流程图", "时序", "chart"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "codeBlock",
          attrs: { language: "mermaid" },
          content: [{ type: "text", text: NOTES_MERMAID_TEMPLATE }],
        })
        .run();
    },
  },
  {
    id: "hr",
    title: "分隔线",
    description: "水平线",
    keywords: ["hr", "divider", "分隔"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    id: "table",
    title: "表格",
    description: "插入 3×3 表格",
    keywords: ["table", "表格", "grid"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    id: "image",
    title: "图片",
    description: "从本机插入图片",
    keywords: ["image", "img", "图片", "photo", "图"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // 由 createSlashCommandsExtension 注入的回调实际执行选图；此处兜底 no-op。
      void editor;
    },
  },
];

export function buildSlashCommands(options?: {
  onInsertImage?: (editor: Editor) => void;
}): SlashCommandItem[] {
  return SLASH_COMMANDS.map((item) => {
    if (item.id !== "image" || !options?.onInsertImage) {
      return item;
    }
    const onInsertImage = options.onInsertImage;
    return {
      ...item,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onInsertImage(editor);
      },
    };
  });
}

export function filterSlashCommands(
  query: string,
  catalog: SlashCommandItem[] = SLASH_COMMANDS,
): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return catalog;
  }
  return catalog.filter((item) => {
    const hay = [item.title, item.description, item.id, ...item.keywords].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

export interface SlashMenuState {
  open: boolean;
  items: SlashCommandItem[];
  selectedIndex: number;
  clientRect: (() => DOMRect | null) | null;
  command: ((item: SlashCommandItem) => void) | null;
}

export type SlashMenuListener = (state: SlashMenuState) => void;

const EMPTY_SLASH_STATE: SlashMenuState = {
  open: false,
  items: [],
  selectedIndex: 0,
  clientRect: null,
  command: null,
};

export function createSlashCommandsExtension(
  onMenu: SlashMenuListener,
  options?: { onInsertImage?: (editor: Editor) => void },
) {
  const catalog = buildSlashCommands(options);
  return Extension.create({
    name: "agnxSlashCommands",
    addOptions() {
      return {
        suggestion: {
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }: { query: string }) => filterSlashCommands(query, catalog),
          render: () => {
            let latest: SlashMenuState = EMPTY_SLASH_STATE;
            return {
              onStart: (props) => {
                latest = {
                  open: true,
                  items: props.items as SlashCommandItem[],
                  selectedIndex: 0,
                  clientRect: props.clientRect ?? null,
                  command: (item) => {
                    props.command(item);
                  },
                };
                onMenu(latest);
              },
              onUpdate: (props) => {
                latest = {
                  open: true,
                  items: props.items as SlashCommandItem[],
                  selectedIndex: Math.min(
                    latest.selectedIndex,
                    Math.max(0, props.items.length - 1),
                  ),
                  clientRect: props.clientRect ?? null,
                  command: (item) => {
                    props.command(item);
                  },
                };
                onMenu(latest);
              },
              onKeyDown: ({ event }) => {
                if (!latest.open) {
                  return false;
                }
                if (event.key === "ArrowDown") {
                  latest = {
                    ...latest,
                    selectedIndex: (latest.selectedIndex + 1) % Math.max(1, latest.items.length),
                  };
                  onMenu(latest);
                  return true;
                }
                if (event.key === "ArrowUp") {
                  latest = {
                    ...latest,
                    selectedIndex:
                      (latest.selectedIndex - 1 + Math.max(1, latest.items.length)) %
                      Math.max(1, latest.items.length),
                  };
                  onMenu(latest);
                  return true;
                }
                if (event.key === "Enter") {
                  const item = latest.items[latest.selectedIndex];
                  if (item && latest.command) {
                    latest.command(item);
                  }
                  return true;
                }
                if (event.key === "Escape") {
                  onMenu(EMPTY_SLASH_STATE);
                  return true;
                }
                return false;
              },
              onExit: () => {
                latest = EMPTY_SLASH_STATE;
                onMenu(EMPTY_SLASH_STATE);
              },
            };
          },
          command: ({ editor, range, props }) => {
            const item = props as SlashCommandItem;
            item.command({ editor, range });
          },
        } satisfies Partial<SuggestionOptions>,
      };
    },
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ];
    },
  });
}
