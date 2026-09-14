// 场景：选中 Mermaid 块后图表外侧右上角胶囊 — 下载/复制/主题/源码/全屏。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- DOM chrome 内联 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { Code2, Copy, Download, Eye, Maximize2, Palette } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { NotesMermaidLightbox } from "./mermaid-lightbox";
import { NOTES_TYPOGRAPHY_OUTSIDE_IGNORE } from "./notes-anchored-popover";
import { isNotesMermaidLanguage } from "./notes-code-block-ui";
import { NotesFloatingSelectMenu } from "./notes-floating-select";
import {
  NOTES_MERMAID_BLOCK_THEME_OPTIONS,
  type NotesMermaidBlockThemeId,
} from "./notes-mermaid-theme";
import {
  copyMermaidSvg,
  downloadMermaidSvg,
  readNotesMermaidUiHandle,
  type NotesMermaidMode,
} from "./notes-mermaid-ui";
import { computeNotesChromeAboveEnd, isNotesTargetInHostView } from "./notes-chrome-position";

function applyChromeTheme(
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

function findMermaidNearSelection(
  editor: Editor,
): { pos: number; dom: HTMLElement; mode: NotesMermaidMode } | null {
  if (editor.isDestroyed) {
    return null;
  }
  const { selection } = editor.state;
  let pos: number | null = null;
  if (selection instanceof NodeSelection && selection.node.type.name === "codeBlock") {
    if (isNotesMermaidLanguage(selection.node.attrs.language)) {
      pos = selection.from;
    }
  } else {
    const $from = selection.$from;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name === "codeBlock" && isNotesMermaidLanguage(node.attrs.language)) {
        pos = $from.before(depth);
        break;
      }
    }
  }
  if (pos == null) {
    return null;
  }
  const raw = editor.view.nodeDOM(pos);
  let dom: HTMLElement | null = null;
  if (raw instanceof HTMLElement) {
    if (raw.classList.contains("agnx-notes-mermaid")) {
      dom = raw;
    } else {
      dom = raw.closest(".agnx-notes-mermaid");
    }
  }
  if (!dom) {
    return null;
  }
  const handle = readNotesMermaidUiHandle(dom);
  return {
    pos,
    dom,
    mode: handle?.getMode() ?? (dom.dataset.mode === "source" ? "source" : "preview"),
  };
}

const CHROME_WIDTH = 420;
const CHROME_HEIGHT = 36;
const THEME_TRIGGER_TEST_ID = "notes-mermaid-theme";

export function NotesMermaidViewContainer(props: {
  editor: Editor | null;
  scrollHost: HTMLElement | null;
}) {
  const { theme } = useUnistyles();
  const editor = props.editor;
  const host = props.scrollHost;
  const [state, setState] = useState<{
    pos: number;
    mode: NotesMermaidMode;
    blockTheme: NotesMermaidBlockThemeId;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [lightboxSvg, setLightboxSvg] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const domRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!host) {
      return;
    }
    applyChromeTheme(host, theme.colors);
  }, [host, theme.colors]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !host) {
      setState(null);
      setThemeMenuOpen(false);
      domRef.current = null;
      return;
    }

    const sync = () => {
      const found = findMermaidNearSelection(editor);
      if (!found || !host.contains(found.dom)) {
        setState(null);
        setThemeMenuOpen(false);
        domRef.current = null;
        return;
      }
      domRef.current = found.dom;
      const hostRect = host.getBoundingClientRect();
      const rect = found.dom.getBoundingClientRect();
      if (!isNotesTargetInHostView(hostRect, rect)) {
        setState(null);
        setThemeMenuOpen(false);
        return;
      }
      const width = floatingRef.current?.offsetWidth || CHROME_WIDTH;
      const height = floatingRef.current?.offsetHeight || CHROME_HEIGHT;
      setPos(
        computeNotesChromeAboveEnd({
          host: hostRect,
          target: rect,
          chromeWidth: width,
          chromeHeight: height,
          gap: 8,
        }),
      );
      const blockTheme = readNotesMermaidUiHandle(found.dom)?.getBlockTheme() ?? "inherit";
      setState((prev) => {
        if (
          prev &&
          prev.pos === found.pos &&
          prev.mode === found.mode &&
          prev.blockTheme === blockTheme
        ) {
          return prev;
        }
        return { pos: found.pos, mode: found.mode, blockTheme };
      });
    };

    sync();
    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    host.addEventListener("scroll", sync, { passive: true });
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
      host.removeEventListener("scroll", sync);
    };
  }, [editor, host]);

  const withHandle = useCallback(
    (run: (handle: NonNullable<ReturnType<typeof readNotesMermaidUiHandle>>) => void) => {
      const handle = readNotesMermaidUiHandle(domRef.current);
      if (!handle) {
        return;
      }
      run(handle);
    },
    [],
  );

  const setMode = useCallback(
    (mode: NotesMermaidMode) => {
      withHandle((handle) => {
        handle.setMode(mode);
        setState((prev) => (prev ? { ...prev, mode } : prev));
      });
    },
    [withHandle],
  );

  const lightboxEl = lightboxSvg
    ? createElement(NotesMermaidLightbox, {
        svgMarkup: lightboxSvg,
        onClose: () => setLightboxSvg(null),
      })
    : null;

  const themeMenu = state
    ? createElement(NotesFloatingSelectMenu, {
        open: themeMenuOpen,
        options: NOTES_MERMAID_BLOCK_THEME_OPTIONS,
        value: state.blockTheme,
        onSelect: (id: string) => {
          const next = id as NotesMermaidBlockThemeId;
          withHandle((handle) => {
            handle.setBlockTheme(next);
            setState((prev) => (prev ? { ...prev, blockTheme: next } : prev));
          });
        },
        onClose: () => setThemeMenuOpen(false),
        anchorTestIds: [THEME_TRIGGER_TEST_ID],
        placement: "below",
        testID: "notes-mermaid-theme-menu",
        optionTestIdPrefix: "notes-mermaid-block-theme",
        title: "主题",
      })
    : null;

  if (!state || !editor) {
    return lightboxEl;
  }

  const muted = theme.colors.foregroundMuted;
  const accent = theme.colors.accent;
  const isSource = state.mode === "source";

  const textBtn = (
    testId: string,
    label: string,
    onClick: () => void,
    icon: ReturnType<typeof createElement>,
    active?: boolean,
    extraAttrs?: Record<string, string>,
  ) =>
    createElement(
      "button",
      {
        type: "button",
        className: `agnx-notes-mermaid-chrome-btn${active ? " is-active" : ""}`,
        title: label,
        "aria-label": label,
        "data-testid": testId,
        onMouseDown: (event: { preventDefault: () => void }) => {
          event.preventDefault();
        },
        onClick,
        ...extraAttrs,
      },
      icon,
      createElement("span", { className: "agnx-notes-mermaid-chrome-label" }, label),
    );

  return createElement(
    "div",
    { className: "agnx-notes-mermaid-chrome", "data-testid": "notes-mermaid-chrome" },
    createElement(
      "div",
      {
        ref: (node: HTMLDivElement | null) => {
          floatingRef.current = node;
          if (node) {
            applyChromeTheme(node, theme.colors);
          }
        },
        className: "agnx-notes-mermaid-view",
        style: {
          top: `${Math.round(pos.top)}px`,
          right: `${Math.round(pos.right)}px`,
          left: "auto",
        },
      },
      createElement(
        "div",
        {
          className: "agnx-notes-mermaid-pill",
          role: "toolbar",
          "aria-label": "Mermaid 图表操作",
        },
        textBtn(
          "notes-mermaid-download",
          "下载图片",
          () => {
            withHandle((handle) => {
              const svg = handle.getSvgElement();
              if (!svg) {
                setToast("请先预览图再下载");
                return;
              }
              void downloadMermaidSvg(svg).then((ok) => {
                setToast(ok ? "已下载 PNG" : "下载失败（无法栅格化）");
                return undefined;
              });
            });
          },
          createElement(Download, { size: 14, color: muted }),
        ),
        textBtn(
          "notes-mermaid-copy",
          "复制图片",
          () => {
            withHandle((handle) => {
              const svg = handle.getSvgElement();
              if (!svg) {
                setToast("请先预览图再复制");
                return;
              }
              void copyMermaidSvg(svg).then((ok) => {
                setToast(ok ? "已复制图片" : "复制失败（请先预览图）");
                return undefined;
              });
            });
          },
          createElement(Copy, { size: 14, color: muted }),
        ),
        textBtn(
          THEME_TRIGGER_TEST_ID,
          "主题",
          () => setThemeMenuOpen((open) => !open),
          createElement(Palette, { size: 14, color: themeMenuOpen ? accent : muted }),
          themeMenuOpen,
          { [NOTES_TYPOGRAPHY_OUTSIDE_IGNORE]: "1" },
        ),
        textBtn(
          isSource ? "notes-mermaid-preview-btn" : "notes-mermaid-edit-btn",
          isSource ? "预览图" : "查看代码",
          () => setMode(isSource ? "preview" : "source"),
          isSource
            ? createElement(Eye, { size: 14, color: accent })
            : createElement(Code2, { size: 14, color: muted }),
          // 仅源码态常亮；预览态只靠 :hover，禁止永久 is-active
          isSource,
        ),
        textBtn(
          "notes-mermaid-fullscreen",
          "全屏",
          () => {
            withHandle((handle) => {
              const open = () => {
                const svg = readNotesMermaidUiHandle(domRef.current)?.getSvgElement();
                if (!svg) {
                  setToast("请先预览图再全屏");
                  return;
                }
                setLightboxSvg(svg.outerHTML);
              };
              if (handle.getMode() !== "preview") {
                handle.setMode("preview");
                setState((prev) => (prev ? { ...prev, mode: "preview" } : prev));
                window.setTimeout(open, 120);
                return;
              }
              open();
            });
          },
          createElement(Maximize2, { size: 14, color: muted }),
        ),
      ),
      toast
        ? createElement("div", { className: "agnx-notes-mermaid-toast", role: "status" }, toast)
        : null,
    ),
    themeMenu,
    lightboxEl,
  );
}
