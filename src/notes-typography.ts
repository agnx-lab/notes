// 场景：笔记正文排版 — 字号 / 行距 / 段距 / 页面宽度连续滑块与 CSS 变量。

export type NotesTypographyKind = "fontSize" | "lineHeight" | "paragraphSpacing" | "pageWidth";

export interface NotesTypographyState {
  fontSizePx: number;
  lineHeight: number;
  paragraphGapEm: number;
  /** 正文最大宽度占编辑区百分比；默认 100（拉满）。 */
  pageWidthPercent: number;
}

export const DEFAULT_NOTES_TYPOGRAPHY: NotesTypographyState = {
  fontSizePx: 15,
  lineHeight: 1.7,
  paragraphGapEm: 0.75,
  pageWidthPercent: 100,
};

export const NOTES_TYPOGRAPHY_RANGE: Record<
  NotesTypographyKind,
  { min: number; max: number; step: number; unit: string; label: string }
> = {
  fontSize: { min: 12, max: 28, step: 1, unit: "px", label: "字号" },
  lineHeight: { min: 1.2, max: 2.6, step: 0.05, unit: "", label: "行间距" },
  paragraphSpacing: { min: 0.2, max: 2, step: 0.05, unit: "em", label: "段落间距" },
  // 左窄右宽；默认 100% = 拉满编辑区
  pageWidth: { min: 40, max: 100, step: 1, unit: "%", label: "页面宽度" },
};

function clampStep(value: number, min: number, max: number, step: number): number {
  const stepped = Math.round(value / step) * step;
  const clamped = Math.min(max, Math.max(min, stepped));
  // 避免 1.7000000001
  const decimals = String(step).includes(".") ? String(step).split(".")[1]!.length : 0;
  return Number(clamped.toFixed(decimals));
}

export function readNotesTypographyValue(
  state: NotesTypographyState,
  kind: NotesTypographyKind,
): number {
  switch (kind) {
    case "fontSize":
      return state.fontSizePx;
    case "lineHeight":
      return state.lineHeight;
    case "paragraphSpacing":
      return state.paragraphGapEm;
    case "pageWidth":
      return state.pageWidthPercent;
    default:
      return 0;
  }
}

export function setNotesTypographyValue(
  state: NotesTypographyState,
  kind: NotesTypographyKind,
  raw: number,
): NotesTypographyState {
  const range = NOTES_TYPOGRAPHY_RANGE[kind];
  const value = clampStep(raw, range.min, range.max, range.step);
  switch (kind) {
    case "fontSize":
      return { ...state, fontSizePx: value };
    case "lineHeight":
      return { ...state, lineHeight: value };
    case "paragraphSpacing":
      return { ...state, paragraphGapEm: value };
    case "pageWidth":
      return { ...state, pageWidthPercent: value };
    default:
      return state;
  }
}

export function resolveNotesProseMaxWidthCss(pageWidthPercent: number): string {
  const pct = clampStep(pageWidthPercent, 40, 100, 1);
  return `${pct}%`;
}

export function applyNotesTypographyToHost(
  host: HTMLElement | null | undefined,
  state: NotesTypographyState,
): void {
  if (!host) {
    return;
  }
  host.style.setProperty("--agnx-notes-font-size", `${state.fontSizePx}px`);
  host.style.setProperty("--agnx-notes-line-height", String(state.lineHeight));
  host.style.setProperty("--agnx-notes-paragraph-gap", `${state.paragraphGapEm}em`);
  host.style.setProperty(
    "--agnx-notes-prose-max-width",
    resolveNotesProseMaxWidthCss(state.pageWidthPercent),
  );
  host.dataset.notesFontSize = String(state.fontSizePx);
  host.dataset.notesLineHeight = String(state.lineHeight);
  host.dataset.notesParagraphGap = String(state.paragraphGapEm);
  host.dataset.notesPageWidth = String(state.pageWidthPercent);
}

export function formatNotesTypographyValue(
  kind: NotesTypographyKind,
  state: NotesTypographyState,
): string {
  const value = readNotesTypographyValue(state, kind);
  if (kind === "fontSize") {
    return `${value}px`;
  }
  if (kind === "paragraphSpacing") {
    return `${value}em`;
  }
  if (kind === "pageWidth") {
    return `${value}%`;
  }
  return String(value);
}

export function formatNotesTypographyTip(
  kind: NotesTypographyKind,
  state: NotesTypographyState,
): string {
  const range = NOTES_TYPOGRAPHY_RANGE[kind];
  return `${range.label} ${formatNotesTypographyValue(kind, state)}`;
}
