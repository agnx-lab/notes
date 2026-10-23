// 场景：笔记音视频展示 URI — 托管路径缓存 blob；不把易失效 blob 当真理。
import { getNotesHost } from "./notes-host";

/** 同一托管路径复用 object URL，避免反复 resolve / 失效后空进度条。 */
const notesAttachmentPlaySrcCache = new Map<string, string>();

export function isEphemeralAttachmentSrc(value: string): boolean {
  return value.startsWith("blob:") || value.startsWith("data:");
}

export function isDirectPlayableAttachmentSrc(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:");
}

/**
 * 解析可播放 URI：优先稳定托管路径 → 缓存 blob；勿对已有 blob: 再走 host.resolve（会抛错）。
 */
export async function resolveNotesAttachmentPlaySrc(input: {
  managedUri: string;
  fallbackSrc?: string;
}): Promise<string> {
  const managed = input.managedUri.trim();
  const fallback = (input.fallbackSrc ?? "").trim();

  if (managed && !isEphemeralAttachmentSrc(managed)) {
    const cached = notesAttachmentPlaySrcCache.get(managed);
    if (cached) {
      return cached;
    }
    const host = getNotesHost();
    if (host) {
      try {
        const next = await host.files.resolveObjectUrl(managed);
        if (next) {
          notesAttachmentPlaySrcCache.set(managed, next);
          return next;
        }
      } catch {
        // fall through
      }
    }
    if (fallback && isDirectPlayableAttachmentSrc(fallback)) {
      return fallback;
    }
    // 旧 attrs 里的 blob 可能已 revoke；仍试一下
    if (fallback.startsWith("blob:")) {
      return fallback;
    }
    return "";
  }

  if (fallback && isDirectPlayableAttachmentSrc(fallback)) {
    return fallback;
  }
  if (fallback.startsWith("blob:")) {
    return fallback;
  }
  return "";
}

export function peekNotesAttachmentPlaySrcCache(managedUri: string): string | undefined {
  return notesAttachmentPlaySrcCache.get(managedUri.trim());
}

export function rememberNotesAttachmentPlaySrc(managedUri: string, playSrc: string): void {
  const managed = managedUri.trim();
  if (!managed || isEphemeralAttachmentSrc(managed) || !playSrc) {
    return;
  }
  notesAttachmentPlaySrcCache.set(managed, playSrc);
}

/** 缓存 miss 或怀疑失效时删掉，下次强制重新 resolve。 */
export function forgetNotesAttachmentPlaySrc(managedUri: string): void {
  notesAttachmentPlaySrcCache.delete(managedUri.trim());
}
