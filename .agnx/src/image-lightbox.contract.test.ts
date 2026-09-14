// 场景：图片灯箱合同 — 双击预览入口与 portal 关闭方式存在。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("notes image lightbox", () => {
  it("wires dblclick on scroll host to lightbox", () => {
    const view = readFileSync(resolve(__dirname, "image-view-container.tsx"), "utf8");
    expect(view).toMatch(/addEventListener\("dblclick"/);
    expect(view).toMatch(/NotesImageLightbox/);
    expect(view).toMatch(/setLightbox/);
  });

  it("portals lightbox to document.body and closes on Escape", () => {
    const box = readFileSync(resolve(__dirname, "image-lightbox.tsx"), "utf8");
    expect(box).toMatch(/createPortal/);
    expect(box).toMatch(/Escape/);
    expect(box).toMatch(/agnx-notes-image-lightbox/);
  });

  it("supports pinch-vs-scroll wheel split and bottom chrome path copy", () => {
    const box = readFileSync(resolve(__dirname, "image-lightbox.tsx"), "utf8");
    expect(box).toMatch(/ctrlKey/);
    expect(box).toMatch(/agnx-notes-image-lightbox-chrome/);
    expect(box).toMatch(/已复制路径|copyPath/);
    expect(box).not.toMatch(/双指滑动平移/);
  });
});
