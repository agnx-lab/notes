// 场景：chrome 定位合同 — 上方贴合且 top 可为负；右对齐用 right 锚定。
import { describe, expect, it } from "vitest";
import {
  computeNotesChromeAboveEnd,
  computeNotesChromeAboveStart,
  isNotesTargetInHostView,
} from "./notes-chrome-position";

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("notes chrome position", () => {
  it("上方起点：top 相对目标顶上，不夹到 4", () => {
    const host = rect(100, 100, 400, 500);
    const target = rect(120, 110, 200, 80);
    const pos = computeNotesChromeAboveStart({
      host,
      target,
      chromeHeight: 40,
      chromeWidth: 280,
      gap: 8,
    });
    expect(pos.top).toBe(110 - 100 - 40 - 8);
    expect(pos.top).toBeLessThan(4);
    expect(pos.left).toBe(20);
  });

  it("目标滚出宿主顶部时判定不可见", () => {
    const host = rect(0, 200, 400, 400);
    const target = rect(10, 100, 100, 50);
    expect(isNotesTargetInHostView(host, target)).toBe(false);
  });

  it("右对齐上方用 right 锚定，不依赖准确宽度", () => {
    const host = rect(0, 0, 500, 400);
    const target = rect(100, 20, 200, 100);
    const posWideGuess = computeNotesChromeAboveEnd({
      host,
      target,
      chromeHeight: 44,
      chromeWidth: 420,
      gap: 8,
    });
    const posNarrowGuess = computeNotesChromeAboveEnd({
      host,
      target,
      chromeHeight: 44,
      chromeWidth: 180,
      gap: 8,
    });
    expect(posWideGuess.top).toBe(20 - 0 - 44 - 8);
    expect(posWideGuess.top).toBeLessThan(0);
    // 目标右缘距宿主右缘 200；窄估算时 right 应为 200
    expect(posNarrowGuess.right).toBe(500 - 300);
    // 过宽估算会夹紧，但仍是 right 字段
    expect(posWideGuess.right).toBe(Math.max(0, 500 - 420 - 4));
  });
});
