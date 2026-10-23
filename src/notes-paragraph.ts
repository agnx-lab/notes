// 场景：段落 Markdown 往返 — 空段（图间回车）写成 <p><br></p>，刷新后不丢。
import { Paragraph } from "@tiptap/extension-paragraph";

export function isVisuallyEmptyParagraph(node: {
  content: { size: number };
  childCount: number;
  firstChild?: { type: { name: string } } | null;
}): boolean {
  if (node.content.size === 0) {
    return true;
  }
  // 仅含 hardBreak 的段（部分输入法/Enter 路径）同样视为空段占位
  return node.childCount === 1 && node.firstChild?.type.name === "hardBreak";
}

export function serializeNotesParagraphMarkdown(
  state: {
    write: (text: string) => void;
    closeBlock: (node: unknown) => void;
    renderInline: (node: unknown) => void;
  },
  node: {
    content: { size: number };
    childCount: number;
    firstChild?: { type: { name: string } } | null;
  },
): void {
  if (isVisuallyEmptyParagraph(node)) {
    state.write("<p><br></p>");
    state.closeBlock(node);
    return;
  }
  state.renderInline(node);
  state.closeBlock(node);
}

/**
 * 覆盖 tiptap-markdown 默认：空 paragraph 序列化成空白，相邻图片间的回车刷新后消失。
 */
export const NotesParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize: serializeNotesParagraphMarkdown,
        parse: {},
      },
    };
  },
});
