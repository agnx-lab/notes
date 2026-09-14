// 场景：从笔记 body 投影元数据 — id/title/时间/排版/媒体对齐/表格 id·对齐·列宽。
import type { DemoNote } from "./note-model";
import { parseNotesMediaAlign, type NotesMediaAlign } from "./notes-media-align";
import type { NotesTypographyState } from "./notes-typography";
import { resolveImageManagedUri } from "./note-image-model";

export interface NoteMetadataMediaItem {
  kind: "image" | "attachment";
  align: NotesMediaAlign;
  path: string;
}

export interface NoteMetadataTableItem {
  tableId: string;
  align: NotesMediaAlign;
  colWidths: number[];
}

export interface NoteMetadataProjection {
  id: string;
  title: string;
  updatedAt: number;
  typography: NotesTypographyState | null;
  media: NoteMetadataMediaItem[];
  tables: NoteMetadataTableItem[];
}

function parseColWidthsFromCell(cell: Element): number[] {
  const raw = cell.getAttribute("data-colwidth") || cell.getAttribute("colwidth") || "";
  if (raw.trim()) {
    return raw
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  const styleWidth = (cell as HTMLElement).style?.width;
  if (styleWidth) {
    const n = Number.parseInt(styleWidth, 10);
    if (Number.isFinite(n) && n > 0) {
      return [n];
    }
  }
  return [];
}

function collectTableColWidths(table: Element): number[] {
  const firstRow = table.querySelector("tr");
  if (!firstRow) {
    return [];
  }
  const widths: number[] = [];
  for (const cell of Array.from(firstRow.children)) {
    if (cell.tagName !== "TH" && cell.tagName !== "TD") {
      continue;
    }
    const cellWidths = parseColWidthsFromCell(cell);
    widths.push(...(cellWidths.length > 0 ? cellWidths : [0]));
  }
  return widths;
}

function parseHtmlFragments(markdown: string): Document | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }
  try {
    return new DOMParser().parseFromString(`<div id="root">${markdown}</div>`, "text/html");
  } catch {
    return null;
  }
}

function attrFromChunk(attrs: string, name: string): string {
  const re = new RegExp(`(?:^|\\s)${name}=["']([^"']*)["']`, "i");
  return re.exec(attrs)?.[1] ?? "";
}

function pushHtmlImagesFromRegex(markdown: string, media: NoteMetadataMediaItem[]): void {
  const imgRe = /<img\b([^>]*)>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRe.exec(markdown)) != null) {
    const attrs = imgMatch[1] ?? "";
    const src = attrFromChunk(attrs, "src");
    const title = attrFromChunk(attrs, "title");
    const path = resolveImageManagedUri({ src, title }) || title || src;
    media.push({
      kind: "image",
      align: parseNotesMediaAlign(attrFromChunk(attrs, "data-align")),
      path,
    });
  }
}

function pushMarkdownImages(markdown: string, media: NoteMetadataMediaItem[]): void {
  const mdImageRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdImageRe.exec(markdown)) != null) {
    const src = match[2] ?? "";
    const title = match[3] ?? "";
    const path = resolveImageManagedUri({ src, title }) || title || src;
    if (media.some((item) => item.kind === "image" && item.path === path)) {
      continue;
    }
    media.push({ kind: "image", align: "left", path });
  }
}

function extractMediaFromDom(doc: Document): NoteMetadataMediaItem[] {
  const media: NoteMetadataMediaItem[] = [];
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const path =
      resolveImageManagedUri({
        src: img.getAttribute("src") || "",
        title: img.getAttribute("title") || "",
      }) ||
      img.getAttribute("title") ||
      img.getAttribute("src") ||
      "";
    media.push({
      kind: "image",
      align: parseNotesMediaAlign(
        img.getAttribute("data-align") || img.closest("[data-align]")?.getAttribute("data-align"),
      ),
      path,
    });
  }
  for (const el of Array.from(
    doc.querySelectorAll(".agnx-notes-attachment, a[data-notes-attachment]"),
  )) {
    media.push({
      kind: "attachment",
      align: parseNotesMediaAlign(el.getAttribute("data-align")),
      path:
        el.getAttribute("href") || el.getAttribute("data-href") || el.getAttribute("title") || "",
    });
  }
  return media;
}

function extractMediaFromMarkdown(markdown: string): NoteMetadataMediaItem[] {
  const doc = parseHtmlFragments(markdown);
  const media = doc ? extractMediaFromDom(doc) : [];
  if (!doc) {
    pushHtmlImagesFromRegex(markdown, media);
  }
  pushMarkdownImages(markdown, media);
  return media;
}

function parseColWidthsFromAttrChunk(cellAttrs: string): number[] {
  const raw = attrFromChunk(cellAttrs, "data-colwidth") || attrFromChunk(cellAttrs, "colwidth");
  if (raw) {
    const parts = raw
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    return parts.length > 0 ? parts : [0];
  }
  const styleW = /width:\s*(\d+)px/i.exec(cellAttrs)?.[1];
  return styleW ? [Number.parseInt(styleW, 10)] : [0];
}

function extractTablesFromRegex(markdown: string): NoteMetadataTableItem[] {
  const tables: NoteMetadataTableItem[] = [];
  const tableRe = /<table\b([^>]*)>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(markdown)) != null) {
    const attrs = tableMatch[1] ?? "";
    const inner = tableMatch[2] ?? "";
    const colWidths: number[] = [];
    const firstRow = /<tr\b[^>]*>([\s\S]*?)<\/tr>/i.exec(inner)?.[1] ?? "";
    const cellRe = /<(?:th|td)\b([^>]*)>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(firstRow)) != null) {
      colWidths.push(...parseColWidthsFromAttrChunk(cellMatch[1] ?? ""));
    }
    tables.push({
      tableId: attrFromChunk(attrs, "data-table-id"),
      align: parseNotesMediaAlign(attrFromChunk(attrs, "data-align")),
      colWidths,
    });
  }
  return tables;
}

function extractTablesFromMarkdown(markdown: string): NoteMetadataTableItem[] {
  const doc = parseHtmlFragments(markdown);
  if (doc) {
    return Array.from(doc.querySelectorAll("table")).map((table) => ({
      tableId: table.getAttribute("data-table-id") || table.getAttribute("data-tableId") || "",
      align: parseNotesMediaAlign(table.getAttribute("data-align")),
      colWidths: collectTableColWidths(table),
    }));
  }
  return extractTablesFromRegex(markdown);
}

export function getNoteMetadataProjection(
  note: Pick<DemoNote, "id" | "title" | "body" | "updatedAt">,
  options?: { typography?: NotesTypographyState | null },
): NoteMetadataProjection {
  const body = note.body ?? "";
  return {
    id: note.id,
    title: note.title,
    updatedAt: note.updatedAt,
    typography: options?.typography ?? null,
    media: extractMediaFromMarkdown(body),
    tables: extractTablesFromMarkdown(body),
  };
}

/** 转成 host.ui.openDetailSheet 行。 */
export function noteMetadataProjectionToDetailRows(
  projection: NoteMetadataProjection,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: "ID", value: projection.id },
    { label: "标题", value: projection.title },
    {
      label: "更新时间",
      value: new Date(projection.updatedAt).toLocaleString(),
    },
  ];
  if (projection.typography) {
    const t = projection.typography;
    rows.push({
      label: "排版",
      value: `${t.fontSizePx}px / 行距 ${t.lineHeight} / 段距 ${t.paragraphGapEm}em / 宽 ${t.pageWidthPercent}%`,
    });
  }
  if (projection.media.length === 0) {
    rows.push({ label: "媒体", value: "（无）" });
  } else {
    projection.media.forEach((item, index) => {
      rows.push({
        label: `媒体 ${index + 1}`,
        value: `${item.kind} · ${item.align} · ${item.path || "—"}`,
      });
    });
  }
  if (projection.tables.length === 0) {
    rows.push({ label: "表格", value: "（无）" });
  } else {
    projection.tables.forEach((item, index) => {
      const widths =
        item.colWidths.length > 0
          ? item.colWidths.map((w) => (w > 0 ? `${w}px` : "auto")).join(", ")
          : "—";
      rows.push({
        label: `表格 ${index + 1}`,
        value: `id=${item.tableId || "—"} · ${item.align} · cols=[${widths}]`,
      });
    });
  }
  return rows;
}
