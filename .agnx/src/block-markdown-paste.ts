// 场景：块级 Markdown（含 ``` 围栏）粘贴时若光标在 codeBlock 内，先跳出再插入，避免 HTML 被拍扁进源码。
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { looksLikeMarkdown, looksLikeMarkdownTable } from "./markdown-paste";

/** 剪贴板纯文本是否像「应作为文档块插入」的 Markdown（围栏/标题/表）。 */
export function clipboardLooksLikeBlockMarkdown(plain: string): boolean {
  if (!looksLikeMarkdown(plain)) {
    return false;
  }
  return (
    /(?:^|\n)\s*```/.test(plain) ||
    /(?:^|\n)\s{0,3}#{1,6}\s+\S/.test(plain) ||
    looksLikeMarkdownTable(plain)
  );
}

/**
 * 若当前在 codeBlock 内：在块后插入空段并把选区移出。
 * 供粘贴多 fence / 标题等块级 Markdown 前调用。
 */
export function prepareBlockMarkdownPaste(editor: Editor): boolean {
  if (editor.isDestroyed || !editor.isActive("codeBlock")) {
    return false;
  }
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name !== "codeBlock") {
      continue;
    }
    const after = $from.after(depth);
    const paragraph = editor.schema.nodes.paragraph;
    if (!paragraph) {
      return false;
    }
    return editor
      .chain()
      .command(({ tr, dispatch }) => {
        if (!dispatch) {
          return true;
        }
        tr.insert(after, paragraph.create());
        const selPos = Math.min(after + 1, tr.doc.content.size);
        tr.setSelection(TextSelection.near(tr.doc.resolve(selPos)));
        return true;
      })
      .run();
  }
  return false;
}
