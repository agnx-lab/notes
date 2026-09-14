// 场景：表格单元格/表头 — colwidth 与列文本对齐 textAlign 往返持久化。
import { mergeAttributes } from "@tiptap/core";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { parseNotesMediaAlign, type NotesMediaAlign } from "./notes-media-align";

function parseColwidthAttr(element: HTMLElement): number[] | null {
  const raw = element.getAttribute("data-colwidth") || element.getAttribute("colwidth") || "";
  if (raw.trim()) {
    const widths = raw
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    return widths.length > 0 ? widths : null;
  }
  const styleWidth = element.style?.width;
  if (styleWidth) {
    const n = Number.parseInt(styleWidth, 10);
    if (Number.isFinite(n) && n > 0) {
      return [n];
    }
  }
  return null;
}

function parseTextAlignAttr(element: HTMLElement): NotesMediaAlign {
  const fromData =
    element.getAttribute("data-text-align") ||
    element.dataset.textAlign ||
    element.style?.textAlign ||
    "";
  return parseNotesMediaAlign(fromData);
}

/** 合并 width + text-align，避免两套 attr 各写 style 互相覆盖。 */
export function renderNotesTableCellExtraAttrs(attributes: {
  colwidth?: unknown;
  textAlign?: unknown;
}): Record<string, string> {
  const out: Record<string, string> = {};
  const widths = Array.isArray(attributes.colwidth)
    ? (attributes.colwidth as unknown[])
        .map((w) => (typeof w === "number" ? w : Number.parseInt(String(w), 10)))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const styleParts: string[] = [];
  if (widths.length > 0) {
    const joined = widths.join(",");
    const first = widths[0]!;
    out["data-colwidth"] = joined;
    out.colwidth = joined;
    styleParts.push(`width: ${first}px`);
  }
  const align = parseNotesMediaAlign(attributes.textAlign);
  if (align !== "left") {
    out["data-text-align"] = align;
    styleParts.push(`text-align: ${align}`);
  }
  if (styleParts.length > 0) {
    out.style = styleParts.join("; ");
  }
  return out;
}

const colwidthAttribute = {
  default: null as number[] | null,
  parseHTML: (element: HTMLElement) => parseColwidthAttr(element),
  renderHTML: () => ({}),
};

const textAlignAttribute = {
  default: "left" as NotesMediaAlign,
  parseHTML: (element: HTMLElement) => parseTextAlignAttr(element),
  renderHTML: () => ({}),
};

export const NotesTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: colwidthAttribute,
      textAlign: textAlignAttribute,
    };
  },

  renderHTML({
    node,
    HTMLAttributes,
  }: {
    node: { attrs: { colwidth?: unknown; textAlign?: unknown } };
    HTMLAttributes: Record<string, unknown>;
  }) {
    return [
      "td",
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        renderNotesTableCellExtraAttrs(node.attrs),
      ),
      0,
    ];
  },
});

export const NotesTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: colwidthAttribute,
      textAlign: textAlignAttribute,
    };
  },

  renderHTML({
    node,
    HTMLAttributes,
  }: {
    node: { attrs: { colwidth?: unknown; textAlign?: unknown } };
    HTMLAttributes: Record<string, unknown>;
  }) {
    return [
      "th",
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        renderNotesTableCellExtraAttrs(node.attrs),
      ),
      0,
    ];
  },
});
