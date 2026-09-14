// 场景：Markdown 粘贴粗判与表格规范化单测。
import { describe, expect, it } from "vitest";
import {
  looksLikeMarkdown,
  looksLikeMarkdownTable,
  normalizeMarkdownForPaste,
} from "./markdown-paste";

describe("looksLikeMarkdown", () => {
  it("detects headings lists and emphasis", () => {
    expect(looksLikeMarkdown("# 标题\n\n正文")).toBe(true);
    expect(looksLikeMarkdown("- a\n- b")).toBe(true);
    expect(looksLikeMarkdown("hello **world**")).toBe(true);
    expect(looksLikeMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |")).toBe(true);
    expect(looksLikeMarkdown("plain text only")).toBe(false);
  });

  it("detects task lists and fenced code", () => {
    expect(looksLikeMarkdown("- [ ] todo\n- [x] done")).toBe(true);
    expect(looksLikeMarkdown("```ts\nconst a = 1\n```")).toBe(true);
  });
});

describe("looksLikeMarkdownTable", () => {
  it("detects gfm header + separator", () => {
    expect(looksLikeMarkdownTable("| 序 | 阶段 |\n| --- | --- |\n| R0 | T0 |")).toBe(true);
    expect(looksLikeMarkdownTable("| only one line |")).toBe(false);
  });
});

describe("normalizeMarkdownForPaste", () => {
  it("inserts blank line before table and normalizes dashes", () => {
    const raw = "标题\n| a | b |\n| ─── | ─── |\n| 1 | 2 |";
    const next = normalizeMarkdownForPaste(raw);
    expect(next).toContain("标题\n\n| a | b |");
    expect(next).toContain("| --- | --- |");
  });
});
