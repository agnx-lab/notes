// 场景：源码面 — CodeMirror Markdown 语法高亮（标记变灰、正文可读），对齐参考源码观感。
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  createElement,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { EditorView, keymap, placeholder as cmPlaceholder, lineNumbers } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { lineColumnToOffset, type NotesCaretPos } from "./caret-bridge";
import { ensureNotesEditorStyles } from "./editor-styles";
import { applyNotesProseThemeToHost, getCachedNotesProseTheme } from "./notes-prose-theme";
import {
  getSourceFoldAllState,
  isSourceFoldEffect,
  notesSourceHeadingFoldExtensions,
  toggleSourceFoldAll,
} from "./source-fold";
import { notesSourceHeadingLineSizes } from "./source-heading-sizes";
import {
  enrichClipboardSnapshot,
  runUnifiedSourcePaste,
  shouldHandleUnifiedPaste,
  snapshotClipboardData,
} from "./unified-paste";
import { bindNoteScrollMemory } from "./editor-scroll-memory";

export interface NotesSourceEditorHandle {
  toggleFoldAll: () => { foldedAll: boolean; foldable: number };
  getFoldAllState: () => { foldedAll: boolean; foldable: number };
}

export interface NotesSourceEditorProps {
  noteId?: string;
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  wordWrap: boolean;
  active?: boolean;
  pendingCaret?: NotesCaretPos | null;
  onCaretConsumed?: () => void;
  onCaretReport?: (caret: NotesCaretPos) => void;
  onFoldStateChange?: (state: { foldedAll: boolean; foldable: number }) => void;
}

const isDom =
  typeof document !== "undefined" &&
  typeof (globalThis as { document?: unknown }).document !== "undefined";

function reportCaretFromOffset(value: string, offset: number, report?: (c: NotesCaretPos) => void) {
  if (!report) {
    return;
  }
  const lines = value.slice(0, offset).split("\n");
  report({
    line: Math.max(0, lines.length - 1),
    column: (lines[lines.length - 1] ?? "").length,
  });
}

/** 标记（# ** ` []()）弱化，正文保持可读 — 对标你截图的源码观感。 */
const notesMarkdownHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "600", color: "inherit" },
  { tag: tags.heading1, fontWeight: "700", color: "inherit" },
  { tag: tags.heading2, fontWeight: "650", color: "inherit" },
  { tag: tags.heading3, fontWeight: "600", color: "inherit" },
  { tag: tags.strong, fontWeight: "700", color: "inherit" },
  { tag: tags.emphasis, fontStyle: "italic", color: "inherit" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "inherit" },
  { tag: tags.link, color: "inherit" },
  { tag: tags.url, color: "rgba(160,160,160,0.75)" },
  { tag: tags.monospace, color: "inherit" },
  { tag: tags.processingInstruction, color: "rgba(160,160,160,0.55)" },
  { tag: tags.meta, color: "rgba(160,160,160,0.55)" },
  { tag: tags.punctuation, color: "rgba(160,160,160,0.55)" },
  { tag: tags.contentSeparator, color: "rgba(160,160,160,0.55)" },
]);

const NotesSourceEditorDom = forwardRef<NotesSourceEditorHandle, NotesSourceEditorProps>(
  function NotesSourceEditorDom(props, ref) {
    const { theme } = useUnistyles();
    const wrap = props.wordWrap;
    const wrapCompartmentRef = useRef(new Compartment());
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(props.onChange);
    const onCaretReportRef = useRef(props.onCaretReport);
    const onBlurRef = useRef(props.onBlur);
    const onFoldStateChangeRef = useRef(props.onFoldStateChange);
    const valueRef = useRef(props.value);
    onChangeRef.current = props.onChange;
    onCaretReportRef.current = props.onCaretReport;
    onBlurRef.current = props.onBlur;
    onFoldStateChangeRef.current = props.onFoldStateChange;
    valueRef.current = props.value;

    const { active, pendingCaret, value, onCaretConsumed } = props;

    useImperativeHandle(ref, () => ({
      toggleFoldAll: () => {
        const view = viewRef.current;
        if (!view) {
          return { foldedAll: false, foldable: 0 };
        }
        const next = toggleSourceFoldAll(view);
        onFoldStateChangeRef.current?.(next);
        return next;
      },
      getFoldAllState: () => {
        const view = viewRef.current;
        if (!view) {
          return { foldedAll: false, foldable: 0 };
        }
        return getSourceFoldAllState(view);
      },
    }));

    useEffect(() => {
      ensureNotesEditorStyles();
    }, []);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) {
        return;
      }
      applyNotesProseThemeToHost(host, getCachedNotesProseTheme());
    }, []);

    useEffect(() => {
      const host = hostRef.current;
      if (!host || viewRef.current) {
        return;
      }

      const wrapComp = wrapCompartmentRef.current;
      const themeExt = EditorView.theme({
        "&": {
          height: "100%",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          fontSize: "15px",
          backgroundColor: "transparent",
          color: `var(--agnx-notes-fg, ${theme.colors.foreground})`,
        },
        ".cm-scroller": {
          fontFamily: "inherit",
          fontSize: "15px",
          lineHeight: "1.7",
          overflow: "auto",
          minWidth: 0,
        },
        ".cm-content": {
          caretColor: "#22c55e",
          padding: "8px 8px 48px 4px",
          minHeight: "100%",
          fontFamily: "inherit",
          fontSize: "15px",
          lineHeight: "1.7",
          color: `var(--agnx-notes-fg, ${theme.colors.foreground})`,
        },
        ".cm-line.agnx-notes-cm-h1": {
          fontSize: "1.85rem",
          fontWeight: "700",
          lineHeight: "1.25",
          letterSpacing: "-0.02em",
        },
        ".cm-line.agnx-notes-cm-h2": {
          fontSize: "1.4rem",
          fontWeight: "650",
          lineHeight: "1.3",
        },
        ".cm-line.agnx-notes-cm-h3": {
          fontSize: "1.15rem",
          fontWeight: "600",
          lineHeight: "1.35",
        },
        ".cm-line.agnx-notes-cm-h4": {
          fontSize: "15px",
          fontWeight: "600",
          lineHeight: "1.7",
        },
        ".cm-lineNumbers .cm-gutterElement": {
          minWidth: "32px",
          padding: "0 8px 0 4px",
          fontSize: "15px",
        },
        ".cm-foldGutter": {
          width: "16px",
        },
        ".cm-foldPlaceholder, .agnx-notes-cm-fold-ph": {
          display: "none",
          width: "0",
          height: "0",
          overflow: "hidden",
          margin: "0",
          padding: "0",
          border: "none",
          lineHeight: "0",
        },
        ".agnx-notes-cm-fold-marker": {
          color: "rgba(180,180,180,0.95)",
          fontSize: "12px",
          lineHeight: "1.7",
          cursor: "pointer",
          display: "inline-block",
          minWidth: "12px",
          textAlign: "center",
        },
        ".cm-line": {
          lineHeight: "1.7",
          padding: "0",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          border: "none",
          borderRight: "1px solid rgba(127,127,127,0.18)",
          color: "rgba(160,160,160,0.55)",
          fontFamily: "inherit",
          fontSize: "13px",
          lineHeight: "1.7",
          minWidth: "36px",
        },
        ".cm-cursor, .cm-dropCursor": {
          borderLeftColor: theme.colors.accent,
        },
        "&.cm-focused": {
          outline: "none",
        },
      });

      const state = EditorState.create({
        doc: value,
        extensions: [
          history(),
          markdown(),
          syntaxHighlighting(notesMarkdownHighlight),
          notesSourceHeadingFoldExtensions(),
          notesSourceHeadingLineSizes(),
          lineNumbers(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          themeExt,
          wrapComp.of(wrap ? EditorView.lineWrapping : []),
          cmPlaceholder(props.placeholder ?? "Markdown 源码…"),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const next = update.state.doc.toString();
              valueRef.current = next;
              onChangeRef.current(next);
            }
            if (update.selectionSet || update.docChanged) {
              const head = update.state.selection.main.head;
              reportCaretFromOffset(update.state.doc.toString(), head, onCaretReportRef.current);
            }
            let foldChanged = false;
            for (const tr of update.transactions) {
              for (const effect of tr.effects) {
                if (isSourceFoldEffect(effect)) {
                  foldChanged = true;
                  break;
                }
              }
              if (foldChanged) {
                break;
              }
            }
            if (foldChanged) {
              onFoldStateChangeRef.current?.(getSourceFoldAllState(update.view));
            }
          }),
          EditorView.domEventHandlers({
            blur: () => {
              onBlurRef.current?.();
              return false;
            },
            paste: (event, view) => {
              const browserSnapshot = snapshotClipboardData(event.clipboardData);
              event.preventDefault();
              void enrichClipboardSnapshot(browserSnapshot).then(async (snapshot) => {
                if (view !== viewRef.current) {
                  return undefined;
                }
                let pastedMarkdown: string | null = null;
                if (shouldHandleUnifiedPaste(snapshot)) {
                  pastedMarkdown = await runUnifiedSourcePaste(snapshot);
                }
                if (!pastedMarkdown) {
                  pastedMarkdown = snapshot.textPlain || null;
                }
                if (!pastedMarkdown || view !== viewRef.current) {
                  return undefined;
                }
                const { from, to } = view.state.selection.main;
                view.dispatch({
                  changes: { from, to, insert: pastedMarkdown },
                  selection: { anchor: from + pastedMarkdown.length },
                  scrollIntoView: true,
                });
                view.focus();
                return undefined;
              });
              return true;
            },
            drop: (event, view) => {
              const browserSnapshot = snapshotClipboardData(event.dataTransfer);
              if (!shouldHandleUnifiedPaste(browserSnapshot)) {
                return false;
              }
              event.preventDefault();
              void enrichClipboardSnapshot(browserSnapshot)
                .then((snapshot) => runUnifiedSourcePaste(snapshot))
                .then((pastedMarkdown) => {
                  if (!pastedMarkdown || view !== viewRef.current) {
                    return undefined;
                  }
                  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                  const anchor = pos ?? view.state.selection.main.head;
                  const insert = `\n${pastedMarkdown}\n`;
                  view.dispatch({
                    changes: { from: anchor, to: anchor, insert },
                    selection: { anchor: anchor + insert.length },
                    scrollIntoView: true,
                  });
                  view.focus();
                  return undefined;
                });
              return true;
            },
          }),
        ],
      });

      const view = new EditorView({ state, parent: host });
      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per host
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      const noteId = props.noteId;
      if (!view || !noteId) {
        return;
      }
      return bindNoteScrollMemory(view.scrollDOM, noteId, "source");
    }, [props.noteId]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      const current = view.state.doc.toString();
      if (current === value) {
        return;
      }
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }, [value]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      view.dispatch({
        effects: wrapCompartmentRef.current.reconfigure(wrap ? EditorView.lineWrapping : []),
      });
      view.dom.classList.toggle("agnx-notes-cm-nowrap", wrap === false);
      hostRef.current?.classList.toggle("no-wrap", wrap === false);
    }, [wrap]);

    useEffect(() => {
      if (!active || !pendingCaret || !viewRef.current) {
        return;
      }
      const view = viewRef.current;
      const offset = lineColumnToOffset(value, pendingCaret);
      const safe = Math.max(0, Math.min(offset, view.state.doc.length));
      view.focus();
      view.dispatch({
        selection: { anchor: safe, head: safe },
        scrollIntoView: true,
      });
      onCaretConsumed?.();
    }, [active, pendingCaret, value, onCaretConsumed]);

    return createElement("div", {
      ref: hostRef,
      className: [
        "agnx-notes-source",
        "agnx-notes-source-host",
        "agnx-notes-cm",
        wrap ? "" : "no-wrap",
      ]
        .filter(Boolean)
        .join(" "),
      "data-testid": "notes-source-editor",
      "data-notes-source-rev": "62",
      style: {
        flex: 1,
        minHeight: 0,
        height: "100%",
        width: "100%",
        color: `var(--agnx-notes-fg, ${theme.colors.foreground})`,
        backgroundColor: "transparent",
      },
    });
  },
);

const NotesSourceEditorNative = forwardRef<NotesSourceEditorHandle, NotesSourceEditorProps>(
  function NotesSourceEditorNative(props, ref) {
    const { theme } = useUnistyles();
    const wrap = props.wordWrap;
    const {
      active,
      pendingCaret,
      value,
      onCaretConsumed,
      onChange,
      onBlur,
      placeholder,
      onCaretReport,
    } = props;
    const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
    const lineCount = useMemo(() => {
      const n = value.replace(/\r\n/g, "\n").split("\n").length;
      return Math.max(1, n);
    }, [value]);
    const lineLabels = useMemo(
      () => Array.from({ length: lineCount }, (_, i) => String(i + 1)).join("\n"),
      [lineCount],
    );

    useImperativeHandle(ref, () => ({
      toggleFoldAll: () => ({ foldedAll: false, foldable: 0 }),
      getFoldAllState: () => ({ foldedAll: false, foldable: 0 }),
    }));

    useEffect(() => {
      if (!active || !pendingCaret) {
        return;
      }
      const offset = lineColumnToOffset(value, pendingCaret);
      setSelection({ start: offset, end: offset });
      onCaretConsumed?.();
    }, [active, pendingCaret, value, onCaretConsumed]);

    return (
      <View style={styles.root} testID="notes-source-editor">
        <View style={styles.row}>
          <Text style={styles.gutter} importantForAccessibility="no">
            {lineLabels}
          </Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder ?? "Markdown 源码…"}
            placeholderTextColor={theme.colors.foregroundMuted}
            style={wrap ? styles.inputWrap : styles.inputNowrap}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            scrollEnabled
            selection={selection}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- selection bridge
            onSelectionChange={(e) => {
              const start = e.nativeEvent.selection.start;
              const end = e.nativeEvent.selection.end;
              setSelection({ start, end });
              reportCaretFromOffset(value, start, onCaretReport);
            }}
            testID="notes-source-input"
          />
        </View>
      </View>
    );
  },
);

export const NotesSourceEditor = forwardRef<NotesSourceEditorHandle, NotesSourceEditorProps>(
  function NotesSourceEditor(props, ref) {
    if (isDom) {
      return <NotesSourceEditorDom {...props} ref={ref} />;
    }
    return <NotesSourceEditorNative {...props} ref={ref} />;
  },
);

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    backgroundColor: "transparent",
  },
  row: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    alignItems: "stretch",
  },
  gutter: {
    width: 36,
    paddingRight: theme.spacing[2],
    fontSize: 15,
    lineHeight: 25.5,
    color: theme.colors.foregroundMuted,
    textAlign: "right",
    opacity: 0.55,
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    fontSize: 15,
    lineHeight: 25.5,
    color: theme.colors.foreground,
  },
  inputNowrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    fontSize: 15,
    lineHeight: 25.5,
    color: theme.colors.foreground,
  },
}));
