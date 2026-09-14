// 场景：Notes Tab 视图偏好解析 — tab 存盘缺省时回退默认 / 种子主题。
import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTES_TAB_VIEW_PREFS,
  notesTabViewPrefsStorageKey,
  parseNotesTabViewPrefs,
} from "./notes-tab-view-prefs";

describe("notes-tab-view-prefs", () => {
  it("storage key 按 tabId 隔离且符合 host.storage 字符集", () => {
    expect(notesTabViewPrefsStorageKey("tab-a")).toBe("view-prefs.tab.tab-a");
    expect(notesTabViewPrefsStorageKey("tab-b")).not.toBe(notesTabViewPrefsStorageKey("tab-a"));
    expect(notesTabViewPrefsStorageKey("mini-app_agnx.notes__editor__note_x")).toMatch(
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    );
  });

  it("解析完整 prefs", () => {
    const prefs = parseNotesTabViewPrefs({
      typography: {
        fontSizePx: 18,
        lineHeight: 1.5,
        paragraphGapEm: 1,
        pageWidthPercent: 72,
      },
      markdownTheme: "notion",
      editorMode: "source",
      wordWrap: false,
    });
    expect(prefs.typography.fontSizePx).toBe(18);
    expect(prefs.typography.pageWidthPercent).toBe(72);
    expect(prefs.markdownTheme).toBe("notion");
    expect(prefs.editorMode).toBe("source");
    expect(prefs.wordWrap).toBe(false);
  });

  it("非法值回退默认字段", () => {
    const prefs = parseNotesTabViewPrefs({
      typography: { fontSizePx: "x" },
      markdownTheme: "nope",
      editorMode: "wat",
      wordWrap: "yes",
    });
    expect(prefs.typography.fontSizePx).toBe(DEFAULT_NOTES_TAB_VIEW_PREFS.typography.fontSizePx);
    expect(prefs.markdownTheme).toBe("inherit");
    expect(prefs.editorMode).toBe("rich");
    expect(prefs.wordWrap).toBe(true);
  });
});
