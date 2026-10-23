// 场景：Notes Markdown 主题 — 默认跟随全局；专属包仅笔记 Tab；不写 Music/氛围存盘。
import type { WorkspaceAppHostApi } from "@agnx-lab/app-sdk";
import { NOTES_APP_ID } from "./ids";

export const NOTES_MARKDOWN_THEME_CONFIG_KEY = "markdown.theme";
/** @deprecated 兼容旧 key 读取 */
export const NOTES_PROSE_THEME_CONFIG_KEY = "prose.theme";

/** inherit = 跟随全局氛围；其余为笔记 Tab 专属 Markdown 包。 */
export type NotesMarkdownThemeId =
  | "inherit"
  | "notion"
  | "paper"
  | "sepia"
  | "github"
  | "magazine"
  | "minimal";

export const NOTES_MARKDOWN_THEME_OPTIONS: ReadonlyArray<{
  id: NotesMarkdownThemeId;
  label: string;
}> = [
  { id: "inherit", label: "跟随全局" },
  { id: "notion", label: "Notion" },
  { id: "paper", label: "纸白" },
  { id: "sepia", label: "羊皮纸" },
  { id: "github", label: "GitHub" },
  { id: "magazine", label: "杂志" },
  { id: "minimal", label: "极简" },
];

const DEFAULT_THEME: NotesMarkdownThemeId = "inherit";

export interface NotesMarkdownTokenBag {
  /** 笔记面板/编辑区背景；inherit 时为 transparent */
  panelBg: string;
  fg: string;
  heading: string;
  muted: string;
  link: string;
  quoteBar: string;
  hr: string;
  tableBorder: string;
  tableHeaderBg: string;
  codeBg: string;
  codeFg: string;
  codeBorder: string;
  codeGutter: string;
  inlineCodeBg: string;
  inlineCodeFg: string;
  inlineCodeBorder: string;
  hljsComment: string;
  hljsKeyword: string;
  hljsString: string;
  hljsNumber: string;
  hljsTitle: string;
  hljsAttr: string;
  hljsType: string;
  hljsMeta: string;
  hljsDeletion: string;
  hljsAddition: string;
  hljsPunctuation: string;
}

/** 跟随全局：不铺专属底，结构色用中性可读默认（正文色仍跟壳 foreground）。 */
const INHERIT_TOKENS: NotesMarkdownTokenBag = {
  panelBg: "transparent",
  fg: "inherit",
  heading: "inherit",
  muted: "inherit",
  link: "var(--agnx-notes-link-accent, #c26a3a)",
  quoteBar: "rgba(127, 127, 127, 0.45)",
  hr: "rgba(127, 127, 127, 0.42)",
  tableBorder: "rgba(127, 127, 127, 0.35)",
  tableHeaderBg: "rgba(255, 255, 255, 0.04)",
  codeBg: "rgba(15, 18, 28, 0.72)",
  codeFg: "#e8eaef",
  codeBorder: "rgba(255, 255, 255, 0.1)",
  codeGutter: "rgba(232, 234, 239, 0.38)",
  inlineCodeBg: "rgba(154, 82, 28, 0.55)",
  inlineCodeFg: "#fff4e8",
  inlineCodeBorder: "rgba(251, 146, 60, 0.28)",
  hljsComment: "#8b93a7",
  hljsKeyword: "#c792ea",
  hljsString: "#c3e88d",
  hljsNumber: "#f78c6c",
  hljsTitle: "#82aaff",
  hljsAttr: "#ffcb6b",
  hljsType: "#89ddff",
  hljsMeta: "#f07178",
  hljsDeletion: "#ff9cac",
  hljsAddition: "#c3e88d",
  hljsPunctuation: "#89ddff",
};

const NOTION_TOKENS: NotesMarkdownTokenBag = {
  panelBg: "#ffffff",
  fg: "#37352f",
  heading: "#37352f",
  muted: "#787774",
  link: "#337ea9",
  quoteBar: "rgba(55, 53, 47, 0.28)",
  hr: "rgba(55, 53, 47, 0.16)",
  tableBorder: "rgba(55, 53, 47, 0.16)",
  tableHeaderBg: "rgba(55, 53, 47, 0.04)",
  codeBg: "#f7f6f3",
  codeFg: "#37352f",
  codeBorder: "rgba(55, 53, 47, 0.12)",
  codeGutter: "rgba(55, 53, 47, 0.35)",
  inlineCodeBg: "rgba(135, 131, 120, 0.18)",
  inlineCodeFg: "#eb5757",
  inlineCodeBorder: "transparent",
  hljsComment: "#9b9a97",
  hljsKeyword: "#c45500",
  hljsString: "#448361",
  hljsNumber: "#c45500",
  hljsTitle: "#337ea9",
  hljsAttr: "#9065b0",
  hljsType: "#337ea9",
  hljsMeta: "#c45500",
  hljsDeletion: "#eb5757",
  hljsAddition: "#448361",
  hljsPunctuation: "#37352f",
};

const GITHUB_TOKENS: NotesMarkdownTokenBag = {
  panelBg: "#0d1117",
  fg: "#e6edf3",
  heading: "#e6edf3",
  muted: "#8b949e",
  link: "#2f81f7",
  quoteBar: "rgba(148, 163, 184, 0.55)",
  hr: "rgba(255, 255, 255, 0.12)",
  tableBorder: "rgba(255, 255, 255, 0.12)",
  tableHeaderBg: "rgba(255, 255, 255, 0.04)",
  codeBg: "#161b22",
  codeFg: "#e6edf3",
  codeBorder: "rgba(255, 255, 255, 0.12)",
  codeGutter: "rgba(230, 237, 243, 0.35)",
  inlineCodeBg: "rgba(110, 118, 129, 0.28)",
  inlineCodeFg: "#e6edf3",
  inlineCodeBorder: "rgba(110, 118, 129, 0.35)",
  hljsComment: "#8b949e",
  hljsKeyword: "#ff7b72",
  hljsString: "#a5d6ff",
  hljsNumber: "#79c0ff",
  hljsTitle: "#d2a8ff",
  hljsAttr: "#79c0ff",
  hljsType: "#ffa657",
  hljsMeta: "#ff7b72",
  hljsDeletion: "#ffa198",
  hljsAddition: "#7ee787",
  hljsPunctuation: "#e6edf3",
};

const MAGAZINE_TOKENS: NotesMarkdownTokenBag = {
  panelBg: "#1c1816",
  fg: "#f5ebe0",
  heading: "#fff1e0",
  muted: "#a89888",
  link: "#e8a87c",
  quoteBar: "rgba(180, 120, 80, 0.55)",
  hr: "rgba(255, 220, 180, 0.16)",
  tableBorder: "rgba(255, 220, 180, 0.14)",
  tableHeaderBg: "rgba(255, 220, 180, 0.06)",
  codeBg: "rgba(28, 24, 22, 0.96)",
  codeFg: "#f5ebe0",
  codeBorder: "rgba(255, 220, 180, 0.12)",
  codeGutter: "rgba(245, 235, 224, 0.35)",
  inlineCodeBg: "rgba(180, 100, 40, 0.35)",
  inlineCodeFg: "#fff1e0",
  inlineCodeBorder: "rgba(251, 146, 60, 0.22)",
  hljsComment: "#a89888",
  hljsKeyword: "#e8a87c",
  hljsString: "#c3d9a0",
  hljsNumber: "#f0b27a",
  hljsTitle: "#9ec3e8",
  hljsAttr: "#e8c07a",
  hljsType: "#9ed0d0",
  hljsMeta: "#e8958a",
  hljsDeletion: "#f0a0a8",
  hljsAddition: "#c3d9a0",
  hljsPunctuation: "#d0c4b8",
};

const MINIMAL_TOKENS: NotesMarkdownTokenBag = {
  panelBg: "rgba(0, 0, 0, 0.22)",
  fg: "inherit",
  heading: "inherit",
  muted: "inherit",
  link: "inherit",
  quoteBar: "rgba(127, 127, 127, 0.28)",
  hr: "rgba(127, 127, 127, 0.28)",
  tableBorder: "rgba(255, 255, 255, 0.1)",
  tableHeaderBg: "rgba(255, 255, 255, 0.04)",
  codeBg: "rgba(0, 0, 0, 0.28)",
  codeFg: "inherit",
  codeBorder: "rgba(255, 255, 255, 0.08)",
  codeGutter: "rgba(255, 255, 255, 0.28)",
  inlineCodeBg: "rgba(127, 127, 127, 0.18)",
  inlineCodeFg: "inherit",
  inlineCodeBorder: "transparent",
  hljsComment: "rgba(255,255,255,0.45)",
  hljsKeyword: "inherit",
  hljsString: "inherit",
  hljsNumber: "inherit",
  hljsTitle: "inherit",
  hljsAttr: "inherit",
  hljsType: "inherit",
  hljsMeta: "inherit",
  hljsDeletion: "inherit",
  hljsAddition: "inherit",
  hljsPunctuation: "inherit",
};

const PAPER_TOKENS: NotesMarkdownTokenBag = {
  panelBg: "#fbfaf7",
  fg: "#1c1917",
  heading: "#0c0a09",
  muted: "#78716c",
  link: "#0369a1",
  quoteBar: "rgba(120, 113, 108, 0.45)",
  hr: "rgba(120, 113, 108, 0.28)",
  tableBorder: "rgba(120, 113, 108, 0.28)",
  tableHeaderBg: "rgba(120, 113, 108, 0.08)",
  codeBg: "#f5f5f4",
  codeFg: "#1c1917",
  codeBorder: "rgba(120, 113, 108, 0.2)",
  codeGutter: "rgba(28, 25, 23, 0.4)",
  inlineCodeBg: "rgba(231, 229, 228, 0.9)",
  inlineCodeFg: "#9f1239",
  inlineCodeBorder: "transparent",
  hljsComment: "#78716c",
  hljsKeyword: "#b45309",
  hljsString: "#15803d",
  hljsNumber: "#c2410c",
  hljsTitle: "#1d4ed8",
  hljsAttr: "#7e22ce",
  hljsType: "#0e7490",
  hljsMeta: "#be123c",
  hljsDeletion: "#e11d48",
  hljsAddition: "#15803d",
  hljsPunctuation: "#44403c",
};

const SEPIA_TOKENS: NotesMarkdownTokenBag = {
  // 旧纸：灰米色底 + 铁胆墨，避免整页发黄滤镜感
  panelBg: "#ebe4d6",
  fg: "#2f241c",
  heading: "#241a14",
  muted: "#6e5b4a",
  link: "#6b3f2a",
  quoteBar: "rgba(74, 55, 40, 0.35)",
  hr: "rgba(74, 55, 40, 0.22)",
  tableBorder: "rgba(74, 55, 40, 0.2)",
  tableHeaderBg: "rgba(74, 55, 40, 0.06)",
  codeBg: "#e0d7c8",
  codeFg: "#2f241c",
  codeBorder: "rgba(74, 55, 40, 0.18)",
  codeGutter: "rgba(47, 36, 28, 0.4)",
  inlineCodeBg: "rgba(74, 55, 40, 0.08)",
  inlineCodeFg: "#5c2e1a",
  inlineCodeBorder: "transparent",
  hljsComment: "#6e5b4a",
  hljsKeyword: "#7a3412",
  hljsString: "#3f5a28",
  hljsNumber: "#8a4b12",
  hljsTitle: "#3a4a6b",
  hljsAttr: "#5a3d6b",
  hljsType: "#3d5c5a",
  hljsMeta: "#7a2e3a",
  hljsDeletion: "#8a2e3a",
  hljsAddition: "#3f5a28",
  hljsPunctuation: "#2f241c",
};

const PRESET_TOKENS: Record<NotesMarkdownThemeId, NotesMarkdownTokenBag> = {
  inherit: INHERIT_TOKENS,
  notion: NOTION_TOKENS,
  paper: PAPER_TOKENS,
  sepia: SEPIA_TOKENS,
  github: GITHUB_TOKENS,
  magazine: MAGAZINE_TOKENS,
  minimal: MINIMAL_TOKENS,
};

const TOKEN_CSS_VARS: ReadonlyArray<{ key: keyof NotesMarkdownTokenBag; css: string }> = [
  { key: "panelBg", css: "--agnx-notes-panel-bg" },
  { key: "fg", css: "--agnx-notes-fg" },
  { key: "heading", css: "--agnx-notes-heading" },
  { key: "muted", css: "--agnx-notes-muted" },
  { key: "link", css: "--agnx-notes-md-link" },
  { key: "quoteBar", css: "--agnx-notes-quote-bar" },
  { key: "hr", css: "--agnx-notes-hr" },
  { key: "tableBorder", css: "--agnx-notes-table-border" },
  { key: "tableHeaderBg", css: "--agnx-notes-table-header-bg" },
  { key: "codeBg", css: "--agnx-notes-code-bg" },
  { key: "codeFg", css: "--agnx-notes-code-fg" },
  { key: "codeBorder", css: "--agnx-notes-code-border" },
  { key: "codeGutter", css: "--agnx-notes-code-gutter" },
  { key: "inlineCodeBg", css: "--agnx-notes-inline-code-bg" },
  { key: "inlineCodeFg", css: "--agnx-notes-inline-code-fg" },
  { key: "inlineCodeBorder", css: "--agnx-notes-inline-code-border" },
  { key: "hljsComment", css: "--agnx-notes-hljs-comment" },
  { key: "hljsKeyword", css: "--agnx-notes-hljs-keyword" },
  { key: "hljsString", css: "--agnx-notes-hljs-string" },
  { key: "hljsNumber", css: "--agnx-notes-hljs-number" },
  { key: "hljsTitle", css: "--agnx-notes-hljs-title" },
  { key: "hljsAttr", css: "--agnx-notes-hljs-attr" },
  { key: "hljsType", css: "--agnx-notes-hljs-type" },
  { key: "hljsMeta", css: "--agnx-notes-hljs-meta" },
  { key: "hljsDeletion", css: "--agnx-notes-hljs-deletion" },
  { key: "hljsAddition", css: "--agnx-notes-hljs-addition" },
  { key: "hljsPunctuation", css: "--agnx-notes-hljs-punctuation" },
];

let cachedTheme: NotesMarkdownThemeId = DEFAULT_THEME;
const listeners = new Set<() => void>();

export function parseNotesMarkdownThemeId(value: unknown): NotesMarkdownThemeId {
  if (value === "auto") {
    return "inherit";
  }
  if (
    value === "inherit" ||
    value === "notion" ||
    value === "paper" ||
    value === "sepia" ||
    value === "github" ||
    value === "magazine" ||
    value === "minimal"
  ) {
    return value;
  }
  return DEFAULT_THEME;
}

export function getCachedNotesMarkdownTheme(): NotesMarkdownThemeId {
  return cachedTheme;
}

export function subscribeNotesMarkdownTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitThemeListeners(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

function setCachedTheme(next: NotesMarkdownThemeId): void {
  if (cachedTheme === next) {
    return;
  }
  cachedTheme = next;
  emitThemeListeners();
}

export function resolveNotesMarkdownTokens(
  preference: NotesMarkdownThemeId = cachedTheme,
): NotesMarkdownTokenBag {
  return PRESET_TOKENS[preference] ?? INHERIT_TOKENS;
}

export function applyNotesMarkdownThemeToHost(
  host: HTMLElement | null | undefined,
  preference: NotesMarkdownThemeId = cachedTheme,
): void {
  if (!host) {
    return;
  }
  const tokens = resolveNotesMarkdownTokens(preference);
  for (const { key, css } of TOKEN_CSS_VARS) {
    // inherit：不写死 fg/heading，让宿主 fallback 到壳 foreground（避免白底浅字）
    if (
      preference === "inherit" &&
      (key === "fg" || key === "heading" || key === "muted" || key === "link")
    ) {
      host.style.removeProperty(css);
      continue;
    }
    host.style.setProperty(css, tokens[key]);
  }
  host.dataset.notesMarkdownTheme = preference;
  const lightPack = preference === "notion" || preference === "paper" || preference === "sepia";
  host.style.setProperty(
    "--agnx-notes-fold-hover-bg",
    lightPack ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.1)",
  );
  host.style.setProperty("--agnx-notes-fold-hover-fg", lightPack ? tokens.fg : "#ffffff");
  if (preference === "inherit") {
    host.style.removeProperty("--agnx-notes-chip-muted");
  } else if (tokens.muted !== "inherit") {
    host.style.setProperty("--agnx-notes-chip-muted", tokens.muted);
  }
}

export function applyNotesMarkdownThemeToAllHosts(
  preference: NotesMarkdownThemeId = cachedTheme,
): void {
  if (typeof document === "undefined") {
    return;
  }
  for (const host of document.querySelectorAll(
    ".agnx-notes-tiptap, .agnx-notes-source-host, [data-notes-markdown-surface='1']",
  )) {
    if (host instanceof HTMLElement) {
      applyNotesMarkdownThemeToHost(host, preference);
    }
  }
}

export async function loadNotesMarkdownTheme(
  host: WorkspaceAppHostApi,
): Promise<NotesMarkdownThemeId> {
  try {
    let value = await host.config.get<unknown>({
      scope: "app",
      appId: NOTES_APP_ID,
      key: NOTES_MARKDOWN_THEME_CONFIG_KEY,
      defaultValue: null,
    });
    if (value == null) {
      value = await host.config.get<unknown>({
        scope: "app",
        appId: NOTES_APP_ID,
        key: NOTES_PROSE_THEME_CONFIG_KEY,
        defaultValue: DEFAULT_THEME,
      });
    }
    const parsed = parseNotesMarkdownThemeId(value);
    setCachedTheme(parsed);
    applyNotesMarkdownThemeToAllHosts(parsed);
    return parsed;
  } catch {
    setCachedTheme(DEFAULT_THEME);
    applyNotesMarkdownThemeToAllHosts(DEFAULT_THEME);
    return DEFAULT_THEME;
  }
}

export async function saveNotesMarkdownTheme(
  host: WorkspaceAppHostApi,
  theme: NotesMarkdownThemeId,
): Promise<void> {
  const next = parseNotesMarkdownThemeId(theme);
  setCachedTheme(next);
  applyNotesMarkdownThemeToAllHosts(next);
  await host.config.set({
    scope: "app",
    appId: NOTES_APP_ID,
    key: NOTES_MARKDOWN_THEME_CONFIG_KEY,
    value: next,
  });
}

export function bindNotesMarkdownThemeConfig(host: WorkspaceAppHostApi): () => void {
  void loadNotesMarkdownTheme(host);
  return host.config.subscribe<unknown>({
    scope: "app",
    appId: NOTES_APP_ID,
    key: NOTES_MARKDOWN_THEME_CONFIG_KEY,
    defaultValue: DEFAULT_THEME,
    emitCurrent: true,
    listener: (event) => {
      const next = parseNotesMarkdownThemeId(event.value);
      setCachedTheme(next);
      applyNotesMarkdownThemeToAllHosts(next);
    },
  });
}

export function notesMarkdownThemeLabel(id: NotesMarkdownThemeId): string {
  return NOTES_MARKDOWN_THEME_OPTIONS.find((row) => row.id === id)?.label ?? id;
}

/** ActionBar / 底栏徽章色：专属亮色包必须用 token，避免壳层浅色图标落在白底上看不见。 */
export function resolveNotesChromeColors(
  themeId: NotesMarkdownThemeId,
  shell: {
    foregroundMuted: string;
    accent: string;
    border: string;
    surface2: string;
  },
): {
  mutedColor: string;
  accentColor: string;
  badgeFg: string;
  badgeBorder: string;
  badgeBg: string;
} {
  if (themeId === "inherit") {
    return {
      mutedColor: shell.foregroundMuted,
      accentColor: shell.accent,
      badgeFg: shell.foregroundMuted,
      badgeBorder: shell.border,
      badgeBg: shell.surface2,
    };
  }
  const tokens = resolveNotesMarkdownTokens(themeId);
  const muted = !tokens.muted || tokens.muted === "inherit" ? shell.foregroundMuted : tokens.muted;
  const accent =
    !tokens.link || tokens.link === "inherit" || tokens.link.startsWith("var(")
      ? shell.accent
      : tokens.link;
  const lightPack = themeId === "notion" || themeId === "paper" || themeId === "sepia";
  return {
    mutedColor: muted,
    accentColor: accent,
    badgeFg: muted,
    badgeBorder: !tokens.hr || tokens.hr === "inherit" ? shell.border : tokens.hr,
    badgeBg: lightPack ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.06)",
  };
}

/** 兼容旧导出名 */
export type NotesProseThemeId = NotesMarkdownThemeId;
export const NOTES_PROSE_THEME_OPTIONS = NOTES_MARKDOWN_THEME_OPTIONS;
export const parseNotesProseThemeId = parseNotesMarkdownThemeId;
export const getCachedNotesProseTheme = getCachedNotesMarkdownTheme;
export const subscribeNotesProseTheme = subscribeNotesMarkdownTheme;
export const applyNotesProseThemeToHost = applyNotesMarkdownThemeToHost;
export const applyNotesProseThemeToAllHosts = applyNotesMarkdownThemeToAllHosts;
export const bindNotesProseThemeConfig = bindNotesMarkdownThemeConfig;
export const saveNotesProseTheme = saveNotesMarkdownTheme;
export const notesProseThemeLabel = notesMarkdownThemeLabel;
export const resolveNotesProseTokens = resolveNotesMarkdownTokens;
export const resolveNotesProseChromeColors = resolveNotesChromeColors;
