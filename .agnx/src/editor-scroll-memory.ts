// 场景：笔记编辑器滚动位置记忆 — 按 noteId + 面落盘；恢复前等待媒体加载稳定高度。
const STORAGE_PREFIX = "agnx.notes.scroll.v1:";
const WRITE_DEBOUNCE_MS = 120;
const MEDIA_SETTLE_TIMEOUT_MS = 4000;
const MEDIA_POLL_MS = 80;

/** vitest/node 或 localStorage 不可用时的内存兜底 */
const memoryStore = new Map<string, string>();

export type NotesScrollSurface = "rich" | "source";

function storageKey(noteId: string, surface: NotesScrollSurface = "rich"): string {
  return `${STORAGE_PREFIX}${surface}:${noteId}`;
}

function storageGet(key: string): string | null {
  if (typeof localStorage !== "undefined") {
    try {
      const fromLs = localStorage.getItem(key);
      if (fromLs != null) {
        return fromLs;
      }
    } catch {
      // fall through to memory
    }
  }
  return memoryStore.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  memoryStore.set(key, value);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(key, value);
    } catch {
      // memory already set
    }
  }
}

function storageRemove(key: string): void {
  memoryStore.delete(key);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function readNoteScrollTop(
  noteId: string,
  surface: NotesScrollSurface = "rich",
): number | null {
  if (!noteId) {
    return null;
  }
  const raw = storageGet(storageKey(noteId, surface));
  if (raw == null || raw === "") {
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return Math.round(n);
}

export function writeNoteScrollTop(
  noteId: string,
  scrollTop: number,
  surface: NotesScrollSurface = "rich",
): void {
  if (!noteId) {
    return;
  }
  storageSet(storageKey(noteId, surface), String(Math.max(0, Math.round(scrollTop))));
}

export function clearNoteScrollTop(noteId: string, surface?: NotesScrollSurface): void {
  if (!noteId) {
    return;
  }
  if (surface) {
    storageRemove(storageKey(noteId, surface));
    return;
  }
  storageRemove(storageKey(noteId, "rich"));
  storageRemove(storageKey(noteId, "source"));
}

function applyScrollTop(el: HTMLElement, scrollTop: number): void {
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  el.scrollTop = Math.min(scrollTop, max);
}

function listPendingMedia(root: HTMLElement): Array<HTMLImageElement | HTMLMediaElement> {
  const pending: Array<HTMLImageElement | HTMLMediaElement> = [];
  for (const img of root.querySelectorAll("img")) {
    if (!img.complete) {
      pending.push(img);
    }
  }
  for (const media of root.querySelectorAll("audio, video")) {
    const el = media as HTMLMediaElement;
    // 未挂 src / preload=none 的点播占位不阻塞滚动恢复
    if (!el.getAttribute("src") && !el.currentSrc) {
      continue;
    }
    // HAVE_CURRENT_DATA = 2；未拿到尺寸/时长前高度可能仍变
    if (el.readyState < 2) {
      pending.push(el);
    }
  }
  return pending;
}

/**
 * 等待容器内图片/音视频加载到可测高度，或超时；供滚动恢复使用。
 */
export function waitForNotesMediaSettle(
  root: HTMLElement,
  options?: { timeoutMs?: number; signal?: { cancelled: boolean } },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? MEDIA_SETTLE_TIMEOUT_MS;
  const signal = options?.signal;

  return new Promise((resolve) => {
    const start = Date.now();
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const tick = () => {
      if (signal?.cancelled) {
        finish();
        return;
      }
      const pending = listPendingMedia(root);
      if (pending.length === 0 || Date.now() - start >= timeoutMs) {
        // 再等一帧让布局提交
        requestAnimationFrame(() => requestAnimationFrame(finish));
        return;
      }
      window.setTimeout(tick, MEDIA_POLL_MS);
    };

    tick();
  });
}

/**
 * 绑定滚动容器：媒体高度稳定后再恢复；滚动时防抖写入。
 */
export function bindNoteScrollMemory(
  el: HTMLElement,
  noteId: string,
  surface: NotesScrollSurface = "rich",
): () => void {
  let disposed = false;
  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  const signal = { cancelled: false };

  const saved = readNoteScrollTop(noteId, surface);
  if (saved != null && saved > 0) {
    void (async () => {
      await waitForNotesMediaSettle(el, { signal });
      if (disposed || signal.cancelled) {
        return;
      }
      applyScrollTop(el, saved);
      window.setTimeout(() => {
        if (!disposed && !signal.cancelled) {
          applyScrollTop(el, saved);
        }
      }, 200);
    })();
  }

  const flushWrite = () => {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    writeNoteScrollTop(noteId, el.scrollTop, surface);
  };

  const onScroll = () => {
    if (writeTimer) {
      clearTimeout(writeTimer);
    }
    writeTimer = setTimeout(() => {
      writeTimer = null;
      if (!disposed) {
        writeNoteScrollTop(noteId, el.scrollTop, surface);
      }
    }, WRITE_DEBOUNCE_MS);
  };

  el.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    disposed = true;
    signal.cancelled = true;
    if (writeTimer) {
      clearTimeout(writeTimer);
    }
    el.removeEventListener("scroll", onScroll);
    flushWrite();
  };
}
