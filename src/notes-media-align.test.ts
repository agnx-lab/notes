// 场景：笔记媒体对齐解析 — 默认 left，非法值回退。
import { describe, expect, it } from "vitest";
import { cycleNotesMediaAlign, parseNotesMediaAlign } from "./notes-media-align";

describe("parseNotesMediaAlign", () => {
  it("accepts left/center/right", () => {
    expect(parseNotesMediaAlign("left")).toBe("left");
    expect(parseNotesMediaAlign("center")).toBe("center");
    expect(parseNotesMediaAlign("right")).toBe("right");
  });

  it("falls back to left", () => {
    expect(parseNotesMediaAlign(null)).toBe("left");
    expect(parseNotesMediaAlign("")).toBe("left");
    expect(parseNotesMediaAlign("justify")).toBe("left");
  });
});

describe("cycleNotesMediaAlign", () => {
  it("cycles left → center → right → left", () => {
    expect(cycleNotesMediaAlign("left")).toBe("center");
    expect(cycleNotesMediaAlign("center")).toBe("right");
    expect(cycleNotesMediaAlign("right")).toBe("left");
  });
});
