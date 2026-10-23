// 场景：笔记附件分类 — 扩展名 / mime / uri 探测与字节格式化。
import { describe, expect, it } from "vitest";
import { formatNotesAttachmentBytes, resolveNotesAttachmentKind } from "./note-attachment-model";

describe("resolveNotesAttachmentKind", () => {
  it("classifies images, audio, video and generic files", () => {
    expect(resolveNotesAttachmentKind({ fileName: "a.png", mimeType: "image/png" })).toBe("image");
    expect(resolveNotesAttachmentKind({ fileName: "a.mp3" })).toBe("audio");
    expect(resolveNotesAttachmentKind({ fileName: "a.mp4" })).toBe("video");
    expect(resolveNotesAttachmentKind({ fileName: "a.pdf", mimeType: "application/pdf" })).toBe(
      "file",
    );
  });

  it("falls back to uri extension when display title has no ext", () => {
    expect(
      resolveNotesAttachmentKind({
        fileName: "枪火-宝石Gem",
        uri: "/apps/data/agnx.notes/files/song.mp3",
      }),
    ).toBe("audio");
  });
});

describe("formatNotesAttachmentBytes", () => {
  it("formats byte sizes", () => {
    expect(formatNotesAttachmentBytes(512)).toBe("512 B");
    expect(formatNotesAttachmentBytes(2048)).toBe("2.0 KB");
    expect(formatNotesAttachmentBytes(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(formatNotesAttachmentBytes(null)).toBe("");
  });
});
