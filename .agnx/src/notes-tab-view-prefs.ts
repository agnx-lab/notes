// 场景：Notes 编辑 Tab 视图偏好 — 按 tabId 落盘（排版/主题/模式/换行），互不串台。
import type { WorkspaceAppHostApi } from "@getagnx/app-sdk";
import { NOTES_APP_ID } from "./ids";
import { DEFAULT_NOTES_TYPOGRAPHY, type NotesTypographyState } from "./notes-typography";
import {
  getCachedNotesMarkdownTheme,
  parseNotesMarkdownThemeId,
  type NotesMarkdownThemeId,
} from "./notes-prose-theme";

export interface NotesTabViewPrefs {
  typography: NotesTypographyState;
  markdownTheme: NotesMarkdownThemeId;
  editorMode: "rich" | "source";
  wordWrap: boolean;
}

export const DEFAULT_NOTES_TAB_VIEW_PREFS: NotesTabViewPrefs = {
  typography: DEFAULT_NOTES_TYPOGRAPHY,
  markdownTheme: "inherit",
  editorMode: "rich",
  wordWrap: true,
};

export function notesTabViewPrefsStorageKey(tabId: string): string {
  // host.storage key：仅 [A-Za-z0-9._-]，禁止 /
  return `view-prefs.tab.${tabId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTypography(value: unknown): NotesTypographyState {
  if (!isRecord(value)) {
    return DEFAULT_NOTES_TYPOGRAPHY;
  }
  const fontSizePx =
    typeof value.fontSizePx === "number" ? value.fontSizePx : DEFAULT_NOTES_TYPOGRAPHY.fontSizePx;
  const lineHeight =
    typeof value.lineHeight === "number" ? value.lineHeight : DEFAULT_NOTES_TYPOGRAPHY.lineHeight;
  const paragraphGapEm =
    typeof value.paragraphGapEm === "number"
      ? value.paragraphGapEm
      : DEFAULT_NOTES_TYPOGRAPHY.paragraphGapEm;
  const pageWidthPercent =
    typeof value.pageWidthPercent === "number"
      ? value.pageWidthPercent
      : DEFAULT_NOTES_TYPOGRAPHY.pageWidthPercent;
  return { fontSizePx, lineHeight, paragraphGapEm, pageWidthPercent };
}

export function parseNotesTabViewPrefs(value: unknown): NotesTabViewPrefs {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_NOTES_TAB_VIEW_PREFS,
      // 无 tab 存盘时：用历史 app 级 markdown.theme 作种子（若有）
      markdownTheme: getCachedNotesMarkdownTheme(),
    };
  }
  const editorMode = value.editorMode === "source" ? "source" : "rich";
  const wordWrap = value.wordWrap !== false;
  const markdownTheme =
    value.markdownTheme !== undefined
      ? parseNotesMarkdownThemeId(value.markdownTheme)
      : getCachedNotesMarkdownTheme();
  return {
    typography: parseTypography(value.typography),
    markdownTheme,
    editorMode,
    wordWrap,
  };
}

export async function loadNotesTabViewPrefs(
  host: WorkspaceAppHostApi | null | undefined,
  tabId: string | null | undefined,
): Promise<NotesTabViewPrefs> {
  if (!host?.storage || !tabId) {
    return parseNotesTabViewPrefs(null);
  }
  try {
    const raw = await host.storage.readJson(NOTES_APP_ID, notesTabViewPrefsStorageKey(tabId));
    return parseNotesTabViewPrefs(raw);
  } catch {
    return parseNotesTabViewPrefs(null);
  }
}

export async function saveNotesTabViewPrefs(
  host: WorkspaceAppHostApi | null | undefined,
  tabId: string | null | undefined,
  prefs: NotesTabViewPrefs,
): Promise<void> {
  if (!host?.storage || !tabId) {
    return;
  }
  try {
    await host.storage.writeJson(NOTES_APP_ID, notesTabViewPrefsStorageKey(tabId), prefs);
  } catch (error) {
    console.warn("[agnx.notes] save tab view prefs failed", error);
  }
}
