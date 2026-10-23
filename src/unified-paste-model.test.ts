// 场景：统一粘贴纯函数 — 接管判定、HTML/MD 抽图与改写。
import { describe, expect, it } from "vitest";
import {
  appendMarkdownBlocks,
  extractHtmlImageSrcs,
  extractMarkdownImageSrcs,
  extractUriListImageSrcs,
  hasHtmlImages,
  parseDataImageUrl,
  rewriteHtmlImages,
  rewriteMarkdownImages,
  shouldHandleUnifiedPaste,
  shouldPreferPlainTextBody,
  approximatePlainFromHtml,
  stripUnusableHtmlImages,
  isHostedPasteImageRewrite,
} from "./unified-paste-model";

describe("unified-paste-model", () => {
  it("decides when to take over paste", () => {
    expect(
      shouldHandleUnifiedPaste({
        textPlain: "plain only",
        textHtml: "",
        imageFiles: [],
        imageSrcHints: [],
        clipboardImages: [],
      }),
    ).toBe(false);
    expect(
      shouldHandleUnifiedPaste({
        textPlain: "# title\n\n- a\n- b",
        textHtml: "",
        imageFiles: [],
        imageSrcHints: [],
        clipboardImages: [],
      }),
    ).toBe(true);
    expect(
      shouldHandleUnifiedPaste({
        textPlain: "hello",
        textHtml: '<p>hello</p><img src="https://x/a.png" />',
        imageFiles: [],
        imageSrcHints: [],
        clipboardImages: [],
      }),
    ).toBe(true);
    const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    expect(
      shouldHandleUnifiedPaste({
        textPlain: "caption",
        textHtml: "",
        imageFiles: [file],
        imageSrcHints: [],
        clipboardImages: [],
      }),
    ).toBe(true);
    expect(
      shouldHandleUnifiedPaste({
        textPlain: "caption",
        textHtml: "",
        imageFiles: [],
        imageSrcHints: ["file:///var/folders/xx/tmp.png"],
        clipboardImages: [],
      }),
    ).toBe(true);
    expect(
      shouldHandleUnifiedPaste({
        textPlain: "caption",
        textHtml: "",
        imageFiles: [],
        imageSrcHints: [],
        clipboardImages: [{ bytesBase64: "aGVsbG8=", mimeType: "image/png" }],
      }),
    ).toBe(true);
  });

  it("prefers plain text when html flattened newlines (Notes/Electron)", () => {
    const plain = "第一行\n第二行\n第三行";
    const flatHtml = "<meta charset='utf-8'><div>第一行第二行第三行</div>";
    expect(shouldPreferPlainTextBody(plain, flatHtml)).toBe(true);
    expect(approximatePlainFromHtml(flatHtml)).toBe("第一行第二行第三行");

    const structured = "<ul><li>a</li><li>b</li></ul>";
    expect(shouldPreferPlainTextBody("a\nb", structured)).toBe(false);

    const withBr = "<div>第一行<br>第二行<br>第三行</div>";
    expect(shouldPreferPlainTextBody(plain, withBr)).toBe(false);
  });

  it("extracts html and markdown image srcs", () => {
    expect(
      extractHtmlImageSrcs(
        '<p>x</p><img src="https://a/x.png" alt="a"><img src="data:image/png;base64,aa">',
      ),
    ).toEqual(["https://a/x.png", "data:image/png;base64,aa"]);
    expect(extractHtmlImageSrcs("<p><img src=file:///var/folders/a/x.png width=100></p>")).toEqual([
      "file:///var/folders/a/x.png",
    ]);
    expect(extractHtmlImageSrcs('<img src="https://a/x.png?a=1&amp;b=2">')).toEqual([
      "https://a/x.png?a=1&b=2",
    ]);
    expect(extractMarkdownImageSrcs("hi ![a](https://a/x.png) and ![](/tmp/b.png)")).toEqual([
      "https://a/x.png",
      "/tmp/b.png",
    ]);
    expect(hasHtmlImages("<img src=x>")).toBe(true);
    expect(extractUriListImageSrcs("file:///tmp/a.png\nhttps://x/b.jpg")).toEqual([
      "file:///tmp/a.png",
      "https://x/b.jpg",
    ]);
  });

  it("parses data image urls", () => {
    const parsed = parseDataImageUrl("data:image/png;base64,aGVsbG8=");
    expect(parsed).toEqual({ mimeType: "image/png", bytesBase64: "aGVsbG8=" });
  });

  it("rewrites html and markdown image targets with normalized keys", () => {
    const html = rewriteHtmlImages('<p><img src="https://a/x.png?a=1&amp;b=2" alt="a"></p>', [
      {
        from: "https://a/x.png?a=1&b=2",
        managedUri: "/apps/data/agnx.notes/files/a.png",
        displaySrc: "blob:http://local/1",
        alt: "a",
      },
    ]);
    expect(html).toContain('src="blob:http://local/1"');
    expect(html).toContain('title="/apps/data/agnx.notes/files/a.png"');
    expect(html).toContain("agnx-notes-image");

    const md = rewriteMarkdownImages("para\n\n![a](https://a/x.png)\n", [
      {
        from: "https://a/x.png",
        managedUri: "/apps/data/agnx.notes/files/a.png",
        displaySrc: "blob:1",
        alt: "a",
      },
    ]);
    expect(md).toContain("![a](/apps/data/agnx.notes/files/a.png)");
    expect(md).not.toContain("https://a/x.png");
  });

  it("strips unusable local images after failed import", () => {
    const cleaned = stripUnusableHtmlImages(
      '<p>hi</p><img src="file:///var/folders/x.png"><img src="https://ok/a.png">',
    );
    expect(cleaned).toContain("https://ok/a.png");
    expect(cleaned).not.toContain("file://");
    expect(cleaned).toContain("hi");
  });

  it("appends markdown blocks", () => {
    expect(appendMarkdownBlocks("# A", "![i](/p.png)")).toBe("# A\n\n![i](/p.png)");
  });

  it("treats keep-remote https as not hosted so host bitmaps are kept", () => {
    expect(
      isHostedPasteImageRewrite({
        from: "https://cdn.example/a.png",
        managedUri: "https://cdn.example/a.png",
        displaySrc: "https://cdn.example/a.png",
      }),
    ).toBe(false);
    expect(
      isHostedPasteImageRewrite({
        from: "file:///var/folders/x.png",
        managedUri: "/Users/a/.agnx-dev/apps/data/agnx.notes/files/a.png",
        displaySrc: "blob:http://local/1",
      }),
    ).toBe(true);
  });
});
