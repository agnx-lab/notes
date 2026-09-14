// 场景：笔记排版滑块范围与设值单测。
import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTES_TYPOGRAPHY,
  formatNotesTypographyValue,
  resolveNotesProseMaxWidthCss,
  setNotesTypographyValue,
} from "./notes-typography";

describe("notes-typography", () => {
  it("sets continuous slider values with clamp", () => {
    const next = setNotesTypographyValue(DEFAULT_NOTES_TYPOGRAPHY, "fontSize", 22);
    expect(next.fontSizePx).toBe(22);
    expect(setNotesTypographyValue(next, "fontSize", 99).fontSizePx).toBe(28);
    expect(setNotesTypographyValue(next, "lineHeight", 1.85).lineHeight).toBe(1.85);
  });

  it("pageWidth 默认 100%，左窄右宽", () => {
    expect(DEFAULT_NOTES_TYPOGRAPHY.pageWidthPercent).toBe(100);
    expect(resolveNotesProseMaxWidthCss(100)).toBe("100%");
    expect(formatNotesTypographyValue("pageWidth", DEFAULT_NOTES_TYPOGRAPHY)).toBe("100%");
    const narrow = setNotesTypographyValue(DEFAULT_NOTES_TYPOGRAPHY, "pageWidth", 55);
    expect(narrow.pageWidthPercent).toBe(55);
    expect(resolveNotesProseMaxWidthCss(55)).toBe("55%");
    expect(setNotesTypographyValue(DEFAULT_NOTES_TYPOGRAPHY, "pageWidth", 0).pageWidthPercent).toBe(
      40,
    );
  });
});
