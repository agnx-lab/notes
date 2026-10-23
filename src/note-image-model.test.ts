// 场景：笔记图片路径判定与 markdown 序列化纯函数单测。
import { describe, expect, it } from "vitest";
import {
  buildImageMarkdown,
  collectImageFilesFromDataTransfer,
  decodeHtmlEntities,
  extensionFromImageMime,
  isAppsDataFilesPath,
  isEphemeralImageSrc,
  isImageFileLike,
  isStableImageSrc,
  normalizeImageSrcKey,
  normalizeLocalImagePath,
  resolveImageManagedUri,
} from "./note-image-model";

describe("note-image-model", () => {
  it("classifies ephemeral and stable srcs", () => {
    expect(isEphemeralImageSrc("blob:http://x")).toBe(true);
    expect(isEphemeralImageSrc("data:image/png;base64,abc")).toBe(true);
    expect(isStableImageSrc("/Users/a/.agnx/apps/data/agnx.notes/files/x.png")).toBe(true);
    expect(isStableImageSrc("https://example.com/a.png")).toBe(true);
    expect(isStableImageSrc("blob:http://x")).toBe(false);
  });

  it("normalizes file urls and apps data paths", () => {
    expect(normalizeLocalImagePath("file:///Users/a/x.png")).toBe("/Users/a/x.png");
    expect(normalizeLocalImagePath("/tmp/a.png")).toBe("/tmp/a.png");
    expect(normalizeLocalImagePath("https://x/a.png")).toBe(null);
    expect(isAppsDataFilesPath("/Users/a/.agnx-dev/apps/data/agnx.notes/files/a.png")).toBe(true);
    expect(isAppsDataFilesPath("/tmp/a.png")).toBe(false);
  });

  it("prefers title managed path over blob src", () => {
    expect(
      resolveImageManagedUri({
        src: "blob:http://tmp",
        title: "/tmp/apps/data/agnx.notes/files/a.png",
      }),
    ).toBe("/tmp/apps/data/agnx.notes/files/a.png");
  });

  it("builds markdown image syntax", () => {
    expect(buildImageMarkdown("图", "/path/with spaces.png")).toBe("![图](/path/with spaces.png)");
  });

  it("maps mime to extension", () => {
    expect(extensionFromImageMime("image/png")).toBe(".png");
    expect(extensionFromImageMime("image/jpeg; charset=binary")).toBe(".jpg");
  });

  it("accepts image files with empty mime by extension", () => {
    const typed = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    const untyped = new File([new Uint8Array([1])], "b.jpg", { type: "" });
    expect(isImageFileLike(typed)).toBe(true);
    expect(isImageFileLike(untyped)).toBe(true);
    const files = collectImageFilesFromDataTransfer({
      files: [typed, untyped] as unknown as FileList,
      items: [] as unknown as DataTransferItemList,
    } as DataTransfer);
    expect(files).toHaveLength(2);
  });

  it("normalizes image src keys and html entities", () => {
    expect(decodeHtmlEntities("https://a/x.png?a=1&amp;b=2")).toBe("https://a/x.png?a=1&b=2");
    expect(normalizeImageSrcKey("file:///Users/a/x.png")).toBe("/Users/a/x.png");
    expect(normalizeImageSrcKey("//cdn.example/a.png")).toBe("https://cdn.example/a.png");
  });
});
