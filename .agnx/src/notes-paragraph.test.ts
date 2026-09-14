// 场景：空段落 Markdown 序列化 — 图间回车应写成 <p><br></p>。
import { describe, expect, it } from "vitest";
import { isVisuallyEmptyParagraph, serializeNotesParagraphMarkdown } from "./notes-paragraph";

describe("notes-paragraph markdown", () => {
  it("detects empty and hardBreak-only paragraphs", () => {
    expect(isVisuallyEmptyParagraph({ content: { size: 0 }, childCount: 0 })).toBe(true);
    expect(
      isVisuallyEmptyParagraph({
        content: { size: 1 },
        childCount: 1,
        firstChild: { type: { name: "hardBreak" } },
      }),
    ).toBe(true);
    expect(
      isVisuallyEmptyParagraph({
        content: { size: 3 },
        childCount: 1,
        firstChild: { type: { name: "text" } },
      }),
    ).toBe(false);
  });

  it("serializes empty paragraphs as html br placeholder", () => {
    const writes: string[] = [];
    const state = {
      write: (t: string) => {
        writes.push(t);
      },
      closeBlock: () => {
        writes.push("\n\n");
      },
      renderInline: () => {
        writes.push("INLINE");
      },
    };

    serializeNotesParagraphMarkdown(state, { content: { size: 0 }, childCount: 0 });
    expect(writes.join("")).toContain("<p><br></p>");

    writes.length = 0;
    serializeNotesParagraphMarkdown(state, {
      content: { size: 3 },
      childCount: 1,
      firstChild: { type: { name: "text" } },
    });
    expect(writes.join("")).toContain("INLINE");
    expect(writes.join("")).not.toContain("<p><br></p>");
  });
});
