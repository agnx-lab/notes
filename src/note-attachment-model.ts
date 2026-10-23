// 场景：笔记附件分类 — 图片 / 音视频 / 通用文件（不依赖宿主 explorer 包）。
export type NotesAttachmentKind = "image" | "audio" | "video" | "file";

const AUDIO_EXT = new Set(["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "webm"]);
const VIDEO_EXT = new Set(["mp4", "m4v", "mov", "webm", "mkv", "ogv"]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif", "svg"]);

export function extensionOfName(fileName: string): string {
  const base = fileName.split(/[/\\]/).findLast(Boolean) ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

function kindFromExtension(ext: string, mime: string): NotesAttachmentKind | null {
  if (!ext) {
    return null;
  }
  if (IMAGE_EXT.has(ext)) {
    return "image";
  }
  if (ext === "webm") {
    return mime.startsWith("video/") ? "video" : "audio";
  }
  if (AUDIO_EXT.has(ext)) {
    return "audio";
  }
  if (VIDEO_EXT.has(ext)) {
    return "video";
  }
  return null;
}

export function resolveNotesAttachmentKind(input: {
  fileName: string;
  uri?: string | null;
  mimeType?: string | null;
}): NotesAttachmentKind {
  const mime = (input.mimeType ?? "").trim().toLowerCase();
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }

  const fromName = kindFromExtension(extensionOfName(input.fileName), mime);
  if (fromName) {
    return fromName;
  }
  const fromUri = kindFromExtension(extensionOfName(input.uri ?? ""), mime);
  if (fromUri) {
    return fromUri;
  }
  return "file";
}

export function formatNotesAttachmentBytes(byteSize: number | null | undefined): string {
  if (typeof byteSize !== "number" || !Number.isFinite(byteSize) || byteSize < 0) {
    return "";
  }
  if (byteSize < 1024) {
    return `${Math.round(byteSize)} B`;
  }
  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(byteSize < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(byteSize / (1024 * 1024)).toFixed(byteSize < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
