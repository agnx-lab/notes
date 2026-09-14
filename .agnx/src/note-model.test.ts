// 场景：笔记模型纯函数单测（大纲 / 字数 / 版本快照判定）。
import { describe, expect, it } from "vitest";
import {
  countChars,
  countWords,
  extractOutline,
  extractTitleFromMarkdown,
  noteToMarkdownDocument,
  shouldSnapshotBeforeRestore,
  shouldSnapshotVersion,
} from "./note-model";

describe("note-model", () => {
  it("extracts markdown outline", () => {
    const outline = extractOutline("# A\n\npara\n## B\n### C\n");
    expect(outline).toEqual([
      { level: 1, text: "A", line: 0, occurrence: 0 },
      { level: 2, text: "B", line: 3, occurrence: 0 },
      { level: 3, text: "C", line: 4, occurrence: 0 },
    ]);
  });

  it("tracks duplicate heading occurrence", () => {
    const outline = extractOutline("# A\n## B\n# A\n");
    expect(outline.map((h) => h.occurrence)).toEqual([0, 0, 1]);
  });
  it("counts cjk and latin words", () => {
    expect(countWords("你好世界")).toBe(4);
    expect(countWords("hello world")).toBe(2);
    expect(countChars("a b 你好")).toBe(4);
  });

  it("builds markdown document", () => {
    expect(noteToMarkdownDocument({ title: "T", body: "body" })).toBe("# T\n\nbody\n");
    expect(noteToMarkdownDocument({ title: "Ignored", body: "# Real\n\nbody" })).toBe(
      "# Real\n\nbody\n",
    );
  });

  it("extracts title from first H1", () => {
    expect(extractTitleFromMarkdown("# Hello\n\npara")).toBe("Hello");
    expect(extractTitleFromMarkdown("## Only H2\n")).toBe("未命名笔记");
  });

  it("gates version snapshots", () => {
    expect(
      shouldSnapshotVersion({
        previous: { title: "a", body: "b", versions: [], updatedAt: 1 },
        nextTitle: "a",
        nextBody: "b",
      }),
    ).toBe(false);
    expect(
      shouldSnapshotVersion({
        previous: { title: "a", body: "b", versions: [], updatedAt: 1 },
        nextTitle: "a",
        nextBody: "c",
      }),
    ).toBe(true);
  });

  it("does not snapshot on restore when nothing new to keep", () => {
    const versions = [
      { id: "ver_1", title: "old", body: "v1", createdAt: 1 },
      { id: "ver_2", title: "older", body: "v0", createdAt: 0 },
    ];
    // 当前已等于目标
    expect(
      shouldSnapshotBeforeRestore({
        current: { title: "old", body: "v1", versions },
        target: { title: "old", body: "v1" },
      }),
    ).toBe(false);
    // 当前稿已在版本列表里
    expect(
      shouldSnapshotBeforeRestore({
        current: { title: "older", body: "v0", versions },
        target: { title: "old", body: "v1" },
      }),
    ).toBe(false);
    // 当前稿是未入库的新编辑 → 才需要先存一条
    expect(
      shouldSnapshotBeforeRestore({
        current: { title: "draft", body: "unsaved", versions },
        target: { title: "old", body: "v1" },
      }),
    ).toBe(true);
  });
});
