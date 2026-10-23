// 场景：笔记附件播放 URI 缓存与 ephemeral 判定。
import { describe, expect, it } from "vitest";
import {
  isDirectPlayableAttachmentSrc,
  isEphemeralAttachmentSrc,
  rememberNotesAttachmentPlaySrc,
  peekNotesAttachmentPlaySrcCache,
  forgetNotesAttachmentPlaySrc,
} from "./notes-attachment-src";

describe("notes-attachment-src", () => {
  it("classifies ephemeral and direct playable sources", () => {
    expect(isEphemeralAttachmentSrc("blob:http://x")).toBe(true);
    expect(isEphemeralAttachmentSrc("data:audio/mpeg;base64,aa")).toBe(true);
    expect(isEphemeralAttachmentSrc("/Users/a/file.mp3")).toBe(false);
    expect(isDirectPlayableAttachmentSrc("https://x/a.mp3")).toBe(true);
    expect(isDirectPlayableAttachmentSrc("blob:http://x")).toBe(false);
  });

  it("remembers and forgets play src cache by managed path", () => {
    const managed = "/tmp/notes-av-cache-test.mp3";
    forgetNotesAttachmentPlaySrc(managed);
    rememberNotesAttachmentPlaySrc(managed, "blob:http://cached");
    expect(peekNotesAttachmentPlaySrcCache(managed)).toBe("blob:http://cached");
    forgetNotesAttachmentPlaySrc(managed);
    expect(peekNotesAttachmentPlaySrcCache(managed)).toBeUndefined();
  });
});
