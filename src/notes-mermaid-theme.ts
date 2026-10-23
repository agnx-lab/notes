// 场景：Notes Mermaid 主题偏好 — host.config 落盘；NodeView 订阅后重渲。
import type { WorkspaceAppHostApi } from "@agnx-lab/app-sdk";
import { NOTES_APP_ID } from "./ids";

export const NOTES_MERMAID_THEME_CONFIG_KEY = "mermaid.theme";

/** Mermaid 官方主题 + auto（跟随壳明暗）。 */
export type NotesMermaidThemeId = "auto" | "default" | "dark" | "forest" | "neutral" | "blue";

export const NOTES_MERMAID_THEME_OPTIONS: ReadonlyArray<{
  id: NotesMermaidThemeId;
  label: string;
}> = [
  { id: "auto", label: "自动" },
  { id: "default", label: "亮色" },
  { id: "blue", label: "蓝色" },
  { id: "dark", label: "暗色" },
  { id: "forest", label: "森林" },
  { id: "neutral", label: "中性" },
];

const DEFAULT_THEME: NotesMermaidThemeId = "default";

let cachedTheme: NotesMermaidThemeId = DEFAULT_THEME;
const listeners = new Set<() => void>();

export function parseNotesMermaidThemeId(value: unknown): NotesMermaidThemeId {
  if (
    value === "auto" ||
    value === "default" ||
    value === "dark" ||
    value === "forest" ||
    value === "neutral" ||
    value === "blue"
  ) {
    return value;
  }
  return DEFAULT_THEME;
}

export function getCachedNotesMermaidTheme(): NotesMermaidThemeId {
  return cachedTheme;
}

export function subscribeNotesMermaidTheme(listener: () => void): () => void {
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

function setCachedTheme(next: NotesMermaidThemeId): void {
  if (cachedTheme === next) {
    return;
  }
  cachedTheme = next;
  emitThemeListeners();
}

export async function loadNotesMermaidTheme(
  host: WorkspaceAppHostApi,
): Promise<NotesMermaidThemeId> {
  try {
    const value = await host.config.get<unknown>({
      scope: "app",
      appId: NOTES_APP_ID,
      key: NOTES_MERMAID_THEME_CONFIG_KEY,
      defaultValue: DEFAULT_THEME,
    });
    const parsed = parseNotesMermaidThemeId(value);
    setCachedTheme(parsed);
    return parsed;
  } catch {
    setCachedTheme(DEFAULT_THEME);
    return DEFAULT_THEME;
  }
}

export async function saveNotesMermaidTheme(
  host: WorkspaceAppHostApi,
  theme: NotesMermaidThemeId,
): Promise<void> {
  const next = parseNotesMermaidThemeId(theme);
  setCachedTheme(next);
  await host.config.set({
    scope: "app",
    appId: NOTES_APP_ID,
    key: NOTES_MERMAID_THEME_CONFIG_KEY,
    value: next,
  });
}

/** 激活时订阅 config，保持缓存与落盘一致。 */
export function bindNotesMermaidThemeConfig(host: WorkspaceAppHostApi): () => void {
  void loadNotesMermaidTheme(host);
  return host.config.subscribe<unknown>({
    scope: "app",
    appId: NOTES_APP_ID,
    key: NOTES_MERMAID_THEME_CONFIG_KEY,
    defaultValue: DEFAULT_THEME,
    emitCurrent: true,
    listener: (event) => {
      setCachedTheme(parseNotesMermaidThemeId(event.value));
    },
  });
}

function detectShellPrefersDark(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const root = document.documentElement;
  const body = document.body;
  const attr =
    root.getAttribute("data-theme") ||
    root.getAttribute("data-color-scheme") ||
    body?.getAttribute("data-theme") ||
    "";
  if (/dark/i.test(attr) || root.classList.contains("dark") || body?.classList.contains("dark")) {
    return true;
  }
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return true;
  }
  try {
    const bg = getComputedStyle(body || root).backgroundColor;
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bg);
    if (match) {
      const r = Number(match[1]);
      const g = Number(match[2]);
      const b = Number(match[3]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.45;
    }
  } catch {
    // ignore
  }
  return false;
}

/** Mermaid initialize 用的 theme + 可选自定义变量（蓝色主题）。 */
export function resolveMermaidThemeConfig(preference: NotesMermaidThemeId = cachedTheme): {
  theme: "default" | "dark" | "forest" | "neutral" | "base";
  themeVariables?: Record<string, string | boolean>;
} {
  if (preference === "blue") {
    // 浅蓝底 + 蓝描边 + 深字（对标常见流程图浅色蓝皮肤，非实心蓝块）
    return {
      theme: "base",
      themeVariables: {
        darkMode: false,
        background: "#ffffff",
        primaryColor: "#dbeafe",
        primaryTextColor: "#1e3a8a",
        primaryBorderColor: "#3b82f6",
        secondaryColor: "#eff6ff",
        tertiaryColor: "#f8fafc",
        lineColor: "#94a3b8",
        textColor: "#0f172a",
        mainBkg: "#dbeafe",
        nodeBorder: "#3b82f6",
        clusterBkg: "#f1f5f9",
        clusterBorder: "#93c5fd",
        titleColor: "#1e3a8a",
        edgeLabelBackground: "#ffffff",
        actorBkg: "#dbeafe",
        actorBorder: "#3b82f6",
        actorTextColor: "#1e3a8a",
        signalColor: "#64748b",
        labelBoxBkgColor: "#eff6ff",
        labelTextColor: "#1e3a8a",
      },
    };
  }
  if (preference === "auto") {
    return { theme: detectShellPrefersDark() ? "dark" : "default" };
  }
  return { theme: preference };
}

/**
 * 单图预览底色：亮主题图配亮底、暗主题图配暗底，避免暗笔记里亮主题字看不清。
 */
export function resolveMermaidPreviewSurface(preference: NotesMermaidThemeId = cachedTheme): {
  scheme: "light" | "dark";
  background: string;
  border: string;
} {
  const resolved = resolveMermaidThemeConfig(preference).theme;
  if (resolved === "dark") {
    return {
      scheme: "dark",
      background: "#0f172a",
      border: "rgba(255, 255, 255, 0.18)",
    };
  }
  if (resolved === "forest") {
    return {
      scheme: "light",
      background: "#f4f9f4",
      border: "rgba(34, 97, 58, 0.22)",
    };
  }
  if (resolved === "neutral") {
    return {
      scheme: "light",
      background: "#f5f5f5",
      border: "rgba(0, 0, 0, 0.12)",
    };
  }
  // default / base(blue)
  return {
    scheme: "light",
    background: "#ffffff",
    border: "rgba(0, 0, 0, 0.12)",
  };
}

/** @deprecated 用 resolveMermaidThemeConfig；保留给旧调用。 */
export function resolveMermaidInitializeTheme(
  preference: NotesMermaidThemeId = cachedTheme,
): "default" | "dark" | "forest" | "neutral" | "base" {
  return resolveMermaidThemeConfig(preference).theme;
}

export function notesMermaidThemeLabel(id: NotesMermaidThemeId): string {
  return NOTES_MERMAID_THEME_OPTIONS.find((row) => row.id === id)?.label ?? id;
}

/** 单图主题：inherit = 跟随应用全局 mermaid.theme。 */
export type NotesMermaidBlockThemeId = "inherit" | NotesMermaidThemeId;

export const NOTES_MERMAID_BLOCK_THEME_OPTIONS: ReadonlyArray<{
  id: NotesMermaidBlockThemeId;
  label: string;
}> = [{ id: "inherit", label: "跟随全局" }, ...NOTES_MERMAID_THEME_OPTIONS];

export function parseNotesMermaidBlockThemeId(value: unknown): NotesMermaidBlockThemeId {
  if (value == null || value === "" || value === "inherit") {
    return "inherit";
  }
  return parseNotesMermaidThemeId(value);
}

export function notesMermaidBlockThemeLabel(id: NotesMermaidBlockThemeId): string {
  return NOTES_MERMAID_BLOCK_THEME_OPTIONS.find((row) => row.id === id)?.label ?? id;
}

/** 单图有效主题：有覆盖用覆盖，否则用全局缓存。 */
export function resolveNotesMermaidBlockTheme(
  blockTheme: unknown,
  globalTheme: NotesMermaidThemeId = cachedTheme,
): NotesMermaidThemeId {
  const parsed = parseNotesMermaidBlockThemeId(blockTheme);
  return parsed === "inherit" ? globalTheme : parsed;
}

/**
 * 解析 fence 信息串：`mermaid` / `mermaid theme=dark`。
 * 返回 null theme 表示跟随全局。
 */
export function parseNotesMermaidFenceLanguage(value: unknown): {
  isMermaid: boolean;
  theme: NotesMermaidThemeId | null;
} {
  if (typeof value !== "string") {
    return { isMermaid: false, theme: null };
  }
  const raw = value.trim();
  if (!raw) {
    return { isMermaid: false, theme: null };
  }
  const match = /^mermaid(?:\s+theme=([a-z]+))?$/i.exec(raw);
  if (!match) {
    return { isMermaid: false, theme: null };
  }
  const themeRaw = match[1];
  if (!themeRaw) {
    return { isMermaid: true, theme: null };
  }
  const theme = parseNotesMermaidThemeId(themeRaw);
  // parse 未知值会回落 default；仅当字面量合法才算覆盖
  if (
    themeRaw === "auto" ||
    themeRaw === "default" ||
    themeRaw === "dark" ||
    themeRaw === "forest" ||
    themeRaw === "neutral" ||
    themeRaw === "blue"
  ) {
    return { isMermaid: true, theme };
  }
  return { isMermaid: true, theme: null };
}

export function readNotesMermaidBlockThemeFromAttrs(attrs: {
  language?: unknown;
  mermaidTheme?: unknown;
}): NotesMermaidBlockThemeId {
  const fromAttr = attrs.mermaidTheme;
  if (typeof fromAttr === "string" && fromAttr.trim()) {
    return parseNotesMermaidBlockThemeId(fromAttr);
  }
  const fence = parseNotesMermaidFenceLanguage(attrs.language);
  if (fence.theme) {
    return fence.theme;
  }
  return "inherit";
}
