// 场景：富文本 ↔ 源码光标桥 — 以 Markdown 字符串为坐标（行/列），避免 plain textBetween 丢 #/** 前缀。
import type { Editor } from "@tiptap/core";
import type { Mark, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { humanizeMarkdownLinkTargets } from "./notes-link";

export interface NotesCaretPos {
  line: number;
  column: number;
}

export function offsetToLineColumn(text: string, offset: number): NotesCaretPos {
  const normalized = text.replace(/\r\n/g, "\n");
  const safe = Math.max(0, Math.min(offset, normalized.length));
  const before = normalized.slice(0, safe);
  const lines = before.split("\n");
  const line = Math.max(0, lines.length - 1);
  const column = (lines[line] ?? "").length;
  return { line, column };
}

export function lineColumnToOffset(text: string, caret: NotesCaretPos): number {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const line = Math.max(0, Math.min(caret.line, Math.max(0, lines.length - 1)));
  let offset = 0;
  for (let i = 0; i < line; i += 1) {
    offset += (lines[i] ?? "").length + 1;
  }
  const col = Math.max(0, Math.min(caret.column, (lines[line] ?? "").length));
  return offset + col;
}

export function plainTextToLineColumn(plainBeforeCursor: string): NotesCaretPos {
  return offsetToLineColumn(plainBeforeCursor, plainBeforeCursor.length);
}

function readMarkdown(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
  const md = storage.markdown?.getMarkdown?.();
  if (typeof md === "string") {
    return humanizeMarkdownLinkTargets(md.replace(/\r\n/g, "\n"));
  }
  return humanizeMarkdownLinkTargets(editor.getText().replace(/\r\n/g, "\n"));
}

const MARK_ORDER = ["code", "bold", "italic", "strike", "link"] as const;

function markOpenClose(mark: Mark): { open: string; close: string } {
  switch (mark.type.name) {
    case "bold":
      return { open: "**", close: "**" };
    case "italic":
      return { open: "*", close: "*" };
    case "strike":
      return { open: "~~", close: "~~" };
    case "code":
      return { open: "`", close: "`" };
    case "link": {
      const href = typeof mark.attrs.href === "string" ? mark.attrs.href : "";
      return { open: "[", close: `](${href})` };
    }
    default:
      return { open: "", close: "" };
  }
}

function sortedMarks(marks: readonly Mark[]): Mark[] {
  return [...marks].sort(
    (a, b) =>
      MARK_ORDER.indexOf(a.type.name as (typeof MARK_ORDER)[number]) -
      MARK_ORDER.indexOf(b.type.name as (typeof MARK_ORDER)[number]),
  );
}

/** 文本 + marks → { open, text, close }；open/close 为从外到内的完整包裹。 */
function wrapParts(
  text: string,
  marks: readonly Mark[],
): { open: string; close: string; text: string } {
  let open = "";
  let close = "";
  // 从外到内：先 link 再 bold…
  for (const mark of sortedMarks(marks)) {
    const { open: o, close: c } = markOpenClose(mark);
    open += o;
    close = c + close;
  }
  return { open, close, text };
}

function serializeTextWithMarks(text: string, marks: readonly Mark[]): string {
  const parts = wrapParts(text, marks);
  return `${parts.open}${parts.text}${parts.close}`;
}

type InlineSeg = { kind: "text"; plain: string; md: string; openLen: number } | { kind: "break" };

function collectInlineSegs(node: ProseMirrorNode): InlineSeg[] {
  const segs: InlineSeg[] = [];
  const walk = (n: ProseMirrorNode) => {
    if (n.isText) {
      const plain = n.text ?? "";
      const parts = wrapParts(plain, n.marks);
      segs.push({
        kind: "text",
        plain,
        md: `${parts.open}${parts.text}${parts.close}`,
        openLen: parts.open.length,
      });
      return;
    }
    if (n.type.name === "hardBreak") {
      segs.push({ kind: "break" });
      return;
    }
    n.forEach((child) => walk(child));
  };
  walk(node);
  return segs;
}

function serializeInlineApprox(node: ProseMirrorNode): string {
  return collectInlineSegs(node)
    .map((s) => (s.kind === "break" ? "\n" : s.md))
    .join("");
}

function blockPrefix(node: ProseMirrorNode): string {
  switch (node.type.name) {
    case "heading": {
      const level = Math.max(1, Math.min(6, Number(node.attrs.level ?? 1)));
      return `${"#".repeat(level)} `;
    }
    case "blockquote":
      return "> ";
    default:
      return "";
  }
}

function serializeListApprox(node: ProseMirrorNode): string {
  const lines: string[] = [];
  let index = 1;
  node.forEach((item) => {
    const content = serializeInlineApprox(item);
    if (node.type.name === "orderedList") {
      lines.push(`${index}. ${content}`);
      index += 1;
    } else if (node.type.name === "taskList") {
      const checked = item.attrs?.checked ? "x" : " ";
      lines.push(`- [${checked}] ${content}`);
    } else {
      lines.push(`- ${content}`);
    }
  });
  return lines.join("\n");
}

/** 单块近似序列化成 MD。 */
export function serializeBlockApprox(node: ProseMirrorNode): string {
  switch (node.type.name) {
    case "heading":
    case "paragraph":
      return `${blockPrefix(node)}${serializeInlineApprox(node)}`;
    case "codeBlock": {
      const lang = typeof node.attrs.language === "string" ? node.attrs.language : "";
      return `\`\`\`${lang}\n${node.textContent}\n\`\`\``;
    }
    case "blockquote":
      return serializeInlineApprox(node)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "horizontalRule":
      return "***";
    case "bulletList":
    case "orderedList":
    case "taskList":
      return serializeListApprox(node);
    case "table":
      return node.textContent || "|  |";
    default:
      return serializeInlineApprox(node);
  }
}

export function buildApproxDocument(editor: Editor): string {
  const parts: string[] = [];
  editor.state.doc.forEach((node) => {
    parts.push(serializeBlockApprox(node));
  });
  return parts.join("\n\n");
}

/** plain 文本偏移 → 块内 MD 偏移（含前缀与 marks）。 */
export function plainInnerToMdOffset(node: ProseMirrorNode, plainInner: number): number {
  if (node.type.name === "codeBlock") {
    const lang = typeof node.attrs.language === "string" ? node.attrs.language : "";
    return 3 + lang.length + 1 + Math.min(plainInner, node.textContent.length);
  }
  if (
    node.type.name === "bulletList" ||
    node.type.name === "orderedList" ||
    node.type.name === "taskList"
  ) {
    // 列表精度有限：前缀约 2 + plain
    return Math.min(serializeBlockApprox(node).length, 2 + plainInner);
  }

  let md = blockPrefix(node).length;
  let plain = 0;
  for (const seg of collectInlineSegs(node)) {
    if (seg.kind === "break") {
      if (plainInner <= plain) {
        return md;
      }
      plain += 1;
      md += 1;
      continue;
    }
    const nextPlain = plain + seg.plain.length;
    if (plainInner < nextPlain) {
      const take = Math.max(0, plainInner - plain);
      return md + seg.openLen + take;
    }
    plain = nextPlain;
    md += seg.md.length;
  }
  return md;
}

/** 块内 MD 偏移 → plain 文本偏移。 */
export function mdOffsetToPlainInner(node: ProseMirrorNode, localMd: number): number {
  const prefixLen = blockPrefix(node).length;
  if (localMd <= prefixLen) {
    return 0;
  }
  if (node.type.name === "codeBlock") {
    const lang = typeof node.attrs.language === "string" ? node.attrs.language : "";
    const bodyStart = 3 + lang.length + 1;
    return Math.max(0, Math.min(node.textContent.length, localMd - bodyStart));
  }
  if (
    node.type.name === "bulletList" ||
    node.type.name === "orderedList" ||
    node.type.name === "taskList"
  ) {
    return Math.max(0, localMd - 2);
  }

  let remaining = localMd - prefixLen;
  let plain = 0;
  for (const seg of collectInlineSegs(node)) {
    if (seg.kind === "break") {
      if (remaining <= 0) {
        return plain;
      }
      if (remaining <= 1) {
        return plain;
      }
      remaining -= 1;
      plain += 1;
      continue;
    }
    if (remaining <= seg.md.length) {
      if (remaining <= seg.openLen) {
        return plain;
      }
      const into = remaining - seg.openLen;
      return plain + Math.min(seg.plain.length, into);
    }
    remaining -= seg.md.length;
    plain += seg.plain.length;
  }
  return plain;
}

/**
 * 富文本选区 → Markdown 行/列（源码面坐标）。
 */
export function caretFromRichEditor(editor: Editor): NotesCaretPos {
  const realMd = readMarkdown(editor);
  const approx = buildApproxDocument(editor);
  const { from } = editor.state.selection;
  let approxOffset = 0;
  let reached = false;

  editor.state.doc.forEach((node, offset) => {
    if (reached) {
      return;
    }
    const piece = serializeBlockApprox(node);
    const nodeEnd = offset + node.nodeSize;
    if (from >= nodeEnd) {
      approxOffset += piece.length + 2;
      return;
    }

    const $from = editor.state.doc.resolve(from);
    let plainInner = 0;
    try {
      if (node.type.name === "heading" || node.type.name === "paragraph") {
        const parent = $from.parent;
        plainInner = parent.textBetween(
          0,
          Math.min($from.parentOffset, parent.content.size),
          "\n",
          "\n",
        ).length;
      } else {
        plainInner = editor.state.doc.textBetween(offset, from, "\n", "\n").length;
      }
    } catch {
      plainInner = 0;
    }

    approxOffset += Math.min(piece.length, plainInnerToMdOffset(node, plainInner));
    reached = true;
  });

  if (!reached) {
    approxOffset = approx.length;
  }

  const approxPos = offsetToLineColumn(approx, Math.max(0, Math.min(approxOffset, approx.length)));
  if (approx === realMd) {
    return approxPos;
  }
  // 近似与真实不一致时：保行号，列夹紧到真实行
  const realLines = realMd.split("\n");
  const line = Math.max(0, Math.min(approxPos.line, Math.max(0, realLines.length - 1)));
  const column = Math.max(0, Math.min(approxPos.column, (realLines[line] ?? "").length));
  return { line, column };
}

/**
 * Markdown 行/列 → 富文本选区。
 */
export function applyCaretToRichEditor(editor: Editor, caret: NotesCaretPos): boolean {
  const realMd = readMarkdown(editor);
  const approx = buildApproxDocument(editor);
  // 用户坐标来自真实源码面；映射到近似文档同行同列
  const wantedInApprox = lineColumnToOffset(approx, {
    line: caret.line,
    column: Math.min(
      caret.column,
      (approx.split("\n")[Math.min(caret.line, approx.split("\n").length - 1)] ?? "").length,
    ),
  });
  void realMd;

  let cursor = 0;
  let targetPos = 1;
  let found = false;

  editor.state.doc.forEach((node, offset) => {
    if (found) {
      return;
    }
    const piece = serializeBlockApprox(node);
    const pieceEnd = cursor + piece.length;
    if (wantedInApprox > pieceEnd + 1) {
      cursor = pieceEnd + 2;
      return;
    }

    const localMd = Math.max(0, wantedInApprox - cursor);
    const plainLocal = mdOffsetToPlainInner(node, localMd);

    let textPos = offset + 1;
    let counted = 0;
    node.descendants((child, childPos) => {
      if (!child.isText) {
        return;
      }
      const abs = offset + 1 + childPos;
      const next = counted + (child.text?.length ?? 0);
      if (plainLocal <= next) {
        textPos = abs + (plainLocal - counted);
        return false;
      }
      counted = next;
    });
    targetPos = Math.max(1, Math.min(textPos, editor.state.doc.content.size));
    found = true;
  });

  if (!found) {
    targetPos = editor.state.doc.content.size;
  }

  editor.chain().focus().setTextSelection(targetPos).run();
  return true;
}

// 供测试：导出 wrap
export const __test = { serializeTextWithMarks, plainInnerToMdOffset, mdOffsetToPlainInner };
