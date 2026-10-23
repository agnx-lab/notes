// 场景：导出笔记为 Markdown（剪贴板 + 浏览器下载）。
import { noteToMarkdownDocument, type DemoNote } from "./note-model";

export async function exportNoteMarkdown(note: DemoNote): Promise<{ ok: boolean; method: string }> {
  const markdown = noteToMarkdownDocument(note);
  const filename = `${sanitizeFilename(note.title || "note")}.md`;

  let copied = false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(markdown);
      copied = true;
    }
  } catch {
    copied = false;
  }

  let downloaded = false;
  try {
    if (typeof document !== "undefined") {
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      downloaded = true;
    }
  } catch {
    downloaded = false;
  }

  if (downloaded && copied) {
    return { ok: true, method: "download+clipboard" };
  }
  if (downloaded) {
    return { ok: true, method: "download" };
  }
  if (copied) {
    return { ok: true, method: "clipboard" };
  }
  return { ok: false, method: "none" };
}

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]+/g, "_")
      .trim()
      .slice(0, 80) || "note"
  );
}
