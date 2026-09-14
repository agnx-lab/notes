// 场景：链接路径条类型 — 点击编辑 URL（对齐图片托管路径条）。
import type { Editor } from "@tiptap/core";

export interface NotesLinkViewProps {
  editor: Editor;
  from: number;
  to: number;
  url: string;
  text: string;
  closeLinkView: () => void;
}
