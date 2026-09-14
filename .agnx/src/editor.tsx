// 场景：Notes 编辑 Tab — TipTap（web）/ TextInput（native）+ autosave / 大纲 / 版本 / 底栏。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet as RNStyleSheet, Text, View, Pressable } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { WorkspaceAppHostApi } from "@getagnx/app-sdk";
import {
  AUTOSAVE_DEBOUNCE_MS,
  countChars,
  countWords,
  extractOutline,
  extractTitleFromMarkdown,
  type NoteOutlineHeading,
} from "./note-model";
import { exportNoteMarkdown } from "./export-markdown";
import { NOTES_APP_ID, NOTES_PANEL_ID } from "./list-contributions";
import { NotesOutlinePanel, NotesVersionsPanel } from "./side-panels";
import { NotesSourceEditor, type NotesSourceEditorHandle } from "./source-editor";
import { NotesEditorChromeBar } from "./editor-chrome-bar";
import { emptyNotesLeftActionState, type NotesLeftActionUiState } from "./editor-chrome-format";
import type { NotesEditorLeftActionId } from "./editor-chrome-actions";
import type { NotesTextStyleId } from "./editor-chrome-format";
import { NotesStatusBar, type NotesSaveStatus } from "./status-bar";
import { useNotesDemoStore } from "./store";
import { NotesTipTapEditor, type NotesTipTapEditorHandle } from "./tiptap-editor";
import { looksLikeMarkdownTable, normalizeMarkdownForPaste } from "./markdown-paste";
import type { NotesCaretPos } from "./caret-bridge";
import {
  applyNotesTypographyToHost,
  setNotesTypographyValue,
  type NotesTypographyKind,
  type NotesTypographyState,
} from "./notes-typography";
import {
  applyNotesProseThemeToHost,
  resolveNotesChromeColors,
  resolveNotesProseTokens,
  type NotesProseThemeId,
} from "./notes-prose-theme";
import {
  DEFAULT_NOTES_TAB_VIEW_PREFS,
  loadNotesTabViewPrefs,
  saveNotesTabViewPrefs,
  type NotesTabViewPrefs,
} from "./notes-tab-view-prefs";
import { getNotesHost } from "./notes-host";

function NotesEditorContent(props: {
  appId: string;
  panelId: string;
  entityId: string;
  tabId?: string;
}) {
  return <NotesEditorContentImpl {...props} />;
}

// 面板编排：富文本/源码/大纲/版本，分支较多属正常。
// eslint-disable-next-line complexity -- editor chrome state machine
function NotesEditorContentImpl(props: {
  appId: string;
  panelId: string;
  entityId: string;
  tabId?: string;
}) {
  const { theme, rt } = useUnistyles();
  const isCompact = rt.breakpoint === "xs" || rt.breakpoint === "sm";
  const note = useNotesDemoStore((state) => state.notes.find((item) => item.id === props.entityId));
  const updateNote = useNotesDemoStore((state) => state.updateNote);
  const restoreVersion = useNotesDemoStore((state) => state.restoreVersion);
  const isWeb =
    typeof document !== "undefined" &&
    typeof (globalThis as { document?: unknown }).document !== "undefined";

  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [saveStatus, setSaveStatus] = useState<NotesSaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(note?.updatedAt ?? null);
  const [stats, setStats] = useState({ characters: 0, words: 0 });
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"rich" | "source">(
    DEFAULT_NOTES_TAB_VIEW_PREFS.editorMode,
  );
  const [wordWrap, setWordWrap] = useState(DEFAULT_NOTES_TAB_VIEW_PREFS.wordWrap);
  const [pendingSourceCaret, setPendingSourceCaret] = useState<NotesCaretPos | null>(null);
  const sourceCaretRef = useRef<NotesCaretPos>({ line: 0, column: 0 });
  const [exportHint, setExportHint] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipTapRef = useRef<NotesTipTapEditorHandle | null>(null);
  const sourceRef = useRef<NotesSourceEditorHandle | null>(null);
  const titleRef = useRef(title);
  const bodyRef = useRef(body);
  titleRef.current = title;
  bodyRef.current = body;

  const [typography, setTypography] = useState(DEFAULT_NOTES_TAB_VIEW_PREFS.typography);
  const [markdownTheme, setMarkdownTheme] = useState<NotesProseThemeId>(
    DEFAULT_NOTES_TAB_VIEW_PREFS.markdownTheme,
  );
  const [viewPrefsReady, setViewPrefsReady] = useState(!props.tabId);

  const scheduleSaveViewPrefs = useCallback(
    (next: NotesTabViewPrefs) => {
      if (!props.tabId) {
        return;
      }
      if (prefsSaveRef.current) {
        clearTimeout(prefsSaveRef.current);
      }
      prefsSaveRef.current = setTimeout(() => {
        prefsSaveRef.current = null;
        void saveNotesTabViewPrefs(getNotesHost(), props.tabId, next);
      }, 280);
    },
    [props.tabId],
  );

  const applyViewChromeToRoot = useCallback(
    (nextTypography: NotesTypographyState, themeId: NotesProseThemeId) => {
      if (typeof document === "undefined") {
        return;
      }
      const rootKey = props.tabId ?? "local";
      const root = document.querySelector(`[data-notes-editor-root="${CSS.escape(rootKey)}"]`);
      const scope = root instanceof HTMLElement ? root : document;
      const hosts = scope.querySelectorAll(
        ".agnx-notes-tiptap, .agnx-notes-source-host, [data-notes-markdown-surface='1']",
      );
      for (const host of hosts) {
        if (host instanceof HTMLElement) {
          applyNotesTypographyToHost(host, nextTypography);
          applyNotesProseThemeToHost(host, themeId);
        }
      }
    },
    [props.tabId],
  );

  useEffect(() => {
    let cancelled = false;
    setViewPrefsReady(!props.tabId);
    void loadNotesTabViewPrefs(getNotesHost(), props.tabId).then((prefs) => {
      if (cancelled) {
        return undefined;
      }
      setTypography(prefs.typography);
      setMarkdownTheme(prefs.markdownTheme);
      setEditorMode(prefs.editorMode);
      setWordWrap(prefs.wordWrap);
      setViewPrefsReady(true);
      applyViewChromeToRoot(prefs.typography, prefs.markdownTheme);
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [props.tabId, applyViewChromeToRoot]);

  useEffect(() => {
    return () => {
      if (prefsSaveRef.current) {
        clearTimeout(prefsSaveRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!note) {
      setTitle("");
      setBody("");
      return;
    }
    const rawBody = note.body;
    const rawTitle = note.title;
    let nextBody = rawBody;
    let migrated = false;
    // 旧笔记只有独立 title、正文无 H1 时，把 title 迁成首个一级标题
    if (!extractOutline(rawBody).some((heading) => heading.level === 1)) {
      const heading = rawTitle.trim() || "未命名笔记";
      nextBody = rawBody.trim() ? `# ${heading}\n\n${rawBody}` : `# ${heading}\n\n`;
      migrated = true;
    }
    const nextTitle = extractTitleFromMarkdown(nextBody);
    setTitle(nextTitle);
    setBody(nextBody);
    setLastSavedAt(note.updatedAt);
    setSaveStatus("saved");
    setExportHint(null);
    if (migrated) {
      updateNote(note.id, { title: nextTitle, body: nextBody });
    }
  }, [note, updateNote]);

  const flushSave = useCallback(() => {
    if (!note) {
      return;
    }
    const nextBody = bodyRef.current;
    const nextTitle = extractTitleFromMarkdown(nextBody);
    titleRef.current = nextTitle;
    if (nextTitle === note.title && nextBody === note.body) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");
    const saved = updateNote(note.id, { title: nextTitle, body: nextBody });
    if (!saved) {
      setSaveStatus("error");
      return;
    }
    setTitle(nextTitle);
    setLastSavedAt(saved.updatedAt);
    setSaveStatus("saved");
  }, [note, updateNote]);

  const scheduleAutosave = useCallback(() => {
    setSaveStatus("dirty");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      flushSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleBodyChange = useCallback(
    (nextBody: string) => {
      const nextTitle = extractTitleFromMarkdown(nextBody);
      setBody(nextBody);
      setTitle(nextTitle);
      titleRef.current = nextTitle;
      if (!isWeb || editorMode === "source") {
        setStats({ characters: countChars(nextBody), words: countWords(nextBody) });
      }
      scheduleAutosave();
    },
    [editorMode, isWeb, scheduleAutosave],
  );

  const [foldAllActive, setFoldAllActive] = useState(false);
  const [leftActionState, setLeftActionState] =
    useState<NotesLeftActionUiState>(emptyNotesLeftActionState);

  const handleToggleEditorMode = useCallback(() => {
    setEditorMode((mode) => {
      const nextMode = mode === "rich" ? "source" : "rich";
      if (mode === "rich") {
        tipTapRef.current?.flushMarkdown();
        const caret = tipTapRef.current?.getCaret() ?? { line: 0, column: 0 };
        setPendingSourceCaret(caret);
        setBody((prev) => (looksLikeMarkdownTable(prev) ? normalizeMarkdownForPaste(prev) : prev));
      } else {
        const caret = sourceCaretRef.current;
        setBody((prev) => (looksLikeMarkdownTable(prev) ? normalizeMarkdownForPaste(prev) : prev));
        const caretSnapshot = caret;
        requestAnimationFrame(() => {
          tipTapRef.current?.setCaret(caretSnapshot);
        });
      }
      scheduleSaveViewPrefs({
        typography,
        markdownTheme,
        editorMode: nextMode,
        wordWrap,
      });
      return nextMode;
    });
  }, [typography, markdownTheme, wordWrap, scheduleSaveViewPrefs]);

  const handleToggleWordWrap = useCallback(() => {
    setWordWrap((prev) => {
      const next = !prev;
      scheduleSaveViewPrefs({
        typography,
        markdownTheme,
        editorMode,
        wordWrap: next,
      });
      return next;
    });
  }, [typography, markdownTheme, editorMode, scheduleSaveViewPrefs]);

  const handleToggleFoldAll = useCallback(() => {
    if (editorMode === "rich") {
      const next = tipTapRef.current?.toggleFoldAll();
      if (next) {
        setFoldAllActive(next.foldedAll);
      }
      return;
    }
    const next = sourceRef.current?.toggleFoldAll();
    if (next) {
      setFoldAllActive(next.foldedAll);
    }
  }, [editorMode]);

  const handleFoldStateChange = useCallback((state: { foldedAll: boolean; foldable: number }) => {
    setFoldAllActive(state.foldedAll);
  }, []);

  const headings = useMemo(() => extractOutline(body), [body]);

  const handleExport = useCallback(async () => {
    if (!note) {
      return;
    }
    flushSave();
    const latest = {
      ...note,
      title: titleRef.current,
      body: bodyRef.current,
    };
    const result = await exportNoteMarkdown(latest);
    setExportHint(result.ok ? `已导出（${result.method}）` : "导出失败");
    setTimeout(() => setExportHint(null), 2500);
  }, [flushSave, note]);

  const handleRestore = useCallback(
    (versionId: string) => {
      if (!note) {
        return;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      const restored = restoreVersion(note.id, versionId);
      if (!restored) {
        return;
      }
      setTitle(restored.title);
      setBody(restored.body);
      setLastSavedAt(restored.updatedAt);
      setSaveStatus("saved");
      // 恢复后保持版本面板打开，方便继续对比/切换
    },
    [note, restoreVersion],
  );

  const handleToggleOutline = useCallback(() => {
    setOutlineOpen((open) => !open);
    setVersionsOpen(false);
  }, []);

  const handleToggleVersions = useCallback(() => {
    setVersionsOpen((open) => !open);
    setOutlineOpen(false);
  }, []);

  const handleExportPress = useCallback(() => {
    void handleExport();
  }, [handleExport]);

  const handleOutlineJump = useCallback((heading: NoteOutlineHeading) => {
    tipTapRef.current?.jumpToHeading(heading);
  }, []);

  const handleLeftAction = useCallback((id: NotesEditorLeftActionId) => {
    tipTapRef.current?.runLeftAction(id);
  }, []);

  const handleApplyTextStyle = useCallback((id: NotesTextStyleId) => {
    tipTapRef.current?.applyTextStyle(id);
  }, []);

  const handleSourceCaretReport = useCallback((caret: NotesCaretPos) => {
    sourceCaretRef.current = caret;
  }, []);

  const handleSourceCaretConsumed = useCallback(() => {
    setPendingSourceCaret(null);
  }, []);

  const handleTypographyChange = useCallback(
    (kind: NotesTypographyKind, value: number) => {
      setTypography((prev) => {
        const nextTypography = setNotesTypographyValue(prev, kind, value);
        applyViewChromeToRoot(nextTypography, markdownTheme);
        scheduleSaveViewPrefs({
          typography: nextTypography,
          markdownTheme,
          editorMode,
          wordWrap,
        });
        return nextTypography;
      });
    },
    [applyViewChromeToRoot, markdownTheme, editorMode, wordWrap, scheduleSaveViewPrefs],
  );

  const handleMarkdownThemeChange = useCallback(
    (id: NotesProseThemeId) => {
      setMarkdownTheme(id);
      applyViewChromeToRoot(typography, id);
      scheduleSaveViewPrefs({
        typography,
        markdownTheme: id,
        editorMode,
        wordWrap,
      });
    },
    [applyViewChromeToRoot, typography, editorMode, wordWrap, scheduleSaveViewPrefs],
  );

  const handleLeftActionStateChange = useCallback((state: NotesLeftActionUiState) => {
    setLeftActionState(state);
  }, []);

  useEffect(() => {
    if (!viewPrefsReady) {
      return;
    }
    applyViewChromeToRoot(typography, markdownTheme);
  }, [viewPrefsReady, typography, markdownTheme, editorMode, note?.id, applyViewChromeToRoot]);

  if (!note) {
    return (
      <View style={styles.root} testID="workspace-mini-app-notes-missing">
        <Text style={styles.title}>笔记不存在</Text>
        <Text style={styles.meta}>{props.entityId}</Text>
      </View>
    );
  }

  const bodyPlaceholder = "输入正文…首行可用 # 一级标题作为笔记标题";

  let sidePanel = null;
  if (outlineOpen) {
    sidePanel = <NotesOutlinePanel headings={headings} onJump={handleOutlineJump} />;
  } else if (versionsOpen) {
    sidePanel = <NotesVersionsPanel versions={note.versions} onRestore={handleRestore} />;
  }

  const markdownTokens = resolveNotesProseTokens(markdownTheme);
  const panelBackground = markdownTheme === "inherit" ? "transparent" : markdownTokens.panelBg;
  const chromeColors = resolveNotesChromeColors(markdownTheme, {
    foregroundMuted: theme.colors.foregroundMuted,
    accent: theme.colors.accent,
    border: theme.colors.border,
    surface2: theme.colors.surface2,
  });

  const chromeBar = (
    <NotesEditorChromeBar
      leftActionState={leftActionState}
      onLeftAction={handleLeftAction}
      onApplyTextStyle={handleApplyTextStyle}
      mutedColor={chromeColors.mutedColor}
      accentColor={chromeColors.accentColor}
    />
  );

  const statusBar = (
    <NotesStatusBar
      status={saveStatus}
      characters={stats.characters}
      words={stats.words}
      lastSavedAt={lastSavedAt}
      editorMode={isWeb ? editorMode : "source"}
      wordWrap={wordWrap}
      foldAllActive={foldAllActive}
      foldAllDisabled={!isWeb}
      outlineOpen={outlineOpen}
      versionsOpen={versionsOpen}
      typography={typography}
      markdownTheme={markdownTheme}
      chromeMutedColor={chromeColors.mutedColor}
      chromeAccentColor={chromeColors.accentColor}
      chromeBadgeFg={chromeColors.badgeFg}
      chromeBadgeBorder={chromeColors.badgeBorder}
      chromeBadgeBg={chromeColors.badgeBg}
      onTypographyChange={handleTypographyChange}
      onMarkdownThemeChange={handleMarkdownThemeChange}
      onToggleOutline={handleToggleOutline}
      onToggleVersions={handleToggleVersions}
      onToggleEditorMode={handleToggleEditorMode}
      onToggleWordWrap={handleToggleWordWrap}
      onToggleFoldAll={handleToggleFoldAll}
      onExportMarkdown={handleExportPress}
    />
  );

  return (
    <View
      // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-object-as-prop -- 整页含顶/底栏跟随 Markdown 主题；data 属性圈定当前 Tab
      style={[styles.root, { backgroundColor: panelBackground }]}
      testID="workspace-mini-app-notes-editor"
      {...({ "data-notes-editor-root": props.tabId ?? "local" } as Record<string, string>)}
    >
      <View style={styles.mainRow}>
        <View style={isCompact ? styles.editorColumnCompact : styles.editorColumn}>
          {isCompact ? statusBar : chromeBar}
          {isWeb ? (
            <View style={styles.editorBody}>
              <View
                // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- mode visibility
                style={editorMode === "rich" ? styles.modePane : styles.modePaneHidden}
                pointerEvents={editorMode === "rich" ? "auto" : "none"}
              >
                <NotesTipTapEditor
                  ref={tipTapRef}
                  noteId={note.id}
                  markdown={body}
                  wordWrap={wordWrap}
                  active={editorMode === "rich"}
                  editable={editorMode === "rich"}
                  onMarkdownChange={handleBodyChange}
                  onStatsChange={setStats}
                  onFoldStateChange={handleFoldStateChange}
                  onLeftActionStateChange={handleLeftActionStateChange}
                  placeholder={bodyPlaceholder}
                />
              </View>
              <View
                // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- mode visibility
                style={editorMode === "source" ? styles.modePane : styles.modePaneHidden}
                pointerEvents={editorMode === "source" ? "auto" : "none"}
              >
                <NotesSourceEditor
                  ref={sourceRef}
                  noteId={note.id}
                  value={body}
                  onChange={handleBodyChange}
                  onBlur={flushSave}
                  wordWrap={wordWrap}
                  active={editorMode === "source"}
                  pendingCaret={pendingSourceCaret}
                  onCaretConsumed={handleSourceCaretConsumed}
                  onCaretReport={handleSourceCaretReport}
                  onFoldStateChange={handleFoldStateChange}
                  placeholder="Markdown 源码…"
                />
              </View>
            </View>
          ) : (
            <NotesSourceEditor
              noteId={note.id}
              value={body}
              onChange={handleBodyChange}
              onBlur={flushSave}
              wordWrap={wordWrap}
              active
              onCaretReport={handleSourceCaretReport}
              placeholder="正文（当前端无富文本，纯文本）"
            />
          )}
          {isCompact ? chromeBar : null}
          {exportHint ? <Text style={styles.exportHint}>{exportHint}</Text> : null}
        </View>
        {sidePanel}
      </View>
      {isCompact ? null : statusBar}
      {!isWeb ? (
        <Pressable style={styles.saveButton} onPress={flushSave} accessibilityRole="button">
          <Text style={styles.saveLabel}>保存</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  mainRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
  },
  editorColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    paddingHorizontal: theme.spacing[6],
    paddingTop: theme.spacing[6],
    gap: theme.spacing[3],
  },
  editorColumnCompact: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    paddingHorizontal: theme.spacing[2],
    paddingTop: theme.spacing[2],
    gap: theme.spacing[2],
  },
  editorBody: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    position: "relative",
  },
  modePane: {
    ...RNStyleSheet.absoluteFillObject,
  },
  modePaneHidden: {
    ...RNStyleSheet.absoluteFillObject,
    display: "none",
    pointerEvents: "none",
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.foreground,
  },
  meta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  exportHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.accent,
  },
  saveButton: {
    alignSelf: "flex-start",
    margin: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
  },
  saveLabel: {
    color: theme.colors.accentForeground,
    fontWeight: theme.fontWeight.medium,
  },
}));

function getEntityTitle(entityId: string): string | null {
  return useNotesDemoStore.getState().getNote(entityId)?.title?.trim() || null;
}

function subscribeEntityTitle(entityId: string, listener: () => void): () => void {
  void entityId;
  return useNotesDemoStore.subscribe(listener);
}

export function registerNotesEditorPanel(nextHost: WorkspaceAppHostApi): void {
  nextHost.registerMiniApp({
    id: NOTES_PANEL_ID,
    appId: NOTES_APP_ID,
    title: "笔记",
    component: NotesEditorContent,
    getEntityTitle,
    subscribeEntityTitle,
  });
}
