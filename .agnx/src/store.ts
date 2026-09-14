// 场景：Notes 列表 CRUD — host.storage JSON 落盘；含版本快照。
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { clearNoteScrollTop } from "./editor-scroll-memory";
import type {
  WorkspaceAppListItem,
  WorkspaceAppStorageApi,
  WorkspaceAppSyncApi,
} from "@getagnx/app-sdk";
import { NOTES_PANEL_ID } from "./ids";
import {
  createNoteId,
  extractTitleFromMarkdown,
  pushVersion,
  shouldSnapshotBeforeRestore,
  shouldSnapshotVersion,
  type DemoNote,
  type NoteVersion,
} from "./note-model";

export type { DemoNote, NoteVersion } from "./note-model";

interface NotesDemoState {
  notes: DemoNote[];
  createNote: (input?: { title?: string; body?: string }) => DemoNote;
  updateNote: (
    id: string,
    patch: { title?: string; body?: string },
    options?: { snapshot?: boolean },
  ) => DemoNote | null;
  restoreVersion: (id: string, versionId: string) => DemoNote | null;
  deleteNote: (id: string) => boolean;
  getNote: (id: string) => DemoNote | undefined;
}

const PERSIST_NAME = "workspace-demo-notes";
const STATE_KEY = "notes-v1";
const NOTES_APP_ID = "agnx.notes";

let boundStorage: WorkspaceAppStorageApi | null = null;
let boundSync: WorkspaceAppSyncApi | null = null;
let syncUnsubscribe: (() => void) | null = null;
/** 禁止在 host 首轮 rehydrate 完成前把内存空态写回 apps/data。 */
let hostHydrationCompleted = false;

function sortNotes(notes: DemoNote[]): DemoNote[] {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
}

function normalizeNote(raw: unknown): DemoNote | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Partial<DemoNote>;
  if (typeof row.id !== "string" || !row.id) {
    return null;
  }
  const versions = Array.isArray(row.versions)
    ? row.versions.filter((item): item is NoteVersion =>
        Boolean(
          item &&
          typeof item === "object" &&
          typeof (item as NoteVersion).id === "string" &&
          typeof (item as NoteVersion).title === "string" &&
          typeof (item as NoteVersion).body === "string" &&
          typeof (item as NoteVersion).createdAt === "number",
        ),
      )
    : [];
  return {
    id: row.id,
    title: typeof row.title === "string" && row.title.trim() ? row.title : "未命名笔记",
    body: typeof row.body === "string" ? row.body : "",
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : Date.now(),
    versions,
  };
}

function normalizeNotes(raw: unknown): DemoNote[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return sortNotes(raw.map(normalizeNote).filter((note): note is DemoNote => note != null));
}

function countNotesInPersistPayload(raw: string | null | undefined): number {
  if (!raw) {
    return 0;
  }
  try {
    const parsed = JSON.parse(raw) as { state?: { notes?: unknown } };
    return Array.isArray(parsed.state?.notes) ? parsed.state.notes.length : 0;
  } catch {
    return 0;
  }
}

function countNotesInHostDoc(doc: unknown): number {
  if (!doc || typeof doc !== "object") {
    return 0;
  }
  const state = (doc as { state?: { notes?: unknown } }).state;
  return Array.isArray(state?.notes) ? state.notes.length : 0;
}

const hostBackedStorage: StateStorage = {
  getItem: async (name) => {
    if (!boundStorage) {
      return null;
    }
    let hostDoc: unknown | null = null;
    try {
      hostDoc = await boundStorage.readJson(NOTES_APP_ID, STATE_KEY);
    } catch (error) {
      console.warn("[agnx.notes] host.storage.readJson failed, falling back", error);
    }
    const legacy = await AsyncStorage.getItem(name);
    const hostCount = countNotesInHostDoc(hostDoc);
    const legacyCount = countNotesInPersistPayload(legacy);

    if (hostCount > 0 && hostDoc != null) {
      return JSON.stringify(hostDoc);
    }
    if (legacyCount > 0 && legacy) {
      try {
        await boundStorage.writeJson(NOTES_APP_ID, STATE_KEY, JSON.parse(legacy));
      } catch (error) {
        console.warn("[agnx.notes] recover notes to host failed", error);
      }
      return legacy;
    }
    if (hostDoc != null) {
      return JSON.stringify(hostDoc);
    }
    return legacy;
  },
  setItem: async (name, value) => {
    await AsyncStorage.setItem(name, value);
    if (!boundStorage) {
      return;
    }
    if (!hostHydrationCompleted && countNotesInPersistPayload(value) === 0) {
      return;
    }
    try {
      await boundStorage.writeJson(NOTES_APP_ID, STATE_KEY, JSON.parse(value));
      boundSync?.publish({
        appId: NOTES_APP_ID,
        channel: STATE_KEY,
        revision: Date.now(),
      });
    } catch (error) {
      console.warn("[agnx.notes] host.storage.writeJson failed; kept AsyncStorage mirror", error);
    }
  },
  removeItem: async (name) => {
    await AsyncStorage.removeItem(name);
    if (!boundStorage || !hostHydrationCompleted) {
      return;
    }
    try {
      await boundStorage.writeJson(NOTES_APP_ID, STATE_KEY, { state: { notes: [] }, version: 1 });
    } catch {
      // ignore
    }
  },
};

export const useNotesDemoStore = create<NotesDemoState>()(
  persist(
    (set, get) => ({
      notes: [],
      createNote: (input) => {
        const now = Date.now();
        const title = (input?.title ?? "").trim() || "未命名笔记";
        const body = input?.body ?? `# ${title}\n\n`;
        const note: DemoNote = {
          id: createNoteId("note"),
          title: extractTitleFromMarkdown(body) || title,
          body,
          updatedAt: now,
          versions: [],
        };
        set((state) => ({ notes: sortNotes([note, ...state.notes]) }));
        return note;
      },
      updateNote: (id, patch, options) => {
        const current = get().notes.find((note) => note.id === id);
        if (!current) {
          return null;
        }
        const nextTitle =
          patch.title !== undefined ? patch.title.trim() || current.title : current.title;
        const nextBody = patch.body !== undefined ? patch.body : current.body;
        const wantSnapshot = options?.snapshot !== false;
        const versions =
          wantSnapshot &&
          shouldSnapshotVersion({
            previous: current,
            nextTitle,
            nextBody,
          })
            ? pushVersion(current)
            : current.versions;
        const next: DemoNote = {
          ...current,
          title: nextTitle,
          body: nextBody,
          updatedAt: Date.now(),
          versions,
        };
        set((state) => ({
          notes: sortNotes(state.notes.map((note) => (note.id === id ? next : note))),
        }));
        return next;
      },
      restoreVersion: (id, versionId) => {
        const current = get().notes.find((note) => note.id === id);
        if (!current) {
          return null;
        }
        const version = current.versions.find((item) => item.id === versionId);
        if (!version) {
          return null;
        }
        // 已经是这份内容：不写新版本、不改 updatedAt
        if (current.title === version.title && current.body === version.body) {
          return current;
        }
        const versions = shouldSnapshotBeforeRestore({ current, target: version })
          ? pushVersion(current)
          : current.versions;
        const next: DemoNote = {
          ...current,
          title: version.title,
          body: version.body,
          updatedAt: Date.now(),
          versions,
        };
        set((state) => ({
          notes: sortNotes(state.notes.map((note) => (note.id === id ? next : note))),
        }));
        return next;
      },
      deleteNote: (id) => {
        const exists = get().notes.some((note) => note.id === id);
        if (!exists) {
          return false;
        }
        set((state) => ({ notes: state.notes.filter((note) => note.id !== id) }));
        clearNoteScrollTop(id);
        return true;
      },
      getNote: (id) => get().notes.find((note) => note.id === id),
    }),
    {
      name: PERSIST_NAME,
      storage: createJSONStorage(() => hostBackedStorage),
      version: 2,
      skipHydration: true,
      partialize: (state) => ({ notes: state.notes }),
      migrate: (persisted) => {
        const raw = persisted as { notes?: unknown } | null;
        return { notes: normalizeNotes(raw?.notes) };
      },
    },
  ),
);

/** activate 时绑定宿主 storage/sync，并触发从共享盘再水合。 */
export function bindNotesHostStorage(
  storage: WorkspaceAppStorageApi,
  sync?: WorkspaceAppSyncApi | null,
): void {
  boundStorage = storage;
  boundSync = sync ?? null;
  syncUnsubscribe?.();
  syncUnsubscribe =
    boundSync?.subscribe({
      appId: NOTES_APP_ID,
      channel: STATE_KEY,
      onEvent: () => {
        refreshNotesListFromHostStorage();
      },
    }) ?? null;
  hostHydrationCompleted = false;
  void Promise.resolve(useNotesDemoStore.persist.rehydrate()).finally(() => {
    hostHydrationCompleted = true;
  });
}

/** 宿主在 daemon 上线 / sync ping / 打开命令面板时调用，拉取共享 apps/data。 */
export function refreshNotesListFromHostStorage(): void {
  if (!boundStorage) {
    return;
  }
  void useNotesDemoStore.persist.rehydrate();
}

export function noteToListItem(note: DemoNote): WorkspaceAppListItem {
  const preview = note.body.trim() ? note.body.trim().slice(0, 80) : "空笔记";
  return {
    id: note.id,
    title: note.title,
    subtitle: preview,
    updatedAt: note.updatedAt,
    keywords: ["note", "notes", "笔记", note.title],
    open: {
      panelId: NOTES_PANEL_ID,
      entityId: note.id,
      titleHint: note.title,
    },
  };
}

export function listNotesAsWorkspaceItems(query = ""): WorkspaceAppListItem[] {
  const notes = useNotesDemoStore.getState().notes;
  const items = notes.map(noteToListItem);
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }
  return items.filter((item) => {
    const haystack = [item.title, item.subtitle, ...(item.keywords ?? [])].join(" ").toLowerCase();
    return haystack.includes(normalized);
  });
}
