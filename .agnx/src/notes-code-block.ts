// 场景：Mermaid fence 预览 — language=mermaid 时用 contentDOM 管源码；工具条切预览/编辑；普通代码块可一键转 Mermaid。
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import type { NodeViewRendererProps } from "@tiptap/core";
import { common, createLowlight } from "lowlight";
import { NOTES_MERMAID_TEMPLATE, looksLikeMermaidSource } from "./notes-mermaid-template";
import type { NotesMermaidMode, NotesMermaidUiHandle } from "./notes-mermaid-ui";
import { NOTES_MERMAID_UI_HANDLE_KEY } from "./notes-mermaid-ui";
import {
  parseNotesMermaidBlockThemeId,
  parseNotesMermaidFenceLanguage,
  readNotesMermaidBlockThemeFromAttrs,
  resolveMermaidPreviewSurface,
  resolveMermaidThemeConfig,
  resolveNotesMermaidBlockTheme,
  subscribeNotesMermaidTheme,
  type NotesMermaidBlockThemeId,
} from "./notes-mermaid-theme";
import {
  NOTES_CODE_BLOCK_COLLAPSE_LINES,
  attachNotesCodeBlockUiHandle,
  canonicalNotesCodeLanguage,
  countCodeBlockLines,
  isNotesMermaidLanguage,
  normalizeNotesCodeLanguage,
} from "./notes-code-block-ui";

const lowlight = createLowlight(common);

export { NOTES_MERMAID_TEMPLATE, looksLikeMermaidSource };

function attachNotesMermaidUiHandle(dom: HTMLElement, handle: NotesMermaidUiHandle): void {
  (dom as HTMLElement & { [NOTES_MERMAID_UI_HANDLE_KEY]?: NotesMermaidUiHandle })[
    NOTES_MERMAID_UI_HANDLE_KEY
  ] = handle;
}

let mermaidModulePromise: Promise<typeof import("mermaid")> | null = null;

function loadMermaid() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import("mermaid");
  }
  return mermaidModulePromise;
}

function readCodeBlockAttrs(
  editor: NodeViewRendererProps["editor"],
  getPos: NodeViewRendererProps["getPos"],
  fallback: { language?: unknown; mermaidTheme?: unknown },
): { language?: unknown; mermaidTheme?: unknown } {
  const pos = typeof getPos === "function" ? getPos() : null;
  if (typeof pos === "number" && !editor.isDestroyed) {
    const current = editor.state.doc.nodeAt(pos);
    if (current?.type.name === "codeBlock") {
      return current.attrs;
    }
  }
  return fallback;
}

function createMermaidNodeView(props: NodeViewRendererProps) {
  const { node, editor, getPos } = props;
  const dom = document.createElement("div");
  dom.className = "agnx-notes-mermaid";
  dom.dataset.language = "mermaid";
  dom.dataset.testid = "notes-mermaid-block";

  // 状态仅作无访问提示，不占常驻工具条（操作在选中态右上角 chrome）
  const status = document.createElement("span");
  status.className = "agnx-notes-mermaid-status";
  status.dataset.testid = "notes-mermaid-status";
  status.hidden = true;

  const preview = document.createElement("div");
  preview.className = "agnx-notes-mermaid-preview";
  preview.contentEditable = "false";
  preview.dataset.testid = "notes-mermaid-preview";

  const pre = document.createElement("pre");
  pre.className = "agnx-notes-mermaid-source";
  const code = document.createElement("code");
  code.spellcheck = false;
  pre.appendChild(code);

  dom.appendChild(status);
  dom.appendChild(preview);
  dom.appendChild(pre);

  let mode: NotesMermaidMode = "preview";
  let renderToken = 0;
  let lastRenderedText = node.textContent || "";
  let lastRenderedThemeKey = "";
  let statusText = "";

  const readSource = () => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos === "number" && !editor.isDestroyed) {
      const current = editor.state.doc.nodeAt(pos);
      if (current?.type.name === "codeBlock") {
        return current.textContent || "";
      }
    }
    return code.textContent || "";
  };

  const readBlockTheme = (): NotesMermaidBlockThemeId =>
    readNotesMermaidBlockThemeFromAttrs(readCodeBlockAttrs(editor, getPos, node.attrs));

  const syncThemeDataset = () => {
    const blockTheme = readBlockTheme();
    const preference = resolveNotesMermaidBlockTheme(blockTheme);
    const surface = resolveMermaidPreviewSurface(preference);
    if (blockTheme === "inherit") {
      delete dom.dataset.mermaidTheme;
    } else {
      dom.dataset.mermaidTheme = blockTheme;
    }
    dom.dataset.mermaidSurface = surface.scheme;
    dom.style.backgroundColor = surface.background;
    dom.style.borderColor = surface.border;
    preview.style.backgroundColor = surface.background;
  };

  const setStatus = (text: string) => {
    statusText = text;
    status.textContent = text;
    status.hidden = !text;
  };

  const setMode = (next: NotesMermaidMode) => {
    mode = next;
    dom.dataset.mode = next;
    if (next === "preview") {
      preview.hidden = false;
      void renderPreview();
      return;
    }
    preview.hidden = true;
    setStatus("");
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number" || !editor.isEditable || editor.isDestroyed) {
      return;
    }
    requestAnimationFrame(() => {
      if (mode !== "source" || editor.isDestroyed) {
        return;
      }
      const latestPos = typeof getPos === "function" ? getPos() : pos;
      if (typeof latestPos !== "number") {
        return;
      }
      editor
        .chain()
        .focus()
        .setTextSelection(latestPos + 1)
        .run();
    });
  };

  const renderPreview = async () => {
    if (mode !== "preview") {
      return;
    }
    const token = ++renderToken;
    setStatus("渲染中…");
    preview.replaceChildren();
    const source = readSource().trim();
    lastRenderedText = readSource();
    const blockTheme = readBlockTheme();
    const preference = resolveNotesMermaidBlockTheme(blockTheme);
    lastRenderedThemeKey = `${blockTheme}:${preference}`;
    syncThemeDataset();
    if (!source) {
      setStatus("空图");
      preview.textContent = "（空的 mermaid 源码）";
      return;
    }
    try {
      const mermaidMod = await loadMermaid();
      if (token !== renderToken || mode !== "preview") {
        return;
      }
      const mermaid = mermaidMod.default;
      const themeConfig = resolveMermaidThemeConfig(preference);
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: themeConfig.theme,
        ...(themeConfig.themeVariables ? { themeVariables: themeConfig.themeVariables } : {}),
      });
      const id = `agnx-mermaid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const { svg, bindFunctions } = await mermaid.render(id, source);
      if (token !== renderToken || mode !== "preview") {
        return;
      }
      preview.innerHTML = svg;
      bindFunctions?.(preview);
      setStatus("");
    } catch (error) {
      if (token !== renderToken || mode !== "preview") {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setStatus("渲染失败");
      preview.replaceChildren();
      const err = document.createElement("div");
      err.className = "agnx-notes-mermaid-error";
      err.dataset.testid = "notes-mermaid-error";
      err.textContent = message || "Mermaid 渲染失败";
      preview.appendChild(err);
    }
  };

  const setBlockTheme = (next: NotesMermaidBlockThemeId) => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number" || editor.isDestroyed || !editor.isEditable) {
      return;
    }
    const parsed = parseNotesMermaidBlockThemeId(next);
    editor
      .chain()
      .command(({ tr }) => {
        const current = tr.doc.nodeAt(pos);
        if (!current || current.type.name !== "codeBlock") {
          return false;
        }
        tr.setNodeMarkup(pos, undefined, {
          ...current.attrs,
          language: "mermaid",
          mermaidTheme: parsed === "inherit" ? null : parsed,
        });
        return true;
      })
      .run();
    if (mode === "preview") {
      void renderPreview();
    }
  };

  attachNotesMermaidUiHandle(dom, {
    getMode: () => mode,
    setMode,
    rerender: () => {
      if (mode !== "preview") {
        setMode("preview");
        return;
      }
      void renderPreview();
    },
    getSvgElement: () => preview.querySelector("svg"),
    getStatus: () => statusText,
    getBlockTheme: readBlockTheme,
    setBlockTheme,
  });

  // 点击图表：无拖选文字时才选中块以显示 chrome；不 preventDefault，允许选中 SVG 文字
  const selectSelf = () => {
    if (mode !== "preview") {
      return;
    }
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (
      selection &&
      !selection.isCollapsed &&
      selection.anchorNode &&
      preview.contains(selection.anchorNode)
    ) {
      return;
    }
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number" || editor.isDestroyed) {
      return;
    }
    editor.chain().setNodeSelection(pos).run();
  };
  preview.addEventListener("click", selectSelf);

  const unsubTheme = subscribeNotesMermaidTheme(() => {
    if (mode === "preview" && readBlockTheme() === "inherit") {
      void renderPreview();
    }
  });

  // fence `mermaid theme=x` → 归一到 attrs，避免 language 带空格
  const fence = parseNotesMermaidFenceLanguage(node.attrs.language);
  if (fence.isMermaid && (fence.theme || String(node.attrs.language || "").includes(" "))) {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos === "number" && editor.isEditable && !editor.isDestroyed) {
      const nextTheme = ((): NotesMermaidBlockThemeId => {
        if (typeof node.attrs.mermaidTheme === "string" && node.attrs.mermaidTheme.trim()) {
          return parseNotesMermaidBlockThemeId(node.attrs.mermaidTheme);
        }
        if (fence.theme) {
          return fence.theme;
        }
        return "inherit";
      })();
      queueMicrotask(() => {
        if (editor.isDestroyed) {
          return;
        }
        editor
          .chain()
          .command(({ tr }) => {
            const current = tr.doc.nodeAt(pos);
            if (!current || current.type.name !== "codeBlock") {
              return false;
            }
            if (
              current.attrs.language === "mermaid" &&
              (nextTheme === "inherit"
                ? !current.attrs.mermaidTheme
                : current.attrs.mermaidTheme === nextTheme)
            ) {
              return false;
            }
            tr.setNodeMarkup(pos, undefined, {
              ...current.attrs,
              language: "mermaid",
              mermaidTheme: nextTheme === "inherit" ? null : nextTheme,
            });
            return true;
          })
          .run();
      });
    }
  }

  setMode("preview");

  return {
    dom,
    contentDOM: code,
    update(updated: typeof node) {
      if (updated.type.name !== "codeBlock") {
        return false;
      }
      if (!isNotesMermaidLanguage(updated.attrs.language)) {
        return false;
      }
      const nextText = updated.textContent || "";
      const nextTheme = readNotesMermaidBlockThemeFromAttrs(updated.attrs);
      const preference = resolveNotesMermaidBlockTheme(nextTheme);
      const themeKey = `${nextTheme}:${preference}`;
      if (
        mode === "preview" &&
        (nextText !== lastRenderedText || themeKey !== lastRenderedThemeKey)
      ) {
        void renderPreview();
      } else {
        syncThemeDataset();
      }
      return true;
    },
    destroy() {
      renderToken += 1;
      unsubTheme();
    },
    ignoreMutation: (mutation: MutationRecord | { type: string; target: Node }) => {
      const target = mutation.target;
      if (!(target instanceof Node)) {
        return true;
      }
      if (preview.contains(target) || target === preview || target === status) {
        return true;
      }
      if (mutation.type === "attributes") {
        if (target === dom || target === pre || target === code || target === status) {
          return true;
        }
      }
      return false;
    },
    stopEvent: (event: Event) => {
      const target = event.target as Node | null;
      if (!target) {
        return false;
      }
      // 预览态点击图：让选区落到本块（冒泡到 PM）；仅拦截预览区内拖选干扰
      if (mode === "preview" && preview.contains(target)) {
        return false;
      }
      return false;
    },
  };
}

function createDefaultCodeBlockNodeView(props: NodeViewRendererProps) {
  const { node, editor, getPos } = props;
  const wrap = document.createElement("div");
  wrap.className = "agnx-notes-codeblock-wrap";
  wrap.dataset.testid = "notes-codeblock";

  const toolbar = document.createElement("div");
  toolbar.className = "agnx-notes-codeblock-toolbar";
  toolbar.contentEditable = "false";

  const convertBtn = document.createElement("button");
  convertBtn.type = "button";
  convertBtn.className = "agnx-notes-mermaid-toggle is-primary";
  convertBtn.dataset.testid = "notes-codeblock-to-mermaid";
  convertBtn.textContent = "渲染为 Mermaid";
  convertBtn.hidden = true;
  toolbar.appendChild(convertBtn);

  const body = document.createElement("div");
  body.className = "agnx-notes-codeblock-body";

  const gutter = document.createElement("div");
  gutter.className = "agnx-notes-codeblock-gutter";
  gutter.contentEditable = "false";
  gutter.setAttribute("aria-hidden", "true");
  gutter.dataset.testid = "notes-codeblock-gutter";

  const pre = document.createElement("pre");
  pre.className = "agnx-notes-codeblock-pre";
  const code = document.createElement("code");
  const language = normalizeNotesCodeLanguage(node.attrs.language);
  const highlightLang = canonicalNotesCodeLanguage(language);
  if (highlightLang) {
    code.className = `language-${highlightLang}`;
  }
  if (language) {
    pre.setAttribute("data-language", language);
    wrap.dataset.language = language;
  }
  pre.appendChild(code);

  const fade = document.createElement("div");
  fade.className = "agnx-notes-codeblock-fade";
  fade.contentEditable = "false";
  fade.hidden = true;
  fade.setAttribute("aria-hidden", "true");

  const edgeChip = document.createElement("button");
  edgeChip.type = "button";
  edgeChip.className = "agnx-notes-codeblock-fade-label";
  edgeChip.dataset.testid = "notes-codeblock-expand";
  edgeChip.contentEditable = "false";
  edgeChip.setAttribute("aria-label", "展开代码块");
  fade.appendChild(edgeChip);

  body.appendChild(gutter);
  body.appendChild(pre);
  body.appendChild(fade);

  wrap.appendChild(toolbar);
  wrap.appendChild(body);

  let collapsed = false;
  let wordWrap = false;
  let lineCount = 1;

  const syncGutter = (text: string) => {
    lineCount = countCodeBlockLines(text);
    const next: string[] = [];
    for (let i = 1; i <= lineCount; i += 1) {
      next.push(String(i));
    }
    gutter.textContent = next.join("\n");
    wrap.dataset.lines = String(lineCount);
    return lineCount;
  };

  const syncWordWrapUi = () => {
    wrap.classList.toggle("is-word-wrap", wordWrap);
    wrap.dataset.wordWrap = wordWrap ? "1" : "0";
  };

  const syncCollapseUi = () => {
    const canCollapse = lineCount > NOTES_CODE_BLOCK_COLLAPSE_LINES;
    if (!canCollapse) {
      collapsed = false;
    }
    wrap.classList.toggle("is-collapsed", collapsed);
    wrap.dataset.collapsed = collapsed ? "1" : "0";
    wrap.classList.toggle("has-edge-chip", canCollapse);
    if (!canCollapse) {
      fade.hidden = true;
      edgeChip.hidden = true;
      edgeChip.textContent = "";
      edgeChip.removeAttribute("data-testid");
      return;
    }
    // 折叠：展开胶囊；已展开：底部收起胶囊
    fade.hidden = false;
    edgeChip.hidden = false;
    if (collapsed) {
      const hidden = lineCount - NOTES_CODE_BLOCK_COLLAPSE_LINES;
      edgeChip.textContent = `展开全部 · ${hidden} 行`;
      edgeChip.dataset.testid = "notes-codeblock-expand";
      edgeChip.setAttribute("aria-label", "展开代码块");
      return;
    }
    edgeChip.textContent = "收起";
    edgeChip.dataset.testid = "notes-codeblock-collapse-edge";
    edgeChip.setAttribute("aria-label", "收起代码块");
  };

  const setCollapsed = (next: boolean) => {
    collapsed = next;
    syncCollapseUi();
  };

  const setWordWrap = (next: boolean) => {
    wordWrap = next;
    syncWordWrapUi();
  };

  const refreshFromText = (text: string, lang: string) => {
    syncGutter(text);
    if (lineCount > NOTES_CODE_BLOCK_COLLAPSE_LINES && !wrap.dataset.collapseInit) {
      wrap.dataset.collapseInit = "1";
      collapsed = true;
    }
    syncCollapseUi();
    convertBtn.hidden = isNotesMermaidLanguage(lang) || !looksLikeMermaidSource(text);
  };

  convertBtn.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  convertBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number" || editor.isDestroyed || !editor.isEditable) {
      return;
    }
    editor
      .chain()
      .focus()
      .setNodeSelection(pos)
      .updateAttributes("codeBlock", { language: "mermaid", mermaidTheme: null })
      .run();
  });

  const onEdgeActivate = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    setCollapsed(!collapsed);
  };
  edgeChip.addEventListener("pointerdown", onEdgeActivate, true);
  edgeChip.addEventListener("click", onEdgeActivate, true);

  const onCodeInput = () => {
    refreshFromText(
      code.textContent || "",
      normalizeNotesCodeLanguage(pre.getAttribute("data-language")),
    );
  };
  code.addEventListener("input", onCodeInput);

  attachNotesCodeBlockUiHandle(wrap, {
    isCollapsed: () => collapsed,
    canCollapse: () => lineCount > NOTES_CODE_BLOCK_COLLAPSE_LINES,
    setCollapsed,
    toggleCollapsed: () => setCollapsed(!collapsed),
    getLineCount: () => lineCount,
    isWordWrap: () => wordWrap,
    setWordWrap,
    toggleWordWrap: () => setWordWrap(!wordWrap),
  });

  syncWordWrapUi();
  refreshFromText(node.textContent || "", language);

  return {
    dom: wrap,
    contentDOM: code,
    update(updated: typeof node) {
      if (updated.type.name !== "codeBlock") {
        return false;
      }
      if (isNotesMermaidLanguage(updated.attrs.language)) {
        return false;
      }
      const nextLang = normalizeNotesCodeLanguage(updated.attrs.language);
      const nextHighlightLang = canonicalNotesCodeLanguage(nextLang);
      code.className = nextHighlightLang ? `language-${nextHighlightLang}` : "";
      if (nextLang) {
        pre.setAttribute("data-language", nextLang);
        wrap.dataset.language = nextLang;
      } else {
        pre.removeAttribute("data-language");
        delete wrap.dataset.language;
      }
      refreshFromText(updated.textContent || "", nextLang);
      return true;
    },
    destroy() {
      code.removeEventListener("input", onCodeInput);
      edgeChip.removeEventListener("pointerdown", onEdgeActivate, true);
      edgeChip.removeEventListener("click", onEdgeActivate, true);
    },
    // 折叠只改 wrap class/dataset；若不忽略，PM 会销毁重建 NodeView，又回到默认折叠
    ignoreMutation: (mutation: MutationRecord | { type: string; target: Node }) => {
      const target = mutation.target as Node;
      if (mutation.type === "attributes") {
        // 勿忽略 contentDOM（code）上的属性，避免干扰编辑/高亮
        if (target === code || pre.contains(target)) {
          return false;
        }
        return true;
      }
      if (
        target === fade ||
        fade.contains(target) ||
        target === edgeChip ||
        edgeChip.contains(target) ||
        target === gutter ||
        gutter.contains(target) ||
        target === toolbar ||
        toolbar.contains(target)
      ) {
        return true;
      }
      return false;
    },
    stopEvent: (event: Event) => {
      const target = event.target as Node | null;
      return Boolean(
        target && (toolbar.contains(target) || edgeChip === target || edgeChip.contains(target)),
      );
    },
  };
}

export const NotesCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mermaidTheme: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw =
            element.getAttribute("data-mermaid-theme") ||
            element.closest("[data-mermaid-theme]")?.getAttribute("data-mermaid-theme") ||
            "";
          const parsed = parseNotesMermaidBlockThemeId(raw);
          return parsed === "inherit" ? null : parsed;
        },
        renderHTML: (attributes: { mermaidTheme?: unknown }) => {
          const parsed = parseNotesMermaidBlockThemeId(attributes.mermaidTheme);
          return parsed === "inherit" ? {} : { "data-mermaid-theme": parsed };
        },
      },
    };
  },

  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(
          state: {
            write: (text: string) => void;
            text: (text: string, escape?: boolean) => void;
            ensureNewLine: () => void;
            closeBlock: (node: unknown) => void;
          },
          node: {
            attrs: { language?: unknown; mermaidTheme?: unknown };
            textContent: string;
          },
        ) {
          const fence = parseNotesMermaidFenceLanguage(node.attrs.language);
          const isMermaid = fence.isMermaid || isNotesMermaidLanguage(node.attrs.language);
          let info = "";
          if (isMermaid) {
            const blockTheme = readNotesMermaidBlockThemeFromAttrs(node.attrs);
            info = blockTheme === "inherit" ? "mermaid" : `mermaid theme=${blockTheme}`;
          } else {
            info = typeof node.attrs.language === "string" ? node.attrs.language : "";
          }
          state.write("```" + info + "\n");
          state.text(node.textContent, false);
          state.ensureNewLine();
          state.write("```");
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return (props) => {
      if (isNotesMermaidLanguage(props.node.attrs.language)) {
        return createMermaidNodeView(props);
      }
      return createDefaultCodeBlockNodeView(props);
    };
  },
}).configure({
  lowlight,
});
