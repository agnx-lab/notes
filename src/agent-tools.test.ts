// 场景：Notes Agent 工具 list/get/create/update/delete/export 单测。
import { beforeEach, describe, expect, it, vi } from "vitest";

const openNoteTab = vi.fn(() => true);

vi.mock("@react-native-async-storage/async-storage", () => {
  const mem = new Map<string, string>();
  return {
    default: {
      getItem: async (key: string) => mem.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        mem.set(key, value);
      },
      removeItem: async (key: string) => {
        mem.delete(key);
      },
    },
  };
});

vi.mock("./open-note", () => ({
  openNoteTab: (...args: unknown[]) => openNoteTab(...args),
}));

import {
  createNoteTool,
  deleteNoteTool,
  exportNoteMarkdownTool,
  getNoteTool,
  listNotesTool,
  updateNoteTool,
} from "./agent-tools";
import { useNotesDemoStore } from "./store";

describe("notes agent tools", () => {
  beforeEach(() => {
    openNoteTab.mockClear();
    useNotesDemoStore.setState({ notes: [] });
  });

  it("creates lists and gets notes", async () => {
    const created = await createNoteTool({
      title: "Hello",
      body: "# Hi\n\nworld",
      open: true,
    });
    expect(created.ok).toBe(true);
    expect(openNoteTab).toHaveBeenCalled();
    const id = (created.note as { id: string }).id;

    const listed = await listNotesTool({ query: "hello" });
    expect(listed.total).toBe(1);

    const got = await getNoteTool({ id });
    expect(got.ok).toBe(true);
    expect((got.note as { body: string }).body).toContain("world");
  });

  it("updates exports and deletes with confirm", async () => {
    const created = await createNoteTool({ title: "X", body: "body" });
    const id = (created.note as { id: string }).id;
    await updateNoteTool({ id, body: "next" });
    const exported = await exportNoteMarkdownTool({ id });
    expect(exported.ok).toBe(true);
    expect(String(exported.markdown)).toContain("# X");

    const denied = await deleteNoteTool({ id });
    expect(denied.ok).toBe(false);
    const deleted = await deleteNoteTool({ id, confirm: true });
    expect(deleted.ok).toBe(true);
  });
});
