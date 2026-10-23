// 场景：富文本粘贴/拖拽图片 — 拦截剪贴板图片文件，落盘后插入托管引用。
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { collectClipboardImageFiles, importAndInsertImageFiles } from "./insert-image";

export function createNotesImagePasteExtension() {
  return Extension.create({
    name: "agnxNotesImagePaste",
    priority: 1300,
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        new Plugin({
          key: new PluginKey("agnxNotesImagePaste"),
          props: {
            handlePaste: (_view, event) => {
              if (!editor.isEditable || editor.isDestroyed) {
                return false;
              }
              const files = collectClipboardImageFiles(event);
              if (files.length === 0) {
                return false;
              }
              event.preventDefault();
              void importAndInsertImageFiles(editor, files);
              return true;
            },
            handleDrop: (_view, event) => {
              if (!editor.isEditable || editor.isDestroyed) {
                return false;
              }
              const files = collectClipboardImageFiles({ dataTransfer: event.dataTransfer });
              if (files.length === 0) {
                return false;
              }
              event.preventDefault();
              void importAndInsertImageFiles(editor, files);
              return true;
            },
          },
        }),
      ];
    },
  });
}
