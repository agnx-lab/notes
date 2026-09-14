// 场景：选中普通代码块后浮动工具条 — 语言 / 复制 / 换行 / 展开收起；底部另有展开/收起胶囊。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- DOM chrome 内联 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ChevronsDownUp, ChevronsUpDown, Code2, Copy, WrapText } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { computeNotesChromeAboveEnd, isNotesTargetInHostView } from "./notes-chrome-position";
import {
  NOTES_CODE_BLOCK_LANGUAGES,
  canonicalNotesCodeLanguage,
  copyNotesCodeBlockText,
  findNotesCodeBlockNearSelection,
  normalizeNotesCodeLanguage,
  readNotesCodeBlockUiHandle,
  updateNotesCodeBlockLanguage,
} from "./notes-code-block-ui";

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

interface CodeChromeState {
  pos: number;
  language: string;
  text: string;
  canCollapse: boolean;
  collapsed: boolean;
  wordWrap: boolean;
}

const CHROME_WIDTH = 320;
const CHROME_HEIGHT = 40;

function languageSelectValue(language: string): string {
  const normalized = normalizeNotesCodeLanguage(language);
  if (NOTES_CODE_BLOCK_LANGUAGES.some((item) => item.id === normalized)) {
    return normalized;
  }
  const canonical = canonicalNotesCodeLanguage(normalized);
  if (NOTES_CODE_BLOCK_LANGUAGES.some((item) => item.id === canonical)) {
    return canonical;
  }
  return normalized;
}

export function NotesCodeBlockViewContainer(props: {
  editor: Editor | null;
  scrollHost: HTMLElement | null;
}) {
  const { theme } = useUnistyles();
  const editor = props.editor;
  const host = props.scrollHost;
  const [state, setState] = useState<CodeChromeState | null>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const copyHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!host) {
      return;
    }
    applyChromeTheme(host, theme.colors);
  }, [host, theme.colors]);

  useEffect(() => {
    return () => {
      if (copyHintTimer.current) {
        clearTimeout(copyHintTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !host) {
      setState(null);
      return;
    }

    const sync = () => {
      const found = findNotesCodeBlockNearSelection(editor);
      if (!found || !host.contains(found.dom)) {
        setState(null);
        return;
      }
      const hostRect = host.getBoundingClientRect();
      const rect = found.dom.getBoundingClientRect();
      if (!isNotesTargetInHostView(hostRect, rect)) {
        setState(null);
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
      const ui = readNotesCodeBlockUiHandle(found.dom);
      const next: CodeChromeState = {
        pos: found.pos,
        language: found.language,
        text: found.text,
        canCollapse: ui?.canCollapse() ?? false,
        collapsed: ui?.isCollapsed() ?? false,
        wordWrap: ui?.isWordWrap() ?? false,
      };
      setState((prev) => {
        if (
          prev &&
          prev.pos === next.pos &&
          prev.language === next.language &&
          prev.text === next.text &&
          prev.canCollapse === next.canCollapse &&
          prev.collapsed === next.collapsed &&
          prev.wordWrap === next.wordWrap
        ) {
          return prev;
        }
        return next;
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

  const onLanguageChange = useCallback(
    (language: string) => {
      if (!editor || !state) {
        return;
      }
      if (updateNotesCodeBlockLanguage(editor, state.pos, language)) {
        setState((prev) =>
          prev ? { ...prev, language: normalizeNotesCodeLanguage(language) } : prev,
        );
      }
    },
    [editor, state],
  );

  const onCopy = useCallback(() => {
    if (!state) {
      return;
    }
    void (async () => {
      const ok = await copyNotesCodeBlockText(state.text);
      setCopyHint(ok ? "已复制" : "复制失败");
      if (copyHintTimer.current) {
        clearTimeout(copyHintTimer.current);
      }
      copyHintTimer.current = setTimeout(() => {
        setCopyHint(null);
        copyHintTimer.current = null;
      }, 1200);
    })();
  }, [state]);

  const onToggleCollapse = useCallback(() => {
    if (!editor || !state) {
      return;
    }
    const found = findNotesCodeBlockNearSelection(editor);
    const ui = readNotesCodeBlockUiHandle(found?.dom ?? null);
    if (!ui?.canCollapse()) {
      return;
    }
    ui.toggleCollapsed();
    setState((prev) =>
      prev
        ? {
            ...prev,
            collapsed: ui.isCollapsed(),
            canCollapse: ui.canCollapse(),
          }
        : prev,
    );
  }, [editor, state]);

  const onToggleWordWrap = useCallback(() => {
    if (!editor || !state) {
      return;
    }
    const found = findNotesCodeBlockNearSelection(editor);
    const ui = readNotesCodeBlockUiHandle(found?.dom ?? null);
    if (!ui) {
      return;
    }
    ui.toggleWordWrap();
    setState((prev) => (prev ? { ...prev, wordWrap: ui.isWordWrap() } : prev));
  }, [editor, state]);

  if (!state || !editor) {
    return null;
  }

  const accent = theme.colors.accent;
  const muted = theme.colors.foregroundMuted;
  const editable = editor.isEditable;
  const selectValue = languageSelectValue(state.language);
  const known = NOTES_CODE_BLOCK_LANGUAGES.some((item) => item.id === selectValue);
  const CollapseIcon = state.collapsed ? ChevronsUpDown : ChevronsDownUp;
  const wrapColor = state.wordWrap ? accent : muted;

  return createElement(
    "div",
    { className: "agnx-notes-codeblock-chrome", "data-testid": "notes-codeblock-chrome" },
    createElement(
      "div",
      {
        ref: (node: HTMLDivElement | null) => {
          floatingRef.current = node;
          if (node) {
            applyChromeTheme(node, theme.colors);
          }
        },
        className: "agnx-notes-codeblock-view",
        "data-testid": "notes-codeblock-align-chrome",
        style: {
          top: `${Math.round(pos.top)}px`,
          right: `${Math.round(pos.right)}px`,
          left: "auto",
        },
      },
      createElement(
        "div",
        {
          className: "agnx-notes-mermaid-pill agnx-notes-codeblock-edit",
          role: "toolbar",
          "aria-label": "代码块工具",
        },
        createElement(Code2, { size: 14, color: accent }),
        createElement(
          "label",
          { className: "agnx-notes-codeblock-lang-label" },
          createElement(
            "select",
            {
              className: "agnx-notes-codeblock-lang-select",
              "data-testid": "notes-codeblock-language",
              value: selectValue,
              disabled: !editable,
              title: "语法语言",
              "aria-label": "语法语言",
              onChange: (event: { target: { value: string } }) => {
                onLanguageChange(event.target.value);
              },
            },
            ...NOTES_CODE_BLOCK_LANGUAGES.map((item) =>
              createElement("option", { key: item.id || "plain", value: item.id }, item.label),
            ),
            !known && selectValue
              ? createElement(
                  "option",
                  { key: `custom-${selectValue}`, value: selectValue },
                  selectValue,
                )
              : null,
          ),
        ),
        createElement("span", { className: "agnx-notes-codeblock-sep", "aria-hidden": true }),
        createElement(
          "button",
          {
            type: "button",
            className: "agnx-notes-mermaid-chrome-btn",
            title: copyHint ?? "复制代码",
            "aria-label": copyHint ?? "复制代码",
            "data-testid": "notes-codeblock-copy",
            onMouseDown: (event: { preventDefault: () => void }) => {
              event.preventDefault();
            },
            onClick: onCopy,
          },
          createElement(Copy, { size: 14, color: muted }),
          createElement(
            "span",
            { className: "agnx-notes-mermaid-chrome-label" },
            copyHint ?? "复制",
          ),
        ),
        createElement(
          "button",
          {
            type: "button",
            className: `agnx-notes-mermaid-chrome-btn${state.wordWrap ? " is-active" : ""}`,
            title: state.wordWrap ? "关闭自动换行" : "自动换行",
            "aria-label": state.wordWrap ? "关闭自动换行" : "自动换行",
            "aria-pressed": state.wordWrap,
            "data-testid": "notes-codeblock-word-wrap",
            onMouseDown: (event: { preventDefault: () => void }) => {
              event.preventDefault();
            },
            onClick: onToggleWordWrap,
          },
          createElement(WrapText, { size: 14, color: wrapColor }),
          createElement(
            "span",
            { className: "agnx-notes-mermaid-chrome-label" },
            state.wordWrap ? "换行" : "不换行",
          ),
        ),
        state.canCollapse
          ? createElement(
              "button",
              {
                type: "button",
                className: "agnx-notes-mermaid-chrome-btn",
                title: state.collapsed ? "展开全部" : "收起",
                "aria-label": state.collapsed ? "展开全部" : "收起",
                "data-testid": "notes-codeblock-collapse-toggle",
                onMouseDown: (event: { preventDefault: () => void }) => {
                  event.preventDefault();
                },
                onClick: onToggleCollapse,
              },
              createElement(CollapseIcon, { size: 14, color: muted }),
              createElement(
                "span",
                { className: "agnx-notes-mermaid-chrome-label" },
                state.collapsed ? "展开" : "收起",
              ),
            )
          : null,
      ),
    ),
  );
}
