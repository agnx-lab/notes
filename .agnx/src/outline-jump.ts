// 场景：大纲点击跳转到 TipTap 对应标题节点并平滑滚动。
import type { Editor } from "@tiptap/core";
import type { NoteOutlineHeading } from "./note-model";

export function jumpEditorToHeading(editor: Editor, heading: NoteOutlineHeading): boolean {
  let matchPos: number | null = null;
  let fallbackPos: number | null = null;
  let occurrence = 0;
  const wantedOccurrence = Math.max(0, heading.occurrence);

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") {
      return;
    }
    const text = node.textContent.trim();
    if (text !== heading.text.trim()) {
      return;
    }
    if (node.attrs.level === heading.level) {
      if (occurrence === wantedOccurrence) {
        matchPos = pos;
        return false;
      }
      occurrence += 1;
      return;
    }
    if (fallbackPos == null) {
      fallbackPos = pos;
    }
  });

  const pos = matchPos ?? fallbackPos;
  if (pos == null) {
    return false;
  }

  editor
    .chain()
    .focus()
    .setTextSelection(pos + 1)
    .run();

  const dom = editor.view.nodeDOM(pos);
  const scrollRoot = editor.view.dom.closest(".agnx-notes-tiptap") as HTMLElement | null;
  if (!(dom instanceof HTMLElement)) {
    return false;
  }
  if (scrollRoot) {
    const rootRect = scrollRoot.getBoundingClientRect();
    const nodeRect = dom.getBoundingClientRect();
    const nextTop = scrollRoot.scrollTop + (nodeRect.top - rootRect.top) - 24;
    scrollRoot.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  } else {
    dom.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return true;
}
