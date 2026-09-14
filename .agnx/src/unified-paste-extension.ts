// 场景：TipTap 统一粘贴扩展 — 单入口接管图文混贴；经宿主 clipboard 补齐 Electron 丢图。
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  enrichClipboardSnapshot,
  runUnifiedRichPaste,
  shouldHandleUnifiedPaste,
  snapshotClipboardData,
} from "./unified-paste";
import { collectImageFilesFromDataTransfer } from "./note-image-model";
import { normalizeClipboardNewlines, shouldPreferPlainTextBody } from "./unified-paste-model";
import { clipboardLooksLikeBlockMarkdown, prepareBlockMarkdownPaste } from "./block-markdown-paste";

function fallbackInsert(
  editor: import("@tiptap/core").Editor,
  snapshot: {
    textPlain: string;
    textHtml: string;
  },
): void {
  if (editor.isDestroyed) {
    return;
  }
  const plain = snapshot.textPlain;
  // 含围栏的 Markdown：禁止回退到 clipboard HTML（易把 <pre>/<h2> 拍进代码块）
  if (clipboardLooksLikeBlockMarkdown(plain)) {
    return;
  }
  const html = snapshot.textHtml.trim();
  const preferPlain = shouldPreferPlainTextBody(plain, html);
  if (html && !preferPlain) {
    const ok = editor
      .chain()
      .focus()
      .insertContent(html, { parseOptions: { preserveWhitespace: "full" } })
      .run();
    if (ok) {
      return;
    }
  }
  if (plain.trim()) {
    const normalized = normalizeClipboardNewlines(plain).replace(/\u00a0/g, " ");
    const body = normalized
      .split(/\n{2,}/)
      .map((para) => {
        const inner = para.replace(/^\n+|\n+$/g, "");
        if (!inner) return "";
        const escaped = inner
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/\n/g, "<br>");
        return `<p>${escaped}</p>`;
      })
      .filter(Boolean)
      .join("");
    if (body) {
      editor
        .chain()
        .focus()
        .insertContent(body, { parseOptions: { preserveWhitespace: "full" } })
        .run();
      return;
    }
    editor.chain().focus().insertContent(plain).run();
  }
}

export function createUnifiedPasteExtension() {
  return Extension.create({
    name: "agnxNotesUnifiedPaste",
    // 高于旧 markdown(1200)/image(1300) 扩展，确保单入口
    priority: 1500,
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        new Plugin({
          key: new PluginKey("agnxNotesUnifiedPaste"),
          props: {
            handlePaste: (_view, event) => {
              if (!editor.isEditable || editor.isDestroyed) {
                return false;
              }
              const browserSnapshot = snapshotClipboardData(event.clipboardData);
              const blockMarkdown = clipboardLooksLikeBlockMarkdown(browserSnapshot.textPlain);

              // 代码块内：普通文本仍交给默认（保持单块）；块级 Markdown/围栏则跳出后接管
              if (editor.isActive("codeBlock") && !blockMarkdown) {
                return false;
              }
              if (editor.isActive("codeBlock") && blockMarkdown) {
                prepareBlockMarkdownPaste(editor);
              }

              event.preventDefault();
              void (async () => {
                if (editor.isDestroyed) {
                  return;
                }
                const snapshot = await enrichClipboardSnapshot(browserSnapshot);
                if (shouldHandleUnifiedPaste(snapshot)) {
                  const ok = await runUnifiedRichPaste(editor, snapshot);
                  if (!ok) {
                    fallbackInsert(editor, snapshot);
                  }
                  return;
                }
                fallbackInsert(editor, snapshot);
              })();
              return true;
            },
            handleDrop: (_view, event) => {
              if (!editor.isEditable || editor.isDestroyed) {
                return false;
              }
              const files = collectImageFilesFromDataTransfer(event.dataTransfer);
              if (files.length === 0) {
                return false;
              }
              event.preventDefault();
              const snapshot = {
                textPlain: "",
                textHtml: "",
                imageFiles: files,
                imageSrcHints: [],
                clipboardImages: [],
              };
              void runUnifiedRichPaste(editor, snapshot);
              return true;
            },
          },
        }),
      ];
    },
  });
}
