// 场景：基于 @tiptap/core 的 Markdown 块编辑器（web DOM）；顶栏插块 + MD 粘贴（已移除 / slash 面板）。
import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { CharacterCount } from "@tiptap/extension-character-count";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Underline } from "@tiptap/extension-underline";
import { TableRow } from "@tiptap/extension-table-row";
import { Link } from "@tiptap/extension-link";
import { Typography } from "@tiptap/extension-typography";
import { TextAlign } from "@tiptap/extension-text-align";
import { Markdown } from "tiptap-markdown";
import { ensureNotesEditorStyles } from "./editor-styles";
import { applyNotesProseThemeToHost, getCachedNotesProseTheme } from "./notes-prose-theme";
import { NotesFoldGutter } from "./fold-gutter";
import { NotesLinkViewContainer } from "./link-view-container";
import { refreshNoteImageSources } from "./insert-image";
import { pickAndInsertNoteAttachment, refreshNoteAttachmentSources } from "./insert-attachment";
import { createUnifiedPasteExtension } from "./unified-paste-extension";
import { NotesImageViewContainer } from "./image-view-container";
import { NotesTableViewContainer } from "./table-view-container";
import { NotesMermaidViewContainer } from "./mermaid-view-container";
import { NotesCodeBlockViewContainer } from "./code-block-view-container";
import { NotesImage } from "./notes-image";
import { NotesAttachment } from "./notes-attachment";
import { NotesParagraph } from "./notes-paragraph";
import { NotesTable } from "./notes-table";
import { NotesTableCell, NotesTableHeader } from "./notes-table-cell";
import { NotesCodeBlock } from "./notes-code-block";
import { NotesHorizontalRule } from "./notes-horizontal-rule";
import {
  looksLikeMarkdown,
  looksLikeMarkdownTable,
  normalizeMarkdownForPaste,
} from "./markdown-paste";
import {
  createNotesLinkClickExtension,
  isNotesLinkHrefAllowed,
  humanizeMarkdownLinkTargets,
  normalizeMarkdownLinkTargets,
} from "./notes-link";
import type { NoteOutlineHeading } from "./note-model";
import { jumpEditorToHeading } from "./outline-jump";
import {
  createHeadingFoldExtension,
  headingFoldPluginKey,
  setAllHeadingFolds,
  shouldExpandAllHeadings,
  listFoldableHeadingPositions,
} from "./heading-fold";
import { createNotesSideMenuExtension } from "./side-menu";
import { caretFromRichEditor, applyCaretToRichEditor, type NotesCaretPos } from "./caret-bridge";
import { bindNoteScrollMemory } from "./editor-scroll-memory";
import {
  applyNotesTextStyle,
  emptyNotesLeftActionState,
  readNotesLeftActionState,
  runNotesLeftAction,
  type NotesLeftActionUiState,
  type NotesTextStyleId,
} from "./editor-chrome-format";
import type { NotesEditorLeftActionId } from "./editor-chrome-actions";

export interface NotesTipTapEditorHandle {
  jumpToHeading: (heading: NoteOutlineHeading) => boolean;
  getCaret: () => NotesCaretPos;
  setCaret: (caret: NotesCaretPos) => boolean;
  /** 冲刷当前 TipTap → markdown，供切换源码面前对齐 body */
  flushMarkdown: () => string;
  /** 全部折叠 / 全部展开标题区块；返回下一状态文案用的「是否已全部折叠」 */
  toggleFoldAll: () => { foldedAll: boolean; foldable: number };
  getFoldAllState: () => { foldedAll: boolean; foldable: number };
  runLeftAction: (id: NotesEditorLeftActionId) => boolean;
  applyTextStyle: (id: NotesTextStyleId) => boolean;
  getLeftActionState: () => NotesLeftActionUiState;
}

export interface NotesTipTapEditorProps {
  noteId: string;
  markdown: string;
  placeholder?: string;
  editable?: boolean;
  /** false 时不写回 markdown（隐藏的富文本面） */
  active?: boolean;
  /** 与源码面共用的自动换行 */
  wordWrap?: boolean;
  onMarkdownChange: (markdown: string) => void;
  onStatsChange?: (stats: { characters: number; words: number }) => void;
  onFoldStateChange?: (state: { foldedAll: boolean; foldable: number }) => void;
  onLeftActionStateChange?: (state: NotesLeftActionUiState) => void;
}

function prepareEditorMarkdown(markdown: string): string {
  if (!markdown) {
    return "";
  }
  const withLinks = normalizeMarkdownLinkTargets(markdown);
  if (looksLikeMarkdownTable(withLinks)) {
    return normalizeMarkdownForPaste(withLinks);
  }
  return withLinks;
}

function readMarkdown(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
  const md = storage.markdown?.getMarkdown?.();
  if (typeof md === "string") {
    return humanizeMarkdownLinkTargets(md);
  }
  return humanizeMarkdownLinkTargets(editor.getText());
}

export const NotesTipTapEditor = forwardRef<NotesTipTapEditorHandle, NotesTipTapEditorProps>(
  function NotesTipTapEditor(props, ref) {
    const { theme } = useUnistyles();
    const hostRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<Editor | null>(null);
    const onChangeRef = useRef(props.onMarkdownChange);
    const onStatsRef = useRef(props.onStatsChange);
    const onFoldStateChangeRef = useRef(props.onFoldStateChange);
    const onLeftActionStateChangeRef = useRef(props.onLeftActionStateChange);
    const activeRef = useRef(props.active !== false);
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
    const [scrollHost, setScrollHost] = useState<HTMLDivElement | null>(null);

    onChangeRef.current = props.onMarkdownChange;
    onStatsRef.current = props.onStatsChange;
    onFoldStateChangeRef.current = props.onFoldStateChange;
    onLeftActionStateChangeRef.current = props.onLeftActionStateChange;
    activeRef.current = props.active !== false;

    const reportFoldState = (editor: Editor) => {
      const foldable = listFoldableHeadingPositions(editor).length;
      onFoldStateChangeRef.current?.({
        foldable,
        foldedAll: foldable > 0 && shouldExpandAllHeadings(editor),
      });
    };

    const reportLeftActionState = (editor: Editor | null) => {
      onLeftActionStateChangeRef.current?.(readNotesLeftActionState(editor));
    };

    useImperativeHandle(ref, () => ({
      jumpToHeading: (heading) => {
        const editor = editorRef.current;
        if (!editor || editor.isDestroyed) {
          return false;
        }
        return jumpEditorToHeading(editor, heading);
      },
      getCaret: () => {
        const editor = editorRef.current;
        if (!editor || editor.isDestroyed) {
          return { line: 0, column: 0 };
        }
        return caretFromRichEditor(editor);
      },
      setCaret: (caret) => {
        const editor = editorRef.current;
        if (!editor || editor.isDestroyed) {
          return false;
        }
        return applyCaretToRichEditor(editor, caret);
      },
      flushMarkdown: () => {
        const editor = editorRef.current;
        if (!editor || editor.isDestroyed) {
          return "";
        }
        const md = readMarkdown(editor);
        onChangeRef.current(md);
        return md;
      },
      getFoldAllState: () => {
        const editor = editorRef.current;
        if (!editor || editor.isDestroyed) {
          return { foldedAll: false, foldable: 0 };
        }
        const foldable = listFoldableHeadingPositions(editor).length;
        return {
          foldable,
          foldedAll: foldable > 0 && shouldExpandAllHeadings(editor),
        };
      },
      toggleFoldAll: () => {
        const editor = editorRef.current;
        if (!editor || editor.isDestroyed) {
          return { foldedAll: false, foldable: 0 };
        }
        const foldable = listFoldableHeadingPositions(editor).length;
        if (foldable === 0) {
          return { foldedAll: false, foldable: 0 };
        }
        const expand = shouldExpandAllHeadings(editor);
        setAllHeadingFolds(editor, !expand);
        return { foldedAll: !expand, foldable };
      },
      runLeftAction: (id) => {
        const editor = editorRef.current;
        if (!editor || editor.isDestroyed) {
          return false;
        }
        if (id === "addFile") {
          void (async () => {
            await pickAndInsertNoteAttachment(editor);
            reportLeftActionState(editor);
          })();
          return true;
        }
        const ok = runNotesLeftAction(editor, id);
        reportLeftActionState(editor);
        return ok;
      },
      applyTextStyle: (id) => {
        const editor = editorRef.current;
        if (!editor || editor.isDestroyed) {
          return false;
        }
        const ok = applyNotesTextStyle(editor, id);
        reportLeftActionState(editor);
        return ok;
      },
      getLeftActionState: () => {
        const editor = editorRef.current;
        if (!editor || editor.isDestroyed) {
          return emptyNotesLeftActionState();
        }
        return readNotesLeftActionState(editor);
      },
    }));

    useEffect(() => {
      ensureNotesEditorStyles();
      const el = hostRef.current;
      if (!el || typeof document === "undefined") {
        return;
      }

      const editor = new Editor({
        element: el,
        editable: props.editable !== false,
        extensions: [
          StarterKit.configure({
            heading: { levels: [1, 2, 3] },
            codeBlock: false,
            horizontalRule: false,
            // 空段 Markdown 往返由 NotesParagraph 负责
            paragraph: false,
          }),
          NotesParagraph,
          NotesCodeBlock,
          NotesHorizontalRule,
          NotesImage,
          NotesAttachment,
          Underline,
          Link.configure({
            // 点击仅出路径编辑条；打开 Browser Tab 由条上按钮触发
            openOnClick: false,
            autolink: true,
            linkOnPaste: true,
            HTMLAttributes: {
              class: "agnx-notes-link",
              rel: "noopener noreferrer nofollow",
              // 禁止 target=_blank，避免与路径条并存时误开弹窗
            },
            isAllowedUri: (url) => isNotesLinkHrefAllowed(url),
          }),
          Typography,
          TextAlign.configure({
            types: ["heading", "paragraph"],
          }),
          TaskList,
          TaskItem.configure({ nested: true }),
          NotesTable,
          TableRow,
          NotesTableHeader,
          NotesTableCell,
          Placeholder.configure({
            placeholder: props.placeholder ?? "输入正文…",
          }),
          CharacterCount,
          Markdown.configure({
            html: true,
            breaks: true,
            linkify: true,
            transformPastedText: false,
            transformCopiedText: true,
          }),
          createUnifiedPasteExtension(),
          createHeadingFoldExtension(),
          createNotesLinkClickExtension(),
          createNotesSideMenuExtension(),
        ],
        content: prepareEditorMarkdown(props.markdown || ""),
        editorProps: {
          attributes: {
            class: "agnx-notes-prosemirror",
            style: `color: var(--agnx-notes-fg, ${theme.colors.foreground}); caret-color: #22c55e;`,
          },
        },
        onUpdate: ({ editor: next, transaction }) => {
          if (!activeRef.current) {
            return;
          }
          if (transaction.getMeta("notesSkipMarkdownEmit")) {
            return;
          }
          onChangeRef.current(readMarkdown(next));
          const characters = next.storage.characterCount?.characters?.() ?? 0;
          const words = next.storage.characterCount?.words?.() ?? 0;
          onStatsRef.current?.({ characters, words });
        },
        onCreate: ({ editor: next }) => {
          const raw = readMarkdown(next);
          const onlyPlainBlocks = Array.from({ length: next.state.doc.childCount }).every(
            (_, i) => {
              const child = next.state.doc.child(i);
              return child.type.name === "paragraph" || child.type.name === "text";
            },
          );
          if (
            onlyPlainBlocks &&
            looksLikeMarkdown(raw) &&
            (/(?:^|\n)\s{0,3}#{1,6}\s+\S/.test(raw) ||
              /(?:^|\n)\s*\|.+\|\s*\n\s*\|?\s*:?-{3,}/.test(raw))
          ) {
            next.commands.setContent(prepareEditorMarkdown(raw));
          }
          const characters = next.storage.characterCount?.characters?.() ?? 0;
          const words = next.storage.characterCount?.words?.() ?? 0;
          onStatsRef.current?.({ characters, words });
        },
      });
      editorRef.current = editor;
      setEditorInstance(editor);
      if (el) {
        (el as HTMLElement & { __notesEditor?: Editor }).__notesEditor = editor;
      }
      void refreshNoteImageSources(editor);
      void refreshNoteAttachmentSources(editor);

      const onTransaction = ({ transaction }: { transaction: Transaction }) => {
        if (transaction.getMeta(headingFoldPluginKey)) {
          reportFoldState(editor);
        }
        reportLeftActionState(editor);
      };
      const onSelectionUpdate = () => {
        reportLeftActionState(editor);
      };
      editor.on("transaction", onTransaction);
      editor.on("selectionUpdate", onSelectionUpdate);
      reportLeftActionState(editor);

      return () => {
        editor.off("transaction", onTransaction);
        editor.off("selectionUpdate", onSelectionUpdate);
        if (el) {
          delete (el as HTMLElement & { __notesEditor?: Editor }).__notesEditor;
        }
        editor.destroy();
        editorRef.current = null;
        setEditorInstance(null);
        reportLeftActionState(null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional remount on note switch
    }, [props.noteId]);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || editor.isDestroyed) {
        return;
      }
      const current = readMarkdown(editor);
      const prepared = prepareEditorMarkdown(props.markdown || "");
      if (current === prepared || current === props.markdown) {
        return;
      }
      editor.commands.setContent(prepared);
      void refreshNoteImageSources(editor);
      void refreshNoteAttachmentSources(editor);
    }, [props.markdown, props.noteId]);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || editor.isDestroyed) {
        return;
      }
      editor.setEditable(props.editable !== false);
      reportLeftActionState(editor);
    }, [props.editable]);

    // 选中附件块时空格：音视频播放/暂停（对齐目录 peek 的空格切换语义）。
    useEffect(() => {
      const editor = editorInstance;
      if (!editor || editor.isDestroyed || typeof document === "undefined") {
        return;
      }
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.code !== "Space" && event.key !== " ") {
          return;
        }
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
          return;
        }
        if (!editor.isFocused || !editor.isEditable) {
          return;
        }
        const { selection } = editor.state;
        if (selection.constructor.name !== "NodeSelection") {
          return;
        }
        const nodeSelection = selection as { node?: { type: { name: string } }; from: number };
        if (nodeSelection.node?.type.name !== "notesAttachment") {
          return;
        }
        const dom = editor.view.nodeDOM(nodeSelection.from);
        if (!(dom instanceof HTMLElement)) {
          return;
        }
        const media = dom.querySelector("audio, video") as HTMLMediaElement | null;
        if (media) {
          event.preventDefault();
          event.stopPropagation();
          if (media.paused) {
            void media.play();
          } else {
            media.pause();
          }
          return;
        }
        const playable = dom.querySelector(
          ".agnx-notes-attachment-card-playable",
        ) as HTMLElement | null;
        if (!playable) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        playable.click();
      };
      editor.view.dom.addEventListener("keydown", onKeyDown);
      return () => {
        editor.view.dom.removeEventListener("keydown", onKeyDown);
      };
    }, [editorInstance]);

    useEffect(() => {
      const el = hostRef.current;
      if (!el) {
        return;
      }
      el.classList.toggle("no-wrap", props.wordWrap === false);
      el.style.overflowX = props.wordWrap === false ? "auto" : "hidden";
    }, [props.wordWrap]);

    const bindHostRef = useCallback((node: HTMLDivElement | null) => {
      hostRef.current = node;
      setScrollHost((prev) => (prev === node ? prev : node));
    }, []);

    useEffect(() => {
      const host = scrollHost;
      if (!host || !props.noteId) {
        return;
      }
      return bindNoteScrollMemory(host, props.noteId, "rich");
    }, [scrollHost, props.noteId]);

    useEffect(() => {
      if (!scrollHost) {
        return;
      }
      applyNotesProseThemeToHost(scrollHost, getCachedNotesProseTheme());
    }, [scrollHost]);

    return (
      <View style={styles.wrap} testID="notes-tiptap-editor">
        {createElement("div", {
          ref: bindHostRef,
          className: ["agnx-notes-tiptap", props.wordWrap === false ? "no-wrap" : ""]
            .filter(Boolean)
            .join(" "),
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- DOM host style
          style: {
            color: `var(--agnx-notes-fg, ${theme.colors.foreground})`,
            width: "100%",
            flex: 1,
            minHeight: 0,
            height: "100%",
            overflowX: props.wordWrap === false ? "auto" : "hidden",
            overflowY: "auto",
          },
        })}
        {/* 外侧轨：不进滚动文档流，避免打断纵向滚动 */}
        {/* 折叠轨常驻（不依赖 hover）；SideMenu 手柄跟块 */}
        <NotesFoldGutter editor={editorInstance} scrollHost={scrollHost} />
        <NotesLinkViewContainer editor={editorInstance} scrollHost={scrollHost} />
        <NotesImageViewContainer editor={editorInstance} scrollHost={scrollHost} />
        <NotesTableViewContainer editor={editorInstance} scrollHost={scrollHost} />
        <NotesMermaidViewContainer editor={editorInstance} scrollHost={scrollHost} />
        <NotesCodeBlockViewContainer editor={editorInstance} scrollHost={scrollHost} />
        {/* 格式/块类型已迁顶栏 ActionBar；无 slash / BubbleMenu / BlockMenu */}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
  },
});
