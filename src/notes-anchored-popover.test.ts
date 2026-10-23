// 场景：笔记浮层锚定几何 — 水平居中夹紧、上下 placement。
import { describe, expect, it } from "vitest";
import {
  computeNotesAnchoredStyle,
  computeNotesFallbackAnchoredStyle,
} from "./notes-anchored-popover";

describe("computeNotesAnchoredStyle", () => {
  it("centers above the trigger and clamps to the viewport", () => {
    const style = computeNotesAnchoredStyle({
      rect: {
        left: 100,
        top: 400,
        width: 40,
        height: 28,
        right: 140,
        bottom: 428,
        x: 100,
        y: 400,
        toJSON: () => ({}),
      },
      placement: "above",
      panelWidth: 200,
      gap: 6,
      viewportWidth: 320,
      viewportHeight: 700,
    });
    expect(style.position).toBe("fixed");
    expect(style.left).toBe(20);
    expect(style.bottom).toBe(700 - 400 + 6);
  });

  it("places below the trigger", () => {
    const style = computeNotesAnchoredStyle({
      rect: {
        left: 50,
        top: 80,
        width: 48,
        height: 24,
        right: 98,
        bottom: 104,
        x: 50,
        y: 80,
        toJSON: () => ({}),
      },
      placement: "below",
      panelWidth: 148,
      gap: 6,
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(style.top).toBe(110);
    expect(style.left).toBe(Math.max(8, 50 + 24 - 74));
  });

  it("keeps center alignment for right-toolbar buttons", () => {
    const style = computeNotesAnchoredStyle({
      rect: {
        left: 900,
        top: 700,
        width: 36,
        height: 28,
        right: 936,
        bottom: 728,
        x: 900,
        y: 700,
        toJSON: () => ({}),
      },
      placement: "above",
      panelWidth: 200,
      gap: 6,
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    // 居中：900 + 18 - 100 = 818
    expect(style.left).toBe(818);
    expect(style.bottom).toBe(800 - 700 + 6);
  });

  it("align=start pins left to the trigger", () => {
    const style = computeNotesAnchoredStyle({
      rect: {
        left: 200,
        top: 80,
        width: 64,
        height: 28,
        right: 264,
        bottom: 108,
        x: 200,
        y: 80,
        toJSON: () => ({}),
      },
      placement: "below",
      panelWidth: 148,
      align: "start",
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(style.left).toBe(200);
    expect(style.top).toBe(114);
  });

  it("provides a bottom-centered fallback when the trigger is missing", () => {
    const style = computeNotesFallbackAnchoredStyle({
      placement: "above",
      panelWidth: 200,
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(style.position).toBe("fixed");
    expect(style.left).toBe(540);
    expect(style.bottom).toBe(64);
    expect(style.zIndex).toBe(10050);
  });
});
