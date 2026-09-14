// 场景：普通代码块 chrome/折叠合同 — 语言列表、行数、复制、定位非 mermaid codeBlock。
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

export const NOTES_CODE_BLOCK_COLLAPSE_LINES = 5;

export const NOTES_CODE_BLOCK_LANGUAGES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "", label: "纯文本" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "tsx", label: "TSX" },
  { id: "jsx", label: "JSX" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "ruby", label: "Ruby" },
  { id: "php", label: "PHP" },
  { id: "swift", label: "Swift" },
  { id: "kotlin", label: "Kotlin" },
  { id: "json", label: "JSON" },
  { id: "yaml", label: "YAML" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "scss", label: "SCSS" },
  { id: "bash", label: "Bash" },
  { id: "shell", label: "Shell" },
  { id: "sql", label: "SQL" },
  { id: "markdown", label: "Markdown" },
  { id: "xml", label: "XML" },
  { id: "toml", label: "TOML" },
  { id: "dockerfile", label: "Dockerfile" },
];

/** 把常见别名归一到 lowlight 更稳的 id（展示仍可保留原 attrs）。 */
export function canonicalNotesCodeLanguage(value: unknown): string {
  const raw = normalizeNotesCodeLanguage(value);
  switch (raw) {
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "py":
      return "python";
    case "sh":
      return "bash";
    default:
      return raw;
  }
}

export interface NotesCodeBlockUiHandle {
  isCollapsed: () => boolean;
  canCollapse: () => boolean;
  setCollapsed: (next: boolean) => void;
  toggleCollapsed: () => void;
  getLineCount: () => number;
  isWordWrap: () => boolean;
  setWordWrap: (next: boolean) => void;
  toggleWordWrap: () => void;
}

export const NOTES_CODE_BLOCK_UI_HANDLE_KEY = "__agnxNotesCodeBlockUi";

export function attachNotesCodeBlockUiHandle(
  dom: HTMLElement,
  handle: NotesCodeBlockUiHandle,
): void {
  (dom as HTMLElement & { [NOTES_CODE_BLOCK_UI_HANDLE_KEY]?: NotesCodeBlockUiHandle })[
    NOTES_CODE_BLOCK_UI_HANDLE_KEY
  ] = handle;
}

export function readNotesCodeBlockUiHandle(dom: HTMLElement | null): NotesCodeBlockUiHandle | null {
  if (!dom) {
    return null;
  }
  const handle = (
    dom as HTMLElement & { [NOTES_CODE_BLOCK_UI_HANDLE_KEY]?: NotesCodeBlockUiHandle }
  )[NOTES_CODE_BLOCK_UI_HANDLE_KEY];
  return handle ?? null;
}

export function countCodeBlockLines(text: string): number {
  if (!text) {
    return 1;
  }
  const parts = text.split("\n");
  // 末尾空行仍算一行展示；全空内容显示 1
  return Math.max(1, parts.length);
}

export function normalizeNotesCodeLanguage(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

export function isNotesMermaidLanguage(value: unknown): boolean {
  const raw = normalizeNotesCodeLanguage(value);
  return raw === "mermaid" || raw.startsWith("mermaid ");
}

export async function copyNotesCodeBlockText(text: string): Promise<boolean> {
  const value = text ?? "";
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    if (typeof document === "undefined") {
      return false;
    }
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function updateNotesCodeBlockLanguage(
  editor: Editor,
  pos: number,
  language: string,
): boolean {
  if (editor.isDestroyed || !editor.isEditable) {
    return false;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "codeBlock") {
    return false;
  }
  const next = normalizeNotesCodeLanguage(language);
  if (isNotesMermaidLanguage(next)) {
    // mermaid 走专用 NodeView；经 chrome 切过去也合法
  }
  const current = normalizeNotesCodeLanguage(node.attrs.language);
  if (current === next) {
    return true;
  }
  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          language: next || null,
        });
      }
      return true;
    })
    .run();
}

/** 定位当前选区附近的普通（非 mermaid）代码块。 */
export function findNotesCodeBlockNearSelection(
  editor: Editor,
): { pos: number; language: string; text: string; dom: HTMLElement } | null {
  if (editor.isDestroyed) {
    return null;
  }
  const { selection } = editor.state;
  const resolveAt = (pos: number) => {
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== "codeBlock") {
      return null;
    }
    if (isNotesMermaidLanguage(node.attrs.language)) {
      return null;
    }
    const dom = editor.view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) {
      return null;
    }
    return {
      pos,
      language: normalizeNotesCodeLanguage(node.attrs.language),
      text: node.textContent || "",
      dom,
    };
  };

  if (selection instanceof NodeSelection && selection.node.type.name === "codeBlock") {
    return resolveAt(selection.from);
  }

  const $from = selection.$from;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "codeBlock") {
      return resolveAt($from.before(depth));
    }
  }
  return null;
}
