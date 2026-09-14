// 场景：笔记分割线 — 包装 NodeView，选中蓝框时横线仍垂直居中。
import { mergeAttributes } from "@tiptap/core";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";

export const NotesHorizontalRule = HorizontalRule.extend({
  selectable: true,
  atom: true,

  addNodeView() {
    return () => {
      const dom = document.createElement("div");
      dom.className = "agnx-notes-hr-wrap";
      dom.contentEditable = "false";
      dom.dataset.testid = "notes-horizontal-rule";
      const line = document.createElement("div");
      line.className = "agnx-notes-hr-line";
      line.setAttribute("role", "presentation");
      dom.appendChild(line);
      return {
        dom,
        contentDOM: null,
        ignoreMutation: () => true,
      };
    };
  },

  parseHTML() {
    return [{ tag: "hr" }, { tag: "div.agnx-notes-hr-wrap" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["hr", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },
}).configure({
  HTMLAttributes: {
    class: "agnx-notes-hr",
  },
});
