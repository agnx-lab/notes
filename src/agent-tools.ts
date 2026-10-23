// 场景：Notes Sub App 向 Agent 暴露 list/get/create/update/search/export/versions 工具。
import type { WorkspaceAppHostApi } from "@agnx-lab/app-sdk";
import { noteToMarkdownDocument } from "./note-model";
import { NOTES_APP_ID } from "./ids";
import { openNoteTab } from "./open-note";
import { useNotesDemoStore, type DemoNote } from "./store";

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asLimit(value: unknown, fallback = DEFAULT_LIST_LIMIT): number {
  const n = typeof value === "number" ? value : fallback;
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(1, Math.min(MAX_LIST_LIMIT, Math.floor(n)));
}

function requireConfirm(input: Record<string, unknown>): Record<string, unknown> | null {
  if (input.confirm === true) {
    return null;
  }
  return {
    ok: false,
    error: "confirm_required",
    message: "Destructive action requires confirm: true",
  };
}

function summarizeNote(note: DemoNote): Record<string, unknown> {
  return {
    id: note.id,
    title: note.title,
    updatedAt: note.updatedAt,
    bodyPreview: note.body.trim().slice(0, 120),
    versionCount: note.versions.length,
    charCount: note.body.length,
  };
}

export async function listNotesTool(raw: unknown): Promise<Record<string, unknown>> {
  const input = asObject(raw);
  const query = asOptionalString(input.query)?.toLowerCase() ?? "";
  const limit = asLimit(input.limit);
  const offset = Math.max(0, Math.floor(typeof input.offset === "number" ? input.offset : 0));
  let notes = useNotesDemoStore.getState().notes;
  if (query) {
    notes = notes.filter((note) => {
      const hay = `${note.title}\n${note.body}`.toLowerCase();
      return hay.includes(query);
    });
  }
  const page = notes.slice(offset, offset + limit);
  return {
    ok: true,
    total: notes.length,
    offset,
    limit,
    items: page.map(summarizeNote),
  };
}

export async function getNoteTool(raw: unknown): Promise<Record<string, unknown>> {
  const input = asObject(raw);
  const id = asOptionalString(input.id);
  if (!id) {
    return { ok: false, error: "id_required" };
  }
  const note = useNotesDemoStore.getState().getNote(id);
  if (!note) {
    return { ok: false, error: "not_found", id };
  }
  const includeBody = input.includeBody !== false;
  return {
    ok: true,
    note: {
      ...summarizeNote(note),
      ...(includeBody ? { body: note.body } : {}),
      versions: note.versions.map((version) => ({
        id: version.id,
        title: version.title,
        createdAt: version.createdAt,
        bodyPreview: version.body.trim().slice(0, 80),
      })),
    },
  };
}

export async function createNoteTool(raw: unknown): Promise<Record<string, unknown>> {
  const input = asObject(raw);
  const note = useNotesDemoStore.getState().createNote({
    title: asOptionalString(input.title),
    body: typeof input.body === "string" ? input.body : undefined,
  });
  if (input.open === true) {
    openNoteTab(note);
  }
  return { ok: true, note: summarizeNote(note) };
}

export async function updateNoteTool(raw: unknown): Promise<Record<string, unknown>> {
  const input = asObject(raw);
  const id = asOptionalString(input.id);
  if (!id) {
    return { ok: false, error: "id_required" };
  }
  const patch: { title?: string; body?: string } = {};
  if (typeof input.title === "string") {
    patch.title = input.title;
  }
  if (typeof input.body === "string") {
    patch.body = input.body;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "empty_patch" };
  }
  const note = useNotesDemoStore.getState().updateNote(id, patch);
  if (!note) {
    return { ok: false, error: "not_found", id };
  }
  return { ok: true, note: summarizeNote(note) };
}

export async function deleteNoteTool(raw: unknown): Promise<Record<string, unknown>> {
  const input = asObject(raw);
  const denied = requireConfirm(input);
  if (denied) {
    return denied;
  }
  const id = asOptionalString(input.id);
  if (!id) {
    return { ok: false, error: "id_required" };
  }
  const ok = useNotesDemoStore.getState().deleteNote(id);
  return ok ? { ok: true, id } : { ok: false, error: "not_found", id };
}

export async function openNoteTool(raw: unknown): Promise<Record<string, unknown>> {
  const input = asObject(raw);
  const id = asOptionalString(input.id);
  if (!id) {
    return { ok: false, error: "id_required" };
  }
  const note = useNotesDemoStore.getState().getNote(id);
  if (!note) {
    return { ok: false, error: "not_found", id };
  }
  const opened = openNoteTab(note);
  return { ok: opened, id };
}

export async function exportNoteMarkdownTool(raw: unknown): Promise<Record<string, unknown>> {
  const input = asObject(raw);
  const id = asOptionalString(input.id);
  if (!id) {
    return { ok: false, error: "id_required" };
  }
  const note = useNotesDemoStore.getState().getNote(id);
  if (!note) {
    return { ok: false, error: "not_found", id };
  }
  return {
    ok: true,
    id,
    filename: `${note.title || "note"}.md`,
    markdown: noteToMarkdownDocument(note),
  };
}

export async function restoreNoteVersionTool(raw: unknown): Promise<Record<string, unknown>> {
  const input = asObject(raw);
  const denied = requireConfirm(input);
  if (denied) {
    return denied;
  }
  const id = asOptionalString(input.id);
  const versionId = asOptionalString(input.versionId);
  if (!id || !versionId) {
    return { ok: false, error: "id_and_versionId_required" };
  }
  const note = useNotesDemoStore.getState().restoreVersion(id, versionId);
  if (!note) {
    return { ok: false, error: "not_found" };
  }
  return { ok: true, note: summarizeNote(note) };
}

export function registerNotesAgentTools(host: WorkspaceAppHostApi): () => void {
  return host.registerAgentTools({
    appId: NOTES_APP_ID,
    tools: [
      {
        name: "list_notes",
        description: "List notes (optional query/limit/offset).",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number" },
            offset: { type: "number" },
          },
        },
        execute: listNotesTool,
      },
      {
        name: "get_note",
        description: "Get one note by id (body + version summaries).",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            includeBody: { type: "boolean" },
          },
          required: ["id"],
        },
        execute: getNoteTool,
      },
      {
        name: "create_note",
        description: "Create a note; optional open=true opens Tab.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            open: { type: "boolean" },
          },
        },
        execute: createNoteTool,
      },
      {
        name: "update_note",
        description: "Update note title/body.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
          },
          required: ["id"],
        },
        execute: updateNoteTool,
      },
      {
        name: "delete_note",
        description: "Delete a note. Requires confirm:true.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            confirm: { type: "boolean" },
          },
          required: ["id", "confirm"],
        },
        execute: deleteNoteTool,
      },
      {
        name: "open_note",
        description: "Open a note in the workspace editor Tab.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        execute: openNoteTool,
      },
      {
        name: "export_note_markdown",
        description: "Return full markdown document for a note (title + body).",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        execute: exportNoteMarkdownTool,
      },
      {
        name: "restore_note_version",
        description: "Restore a local version snapshot. Requires confirm:true.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            versionId: { type: "string" },
            confirm: { type: "boolean" },
          },
          required: ["id", "versionId", "confirm"],
        },
        execute: restoreNoteVersionTool,
      },
    ],
  });
}
