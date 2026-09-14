// 场景：笔记底栏宽度断点 — 宽单行、中双行、窄横滚。
import { describe, expect, it } from "vitest";
import {
  NOTES_STATUS_BAR_SCROLL_BELOW,
  NOTES_STATUS_BAR_STACK_BELOW,
  resolveNotesStatusBarLayout,
} from "./status-bar-layout";

describe("resolveNotesStatusBarLayout", () => {
  it("uses row for wide panes", () => {
    expect(resolveNotesStatusBarLayout(NOTES_STATUS_BAR_STACK_BELOW)).toBe("row");
    expect(resolveNotesStatusBarLayout(900)).toBe("row");
  });

  it("stacks into two rows for medium panes", () => {
    expect(resolveNotesStatusBarLayout(NOTES_STATUS_BAR_SCROLL_BELOW)).toBe("stack");
    expect(resolveNotesStatusBarLayout(NOTES_STATUS_BAR_STACK_BELOW - 1)).toBe("stack");
  });

  it("scrolls actions when very narrow", () => {
    expect(resolveNotesStatusBarLayout(NOTES_STATUS_BAR_SCROLL_BELOW - 1)).toBe("scroll");
    expect(resolveNotesStatusBarLayout(240)).toBe("scroll");
  });

  it("defaults to row before the first layout measurement", () => {
    expect(resolveNotesStatusBarLayout(0)).toBe("row");
    expect(resolveNotesStatusBarLayout(Number.NaN)).toBe("row");
  });
});
