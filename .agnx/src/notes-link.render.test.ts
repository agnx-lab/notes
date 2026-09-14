// 场景：Markdown [text](url) / linkify 裸链 → TipTap HTML <a>（富文本面必须渲染链接）。
import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { isNotesLinkHrefAllowed } from "./notes-link";

function installDom() {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true });
  const { window } = dom;
  Object.defineProperty(globalThis, "window", { value: window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: window.document, configurable: true });
  Object.defineProperty(globalThis, "Node", { value: window.Node, configurable: true });
  Object.defineProperty(globalThis, "innerHeight", { value: 800, configurable: true });
  Object.defineProperty(globalThis, "innerWidth", { value: 1200, configurable: true });
  Object.defineProperty(globalThis, "getComputedStyle", {
    value: window.getComputedStyle.bind(window),
    configurable: true,
  });
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(cb, 0) as unknown as number;
  return dom;
}

describe("notes markdown link render", () => {
  let dom: JSDOM | undefined;

  afterEach(() => {
    dom?.window.close();
    dom = undefined;
  });

  it("renders [text](https://...) as anchor in rich HTML", () => {
    dom = installDom();
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [
        StarterKit,
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: { class: "agnx-notes-link" },
          isAllowedUri: (url) => isNotesLinkHrefAllowed(url),
        }),
        Markdown.configure({
          html: true,
          breaks: true,
          linkify: true,
          transformPastedText: false,
        }),
      ],
      content: "见 [官方](https://example.com/docs) 与相对 [仓内](../foo.md)。",
    });
    const html = editor.getHTML();
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('href="../foo.md"');
    expect(html).toContain("agnx-notes-link");
    expect(html).not.toContain("[官方]");
    editor.destroy();
  });

  it("linkify turns bare https URL into anchor", () => {
    dom = installDom();
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [
        StarterKit,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { class: "agnx-notes-link" },
          isAllowedUri: (url) => isNotesLinkHrefAllowed(url),
        }),
        Markdown.configure({
          html: true,
          breaks: true,
          linkify: true,
          transformPastedText: false,
        }),
      ],
      content: "裸链 https://plain.example.com 结束",
    });
    const html = editor.getHTML();
    expect(html).toMatch(/href="https:\/\/plain\.example\.com\/?"/);
    editor.destroy();
  });
});
