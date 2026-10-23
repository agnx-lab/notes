// 场景：笔记图片托管插入 — pick/粘贴/拖拽落盘；markdown 写稳定路径，展示用 resolveObjectUrl。
import type { Editor } from "@tiptap/core";
import type { WorkspaceAppManagedFile } from "@agnx-lab/app-sdk";
import { NOTES_APP_ID } from "./ids";
import {
  buildImageMarkdown,
  collectImageFilesFromDataTransfer,
  fileNameForPastedImage,
  fileToBase64,
  guessMimeFromFileName,
  isAppsDataFilesPath,
  isEphemeralImageSrc,
  isImageFileLike,
  normalizeLocalImagePath,
  resolveImageManagedUri,
} from "./note-image-model";
import { getNotesHost } from "./notes-host";
import { parseNotesMediaAlign, type NotesMediaAlign } from "./notes-media-align";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"] as const;

async function importBlobAsManagedFile(
  blob: Blob,
  options?: { fileName?: string; title?: string },
): Promise<WorkspaceAppManagedFile> {
  const host = getNotesHost();
  if (!host) {
    throw new Error("Notes host 未就绪");
  }
  const mimeType = blob.type || "image/png";
  const fileName = options?.fileName || fileNameForPastedImage(mimeType);
  const bytesBase64 = await fileToBase64(blob);
  return host.files.importBytes({
    appId: NOTES_APP_ID,
    bytesBase64,
    fileName,
    mimeType,
    title: options?.title || fileName.replace(/\.[^.]+$/, "") || "image",
  });
}

export async function importClipboardImageBytes(
  images: readonly { bytesBase64: string; mimeType: string; fileName?: string }[],
): Promise<WorkspaceAppManagedFile[]> {
  const host = getNotesHost();
  if (!host || images.length === 0) {
    return [];
  }
  const imported: WorkspaceAppManagedFile[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const item = images[index]!;
    if (!item.bytesBase64) {
      continue;
    }
    const mimeType = item.mimeType || "image/png";
    const fileName = item.fileName || fileNameForPastedImage(mimeType, index);
    try {
      imported.push(
        await host.files.importBytes({
          appId: NOTES_APP_ID,
          bytesBase64: item.bytesBase64,
          fileName,
          mimeType,
          title: fileName.replace(/\.[^.]+$/, "") || "image",
        }),
      );
    } catch (error) {
      console.warn("[agnx.notes] import clipboard image bytes failed", error);
    }
  }
  return imported;
}

export async function importImageFiles(files: readonly File[]): Promise<WorkspaceAppManagedFile[]> {
  const imported: WorkspaceAppManagedFile[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    // 与 collectImageFiles 对齐：空 MIME / octet-stream + 扩展名也要导入
    if (!isImageFileLike(file)) {
      continue;
    }
    const mimeType =
      (file.type || "").split(";")[0]?.trim() || guessMimeFromFileName(file.name) || "image/png";
    const blob =
      file.type && file.type.startsWith("image/")
        ? file
        : new Blob([await file.arrayBuffer()], { type: mimeType });
    imported.push(
      await importBlobAsManagedFile(blob, {
        fileName: file.name || fileNameForPastedImage(mimeType, index),
        title: (file.name || "").replace(/\.[^.]+$/, "") || "image",
      }),
    );
  }
  return imported;
}

export async function importImageFromDataUrl(
  dataUrl: string,
  index = 0,
): Promise<WorkspaceAppManagedFile | null> {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+)(;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(
    dataUrl.trim(),
  );
  if (!match) {
    return null;
  }
  const mimeType = match[1]!.toLowerCase();
  const isBase64 = Boolean(match[3]);
  let bytesBase64 = (match[4] ?? "").replace(/\s+/g, "");
  if (!isBase64) {
    try {
      const decoded = decodeURIComponent(match[4] ?? "");
      const bytes = new TextEncoder().encode(decoded);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!);
      }
      bytesBase64 = btoa(binary);
    } catch {
      return null;
    }
  }
  const host = getNotesHost();
  if (!host) {
    return null;
  }
  const fileName = fileNameForPastedImage(mimeType, index);
  return host.files.importBytes({
    appId: NOTES_APP_ID,
    bytesBase64,
    fileName,
    mimeType,
    title: fileName.replace(/\.[^.]+$/, "") || "image",
  });
}

export async function importImageFromRemoteUrl(
  url: string,
): Promise<WorkspaceAppManagedFile | null> {
  const host = getNotesHost();
  if (!host) {
    return null;
  }
  const cleaned = url.trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    return null;
  }
  try {
    return await host.files.importFromUrl({
      appId: NOTES_APP_ID,
      url: cleaned,
      title: "image",
    });
  } catch {
    return null;
  }
}

export async function importImageFromBlobUrl(url: string): Promise<WorkspaceAppManagedFile | null> {
  if (!url.startsWith("blob:")) {
    return null;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") && blob.size === 0) {
      return null;
    }
    return await importBlobAsManagedFile(blob, {
      fileName: fileNameForPastedImage(blob.type || "image/png"),
      title: "image",
    });
  } catch {
    return null;
  }
}

export async function importImageFromLocalPath(
  localPath: string,
  index = 0,
): Promise<WorkspaceAppManagedFile | null> {
  const host = getNotesHost();
  if (!host || !localPath.trim()) {
    return null;
  }
  const path = localPath.trim();
  if (isAppsDataFilesPath(path)) {
    return {
      title:
        path
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.[^.]+$/, "") || "image",
      uri: path,
      origin: "local",
    };
  }
  try {
    // 剪贴板 file:// 常落在 /var/folders 等临时路径；resolveObjectUrl 不允许读，需 copy 进 apps/data
    if (typeof host.files.importFromPath === "function") {
      return await host.files.importFromPath({
        appId: NOTES_APP_ID,
        sourcePath: path,
        title:
          path
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.[^.]+$/, "") || "image",
        fileName: path.split(/[\\/]/).pop() || fileNameForPastedImage("image/png", index),
      });
    }
    // 兼容旧宿主：尝试 resolve→blob→importBytes（仅 apps/data 内路径可用）
    const objectUrl = await host.files.resolveObjectUrl(path);
    const response = await fetch(objectUrl);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      return null;
    }
    const mimeType = blob.type || "image/png";
    return await importBlobAsManagedFile(blob, {
      fileName: fileNameForPastedImage(mimeType, index),
      title:
        path
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.[^.]+$/, "") || "image",
    });
  } catch (error) {
    console.warn("[agnx.notes] import local image failed", path, error);
    return null;
  }
}

export async function importImageSource(
  src: string,
  index = 0,
): Promise<WorkspaceAppManagedFile | null> {
  const cleaned = src.trim();
  if (!cleaned) {
    return null;
  }
  if (cleaned.startsWith("data:image/")) {
    return importImageFromDataUrl(cleaned, index);
  }
  if (cleaned.startsWith("blob:")) {
    return importImageFromBlobUrl(cleaned);
  }
  if (/^https?:\/\//i.test(cleaned)) {
    return importImageFromRemoteUrl(cleaned);
  }
  const localPath = normalizeLocalImagePath(cleaned);
  if (localPath) {
    return importImageFromLocalPath(localPath, index);
  }
  return null;
}

export async function toDisplayAndManaged(
  file: WorkspaceAppManagedFile,
): Promise<{ managedUri: string; displaySrc: string; alt: string }> {
  const managedUri = file.uri;
  const displaySrc = await resolveDisplaySrc(managedUri);
  return {
    managedUri,
    displaySrc,
    alt: file.title || "image",
  };
}

/** 展示用 object URL 缓存：同一托管路径复用，避免每次 refresh 新建 blob（防图片闪烁）。 */
const notesImageDisplaySrcCache = new Map<string, string>();

async function resolveDisplaySrc(managedUri: string): Promise<string> {
  const cached = notesImageDisplaySrcCache.get(managedUri);
  if (cached) {
    return cached;
  }
  const host = getNotesHost();
  if (!host) {
    return managedUri;
  }
  try {
    const next = await host.files.resolveObjectUrl(managedUri);
    if (next) {
      notesImageDisplaySrcCache.set(managedUri, next);
    }
    return next || managedUri;
  } catch {
    return managedUri;
  }
}

/** 插入图片：state 中 title=托管路径，src=可显示地址；markdown 序列化走 title。 */
export async function insertManagedImage(
  editor: Editor,
  file: WorkspaceAppManagedFile,
): Promise<boolean> {
  if (editor.isDestroyed || !editor.isEditable) {
    return false;
  }
  const managedUri = file.uri;
  const displaySrc = await resolveDisplaySrc(managedUri);
  return editor
    .chain()
    .focus()
    .setImage({
      src: displaySrc,
      alt: file.title || "image",
      title: managedUri,
    })
    .run();
}

export async function pickAndInsertNoteImage(editor: Editor): Promise<boolean> {
  const host = getNotesHost();
  if (!host || editor.isDestroyed || !editor.isEditable) {
    return false;
  }
  const files = await host.files.pickAndImport({
    title: "插入图片",
    multiple: false,
    extensions: IMAGE_EXTENSIONS,
    accept: "image/*",
    filterLabel: "图片",
    appId: NOTES_APP_ID,
  });
  const file = files[0];
  if (!file?.uri) {
    return false;
  }
  return insertManagedImage(editor, file);
}

export async function importAndInsertImageFiles(
  editor: Editor,
  files: readonly File[],
): Promise<number> {
  if (editor.isDestroyed || !editor.isEditable || files.length === 0) {
    return 0;
  }
  const imported = await importImageFiles(files);
  let count = 0;
  for (const file of imported) {
    const ok = await insertManagedImage(editor, file);
    if (ok) {
      count += 1;
    }
  }
  return count;
}

export async function importAndBuildImageMarkdown(files: readonly File[]): Promise<string[]> {
  const imported = await importImageFiles(files);
  return imported.map((file) => buildImageMarkdown(file.title || "image", file.uri));
}

export function collectClipboardImageFiles(event: {
  clipboardData?: DataTransfer | null;
  dataTransfer?: DataTransfer | null;
}): File[] {
  return collectImageFilesFromDataTransfer(event.clipboardData ?? event.dataTransfer ?? null);
}

/**
 * 打开笔记后：把稳定路径 resolve 到可显示 src，title 始终保留托管路径。
 * updateAttributes 后 serialize 仍写 title，不会把 blob 写进 markdown。
 */
function collectManagedImageNodes(editor: Editor): { pos: number; managed: string; alt: string }[] {
  const updates: { pos: number; managed: string; alt: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "image") {
      return;
    }
    const managed = resolveImageManagedUri({
      src: String(node.attrs.src ?? ""),
      title: String(node.attrs.title ?? ""),
    });
    if (!managed) {
      return;
    }
    updates.push({
      pos,
      managed,
      alt: String(node.attrs.alt ?? ""),
    });
  });
  return updates;
}

function shouldSkipImageRefresh(
  current: { attrs: Record<string, unknown> },
  item: { managed: string },
  displaySrc: string,
): boolean {
  const title = String(current.attrs.title ?? "");
  const src = String(current.attrs.src ?? "");
  if (title === item.managed && src === displaySrc) {
    return true;
  }
  // 已有可显示 blob/data 且 title 已是托管路径：勿反复换新 blob（否则图片闪烁）
  if (title === item.managed && isEphemeralImageSrc(src) && src.length > 0) {
    return true;
  }
  return false;
}

export async function refreshNoteImageSources(editor: Editor): Promise<void> {
  const host = getNotesHost();
  if (!host || editor.isDestroyed) {
    return;
  }
  for (const item of collectManagedImageNodes(editor)) {
    if (editor.isDestroyed) {
      return;
    }
    try {
      const displaySrc = await resolveDisplaySrc(item.managed);
      if (!displaySrc) {
        continue;
      }
      const current = editor.state.doc.nodeAt(item.pos);
      if (!current || current.type.name !== "image") {
        continue;
      }
      if (shouldSkipImageRefresh(current, item, displaySrc)) {
        continue;
      }
      editor
        .chain()
        .command(({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta("notesSkipMarkdownEmit", true);
            tr.setMeta("addToHistory", false);
            tr.setNodeMarkup(item.pos, undefined, {
              ...current.attrs,
              src: displaySrc,
              alt: item.alt,
              title: item.managed,
            });
          }
          return true;
        })
        .run();
    } catch {
      // 单张失败不影响其余
    }
  }
}

export async function updateImageManagedPath(
  editor: Editor,
  pos: number,
  nextPath: string,
): Promise<boolean> {
  const managed = nextPath.trim();
  if (!managed || editor.isDestroyed) {
    return false;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "image") {
    return false;
  }
  const displaySrc = isEphemeralImageSrc(managed) ? managed : await resolveDisplaySrc(managed);
  return editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          src: displaySrc,
          title: isEphemeralImageSrc(managed) ? "" : managed,
          alt: node.attrs.alt || "image",
        });
      }
      return true;
    })
    .run();
}

export function updateImageAlign(editor: Editor, pos: number, align: NotesMediaAlign): boolean {
  if (editor.isDestroyed) {
    return false;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "image") {
    return false;
  }
  const next = parseNotesMediaAlign(align);
  if (parseNotesMediaAlign(node.attrs.align) === next) {
    return true;
  }
  return editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          align: next,
        });
      }
      return true;
    })
    .run();
}

export async function replaceImageAtPos(editor: Editor, pos: number): Promise<boolean> {
  const host = getNotesHost();
  if (!host || editor.isDestroyed || !editor.isEditable) {
    return false;
  }
  const files = await host.files.pickAndImport({
    title: "替换图片",
    multiple: false,
    extensions: IMAGE_EXTENSIONS,
    accept: "image/*",
    filterLabel: "图片",
    appId: NOTES_APP_ID,
  });
  const file = files[0];
  if (!file?.uri) {
    return false;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "image") {
    return false;
  }
  const displaySrc = await resolveDisplaySrc(file.uri);
  return editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          src: displaySrc,
          title: file.uri,
          alt: file.title || node.attrs.alt || "image",
        });
      }
      return true;
    })
    .run();
}

export function deleteImageAtPos(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "image" || editor.isDestroyed) {
    return false;
  }
  return editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.delete(pos, pos + node.nodeSize);
      }
      return true;
    })
    .run();
}
