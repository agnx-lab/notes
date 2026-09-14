// 场景：滚动记忆纯函数 — 读写 key 与数值校验（含无 localStorage 环境）。
import { afterEach, describe, expect, it } from "vitest";
import { clearNoteScrollTop, readNoteScrollTop, writeNoteScrollTop } from "./editor-scroll-memory";

describe("editor-scroll-memory", () => {
  afterEach(() => {
    clearNoteScrollTop("note_test");
  });

  it("round-trips scroll top per note id and surface", () => {
    expect(readNoteScrollTop("note_test", "rich")).toBe(null);
    writeNoteScrollTop("note_test", 420.6, "rich");
    expect(readNoteScrollTop("note_test", "rich")).toBe(421);
    writeNoteScrollTop("note_test", 88, "source");
    expect(readNoteScrollTop("note_test", "source")).toBe(88);
    expect(readNoteScrollTop("note_test", "rich")).toBe(421);
    clearNoteScrollTop("note_test");
    expect(readNoteScrollTop("note_test", "rich")).toBe(null);
    expect(readNoteScrollTop("note_test", "source")).toBe(null);
  });

  it("clamps negative scroll to 0", () => {
    writeNoteScrollTop("note_test", -3, "rich");
    expect(readNoteScrollTop("note_test", "rich")).toBe(0);
  });
});
