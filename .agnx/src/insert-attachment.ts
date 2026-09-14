// 场景：笔记添加文件 — pickAndImport 任意类型；图片走 image，其余走 notesAttachment。
import type { Editor } from "@tiptap/core";
import type { WorkspaceAppManagedFile } from "@getagnx/app-sdk";
import { NOTES_APP_ID } from "./ids";
import { insertManagedImage } from "./insert-image";
import { extensionOfName, resolveNotesAttachmentKind } from "./note-attachment-model";
import { getNotesHost } from "./notes-host";
import {
  isEphemeralAttachmentSrc,
  rememberNotesAttachmentPlaySrc,
  resolveNotesAttachmentPlaySrc,
} from "./notes-attachment-src";
import { parseNotesMediaAlign, type NotesMediaAlign } from "./notes-media-align";

function basenameOfUri(uri: string): string {
  return uri.split(/[/\\]/).findLast(Boolean) || "";
}

/** 展示名：优先人类可读 title；探测扩展名时优先 uri 文件名。 */
export function displayNameOfManaged(file: WorkspaceAppManagedFile): string {
  const title = file.title?.trim();
  if (title) {
    return title;
  }
  return basenameOfUri(file.uri) || "文件";
}

export function probeNameOfManaged(file: WorkspaceAppManagedFile): string {
  const fromUri = basenameOfUri(file.uri);
  if (extensionOfName(fromUri)) {
    return fromUri;
  }
  const title = file.title?.trim() ?? "";
  if (extensionOfName(title)) {
    return title;
  }
  return fromUri || title || "file";
}

async function resolveDisplaySrc(managedUri: string): Promise<string> {
  return resolveNotesAttachmentPlaySrc({ managedUri });
}

export async function insertManagedAttachment(
  editor: Editor,
  file: WorkspaceAppManagedFile,
): Promise<boolean> {
  if (editor.isDestroyed || !editor.isEditable || !file.uri) {
    return false;
  }
  const displayName = displayNameOfManaged(file);
  const probeName = probeNameOfManaged(file);
  const kind = resolveNotesAttachmentKind({
    fileName: probeName,
    uri: file.uri,
    mimeType: file.mimeType,
  });

  if (kind === "image") {
    return insertManagedImage(editor, file);
  }

  // 音视频不预写 blob src：点播时再 resolve，避免 attrs 里留下已失效 object URL
  const isAv = kind === "audio" || kind === "video";
  const displaySrc = isAv ? "" : await resolveDisplaySrc(file.uri);
  if (!isAv && displaySrc && !isEphemeralAttachmentSrc(file.uri)) {
    rememberNotesAttachmentPlaySrc(file.uri, displaySrc);
  }
  const byteSize =
    typeof file.byteSize === "number" && Number.isFinite(file.byteSize) ? file.byteSize : null;

  return editor
    .chain()
    .focus()
    .insertContent([
      {
        type: "notesAttachment",
        attrs: {
          kind,
          fileName: displayName,
          mimeType: file.mimeType ?? "",
          byteSize,
          src: displaySrc || null,
          href: file.uri,
          title: file.uri,
        },
      },
      { type: "paragraph" },
    ])
    .run();
}

export async function pickAndInsertNoteAttachment(editor: Editor): Promise<boolean> {
  const host = getNotesHost();
  if (!host || editor.isDestroyed || !editor.isEditable) {
    return false;
  }
  const files = await host.files.pickAndImport({
    title: "添加文件",
    multiple: true,
    appId: NOTES_APP_ID,
    filterLabel: "文件",
  });
  if (files.length === 0) {
    return false;
  }
  let ok = false;
  for (const file of files) {
    const inserted = await insertManagedAttachment(editor, file);
    ok = ok || inserted;
  }
  return ok;
}

export async function updateAttachmentManagedPath(
  editor: Editor,
  pos: number,
  nextPath: string,
): Promise<boolean> {
  const managed = nextPath.trim();
  if (!managed || editor.isDestroyed) {
    return false;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "notesAttachment") {
    return false;
  }
  const displaySrc = await resolveDisplaySrc(managed);
  const kind = resolveNotesAttachmentKind({
    fileName: String(node.attrs.fileName ?? ""),
    uri: managed,
    mimeType: String(node.attrs.mimeType ?? ""),
  });
  const nextKind = kind === "image" ? node.attrs.kind : kind;
  const isAv = nextKind === "audio" || nextKind === "video";
  if (!isAv && displaySrc && !isEphemeralAttachmentSrc(managed)) {
    rememberNotesAttachmentPlaySrc(managed, displaySrc);
  }
  return editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          kind: nextKind,
          src: isAv ? null : displaySrc || null,
          href: managed,
          title: managed,
        });
      }
      return true;
    })
    .run();
}

export function updateAttachmentAlign(
  editor: Editor,
  pos: number,
  align: NotesMediaAlign,
): boolean {
  if (editor.isDestroyed) {
    return false;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "notesAttachment") {
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

function patchAttachmentAttrs(editor: Editor, pos: number, attrs: Record<string, unknown>): void {
  editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.setMeta("notesSkipMarkdownEmit", true);
        tr.setMeta("addToHistory", false);
        tr.setNodeMarkup(pos, undefined, attrs);
      }
      return true;
    })
    .run();
}

function resolveAttachmentKindFromNode(
  node: {
    attrs: Record<string, unknown>;
  },
  managed: string,
): string {
  let kind = String(node.attrs.kind ?? "file");
  if (kind === "file") {
    kind = resolveNotesAttachmentKind({
      fileName: String(node.attrs.fileName ?? ""),
      uri: managed,
      mimeType: String(node.attrs.mimeType ?? ""),
    });
  }
  return kind;
}

async function refreshOneAttachment(
  editor: Editor,
  item: { pos: number; managed: string },
): Promise<void> {
  const node = editor.state.doc.nodeAt(item.pos);
  if (!node || node.type.name !== "notesAttachment") {
    return;
  }
  const kind = resolveAttachmentKindFromNode(node, item.managed);
  const currentSrc = String(node.attrs.src ?? "");
  if (kind === "audio" || kind === "video") {
    if (String(node.attrs.kind) === kind && !currentSrc) {
      return;
    }
    patchAttachmentAttrs(editor, item.pos, {
      ...node.attrs,
      kind,
      src: null,
      href: item.managed,
      title: item.managed,
    });
    return;
  }

  if (currentSrc && String(node.attrs.kind) === kind && !isEphemeralAttachmentSrc(currentSrc)) {
    return;
  }
  const src = await resolveNotesAttachmentPlaySrc({ managedUri: item.managed });
  if (!src || (currentSrc === src && String(node.attrs.kind) === kind)) {
    return;
  }
  if (!isEphemeralAttachmentSrc(item.managed)) {
    rememberNotesAttachmentPlaySrc(item.managed, src);
  }
  patchAttachmentAttrs(editor, item.pos, {
    ...node.attrs,
    kind,
    src: isEphemeralAttachmentSrc(src) ? null : src,
    href: item.managed,
    title: item.managed,
  });
}

/** 打开笔记后：规范化附件 kind；音视频不预填 blob src（点播 resolve）。 */
export async function refreshNoteAttachmentSources(editor: Editor): Promise<void> {
  if (editor.isDestroyed) {
    return;
  }
  const updates: { pos: number; managed: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "notesAttachment") {
      return;
    }
    const managed = String(node.attrs.href || node.attrs.title || "");
    if (!managed) {
      return;
    }
    updates.push({ pos, managed });
  });
  for (const item of updates) {
    try {
      await refreshOneAttachment(editor, item);
    } catch {
      // ignore resolve failures
    }
  }
}
