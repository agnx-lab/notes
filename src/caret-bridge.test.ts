// 场景：光标桥 — Markdown 坐标行/列与 marks 前缀单测。
import { describe, expect, it } from "vitest";
import {
  lineColumnToOffset,
  offsetToLineColumn,
  plainInnerToMdOffset,
  mdOffsetToPlainInner,
  __test,
} from "./caret-bridge";
import { Schema } from "@tiptap/pm/model";

describe("caret line/column math", () => {
  it("round-trips offset ↔ line/column on multiline md", () => {
    const md = "# 标题\n\n正文 **粗**\n第三行";
    const offset = lineColumnToOffset(md, { line: 2, column: 3 });
    expect(offsetToLineColumn(md, offset)).toEqual({ line: 2, column: 3 });
  });

  it("clamps past EOF", () => {
    const md = "a\nb";
    expect(lineColumnToOffset(md, { line: 99, column: 99 })).toBe(md.length);
  });
});

describe("marks wrap", () => {
  it("wraps bold", () => {
    expect(
      __test.serializeTextWithMarks("粗", [{ type: { name: "bold" }, attrs: {} } as never]),
    ).toBe("**粗**");
  });
});

describe("plain ↔ md offset on heading schema-lite", () => {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      text: { group: "inline" },
      paragraph: {
        content: "inline*",
        group: "block",
        parseDOM: [{ tag: "p" }],
        toDOM: () => ["p", 0],
      },
      heading: {
        attrs: { level: { default: 1 } },
        content: "inline*",
        group: "block",
        defining: true,
        parseDOM: [
          { tag: "h1", attrs: { level: 1 } },
          { tag: "h2", attrs: { level: 2 } },
        ],
        toDOM: (node) => [`h${node.attrs.level}`, 0],
      },
    },
    marks: {
      bold: {
        parseDOM: [{ tag: "strong" }],
        toDOM: () => ["strong", 0],
      },
    },
  });

  it("heading prefix: plain 0 → md after '# '", () => {
    const node = schema.node("heading", { level: 1 }, [schema.text("标题")]);
    expect(plainInnerToMdOffset(node, 0)).toBe(2); // "# "
    expect(plainInnerToMdOffset(node, 2)).toBe(4); // "# 标题" 光标在「题」前
  });

  it("bold open markers count in md offset", () => {
    const bold = schema.marks.bold.create();
    const node = schema.node("paragraph", null, [schema.text("正文 "), schema.text("粗", [bold])]);
    // plain 在「粗」前 = 3 ("正文 ".length)
    expect(plainInnerToMdOffset(node, 3)).toBe("正文 **".length);
    // 反向
    expect(mdOffsetToPlainInner(node, "正文 **".length)).toBe(3);
  });
});
