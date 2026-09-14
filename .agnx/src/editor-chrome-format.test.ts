// 场景：笔记左组格式命令 — stub 禁用、样式循环与空编辑器态。
import { describe, expect, it } from "vitest";
import { emptyNotesLeftActionState, isNotesLeftActionStub } from "./editor-chrome-format";

describe("editor-chrome-format", () => {
  it("marks dictation as stub", () => {
    expect(isNotesLeftActionStub("dictation")).toBe(true);
    expect(isNotesLeftActionStub("addFile")).toBe(false);
    expect(isNotesLeftActionStub("bold")).toBe(false);
  });

  it("disables all actions when editor is unavailable", () => {
    const state = emptyNotesLeftActionState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.textStyleId).toBe("paragraph");
    expect(state.disabled.bold).toBe(true);
    expect(state.disabled.dictation).toBe(true);
  });
});
