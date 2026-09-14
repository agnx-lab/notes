// 场景：大块 Markdown 粘贴 — 高优先级拦截；表格/列表规范化后按块解析插入。
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { repairGfmTables } from "./repair-gfm-tables";

/** 粗判剪贴板是否像 Markdown 源（标题/列表/表格/围栏等）。 */
export function looksLikeMarkdown(text: string): boolean {
  const sample = text.slice(0, 12_000);
  if (!sample.trim()) {
    return false;
  }
  return (
    /(?:^|\n)\s{0,3}#{1,6}\s+\S/.test(sample) ||
    /(?:^|\n)\s*[-*+]\s+\S/.test(sample) ||
    /(?:^|\n)\s*\d+\.\s+\S/.test(sample) ||
    /(?:^|\n)\s*-\s+\[[ xX]\]\s+\S/.test(sample) ||
    /(?:^|\n)\s*>\s+\S/.test(sample) ||
    /(?:^|\n)\s*```/.test(sample) ||
    /(?:^|\n)\s*---\s*(?:\n|$)/.test(sample) ||
    /\*\*[^*\n]+\*\*/.test(sample) ||
    /__[^_\n]+__/.test(sample) ||
    /`[^`\n]+`/.test(sample) ||
    /\[[^\]]+\]\([^)]+\)/.test(sample) ||
    looksLikeMarkdownTable(sample)
  );
}

/** GFM 表格：表头行 + 分隔行。 */
export function looksLikeMarkdownTable(text: string): boolean {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length - 1; i += 1) {
    const row = lines[i] ?? "";
    const sep = lines[i + 1] ?? "";
    if (!/\|/.test(row) || !/\|/.test(sep)) {
      continue;
    }
    if (!isMarkdownTableSeparator(sep)) {
      continue;
    }
    if (countTableCells(row) >= 2) {
      return true;
    }
  }
  return false;
}

function isMarkdownTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-")) {
    return false;
  }
  // 允许 --- / :--- / ---: / :---:，以及全角横线变体。
  const normalized = trimmed.replace(/[─–—﹣－]/g, "-");
  return /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(normalized);
}

function countTableCells(line: string): number {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  if (!trimmed.includes("|")) {
    return trimmed.trim() ? 1 : 0;
  }
  return trimmed.split("|").length;
}

/**
 * 粘贴前轻量规范化：统一换行、表格分隔线横线、去掉表行多余空格噪声。
 */
export function normalizeMarkdownForPaste(text: string): string {
  let next = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  next = next
    .split("\n")
    .map((line) => {
      if (!line.includes("|") || (!/-{2,}/.test(line) && !/[─–—﹣－]{2,}/.test(line))) {
        return line;
      }
      if (!isMarkdownTableSeparator(line) && !/^\s*\|?\s*:?[-─–—﹣－]{2,}/.test(line)) {
        return line;
      }
      return line.replace(/[─–—﹣－]/g, "-");
    })
    .join("\n");
  next = repairGfmTables(next);
  // 表格前若紧贴非空行，补空行，避免 markdown-it 不认表。
  next = next.replace(/([^\n])\n(\|.+\|\n\s*\|?\s*:?-)/g, "$1\n\n$2");
  return next;
}

export function createMarkdownPasteExtension() {
  return Extension.create({
    name: "agnxMarkdownPaste",
    priority: 1200,
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        new Plugin({
          key: new PluginKey("agnxMarkdownPaste"),
          props: {
            handlePaste: (_view, event) => {
              const raw = event.clipboardData?.getData("text/plain");
              if (!raw) {
                return false;
              }
              const text = normalizeMarkdownForPaste(raw);
              if (!looksLikeMarkdown(text)) {
                return false;
              }
              const parser = (
                editor.storage as {
                  markdown?: {
                    parser?: { parse: (content: string, options?: { inline?: boolean }) => string };
                  };
                }
              ).markdown?.parser;
              if (!parser) {
                return false;
              }

              const multiline = text.includes("\n");
              const forceBlock =
                multiline || looksLikeMarkdownTable(text) || /(?:^|\n)\s*```/.test(text);
              const html = parser.parse(text, {
                inline: !forceBlock && text.length < 160,
              });
              if (!html.trim()) {
                return false;
              }

              // 块级粘贴：用 TipTap insertContent(HTML)，比裸 Slice 更稳（列表/表格边界）。
              const ok = editor
                .chain()
                .focus()
                .insertContent(html, {
                  parseOptions: { preserveWhitespace: false },
                })
                .run();
              if (!ok) {
                return false;
              }
              event.preventDefault();
              return true;
            },
          },
        }),
      ];
    },
  });
}
