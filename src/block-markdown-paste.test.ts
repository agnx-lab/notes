// 场景：块级 Markdown 粘贴 — 围栏判定；codeBlock 内先跳出。
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { JSDOM } from "jsdom";
import { NotesCodeBlock } from "./notes-code-block";
import { clipboardLooksLikeBlockMarkdown, prepareBlockMarkdownPaste } from "./block-markdown-paste";

function installDom(): HTMLElement {
  const dom = new JSDOM("<!doctype html><html><body><div id='e'></div></body></html>", {
    pretendToBeVisual: true,
  });
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    DocumentFragment: window.DocumentFragment,
    Node: window.Node,
    Element: window.Element,
    innerHeight: 800,
    innerWidth: 1200,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number,
  });
  return window.document.getElementById("e")!;
}

describe("block-markdown-paste", () => {
  it("clipboardLooksLikeBlockMarkdown 识别围栏/标题", () => {
    expect(clipboardLooksLikeBlockMarkdown("hello")).toBe(false);
    expect(clipboardLooksLikeBlockMarkdown("```mermaid\ngraph TD\nA-->B\n```")).toBe(true);
    expect(clipboardLooksLikeBlockMarkdown("# 标题\n\n正文")).toBe(true);
  });

  it("prepareBlockMarkdownPaste 把选区移出 codeBlock", () => {
    const el = installDom();
    const editor = new Editor({
      element: el,
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        NotesCodeBlock,
        Markdown.configure({ html: true }),
      ],
      content: "```mermaid\nsequenceDiagram\n  A->>B: hi\n```",
    });
    editor.commands.setTextSelection(2);
    expect(editor.isActive("codeBlock")).toBe(true);
    expect(prepareBlockMarkdownPaste(editor)).toBe(true);
    expect(editor.isActive("codeBlock")).toBe(false);
    editor.destroy();
  });
});
