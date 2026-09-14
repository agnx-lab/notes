// 场景：笔记图片默认展示宽度计算。
import { describe, expect, it } from "vitest";
import {
  NOTES_IMAGE_DEFAULT_MAX_WIDTH_PX,
  NOTES_IMAGE_MIN_WIDTH_PX,
  resolveNotesImageDisplayWidth,
} from "./notes-image";

describe("resolveNotesImageDisplayWidth", () => {
  it("caps large natural width to default max", () => {
    expect(
      resolveNotesImageDisplayWidth({
        naturalWidth: 2400,
        editorWidth: 900,
      }),
    ).toBe(NOTES_IMAGE_DEFAULT_MAX_WIDTH_PX);
  });

  it("respects smaller natural width", () => {
    expect(
      resolveNotesImageDisplayWidth({
        naturalWidth: 240,
        editorWidth: 900,
      }),
    ).toBe(240);
  });

  it("never goes below minimum", () => {
    expect(
      resolveNotesImageDisplayWidth({
        naturalWidth: 10,
        editorWidth: 900,
      }),
    ).toBe(NOTES_IMAGE_MIN_WIDTH_PX);
  });
});
