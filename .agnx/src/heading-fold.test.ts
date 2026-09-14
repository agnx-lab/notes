// 场景：标题折叠区间计算单测。
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { JSDOM } from "jsdom";
import {
  createHeadingFoldExtension,
  headingCanFold,
  headingSectionRange,
  setAllHeadingFolds,
  shouldExpandAllHeadings,
  listFoldableHeadingPositions,
} from "./heading-fold";

function installDom(): void {
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
}

function findHeadingPos(editor: Editor, level: number): number | null {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading" && node.attrs.level === level) {
      found = pos;
      return false;
    }
  });
  return found;
}

describe("heading-fold", () => {
  it("computes foldable section under a heading", () => {
    installDom();
    const el = document.getElementById("e")!;
    const editor = new Editor({
      element: el,
      extensions: [StarterKit, createHeadingFoldExtension()],
      content: "<h1>A</h1><p>body</p><h2>B</h2><p>x</p>",
    });
    const h1Pos = findHeadingPos(editor, 1);
    expect(h1Pos).not.toBeNull();
    expect(headingCanFold(editor, h1Pos!)).toBe(true);
    const range = headingSectionRange(editor, h1Pos!);
    expect(range).not.toBeNull();
    expect(range!.to).toBeGreaterThan(range!.from);
    editor.destroy();
  });

  it("setAllHeadingFolds folds and expands all foldable headings", () => {
    installDom();
    const el = document.getElementById("e")!;
    const editor = new Editor({
      element: el,
      extensions: [StarterKit, createHeadingFoldExtension()],
      content: "<h1>A</h1><p>body</p><h2>B</h2><p>x</p><h1>C</h1><p>y</p>",
    });
    const foldable = listFoldableHeadingPositions(editor);
    expect(foldable.length).toBeGreaterThan(0);
    setAllHeadingFolds(editor, true);
    expect(shouldExpandAllHeadings(editor)).toBe(true);
    setAllHeadingFolds(editor, false);
    expect(shouldExpandAllHeadings(editor)).toBe(false);
    editor.destroy();
  });

  it("h2 fold range stops at next sibling h2 (does not swallow peers)", () => {
    installDom();
    const el = document.getElementById("e")!;
    const editor = new Editor({
      element: el,
      extensions: [StarterKit, createHeadingFoldExtension()],
      content: "<h2>A</h2><p>a-body</p><h2>B</h2><p>b-body</p><h2>C</h2><p>c-body</p>",
    });
    const positions: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading" && node.attrs.level === 2) {
        positions.push(pos);
      }
    });
    expect(positions.length).toBe(3);
    const rangeA = headingSectionRange(editor, positions[0]!);
    const rangeB = headingSectionRange(editor, positions[1]!);
    expect(rangeA).not.toBeNull();
    expect(rangeB).not.toBeNull();
    // A 的区间止于 B 标题起点，不得把 B/C 吞进去
    expect(rangeA!.to).toBe(positions[1]);
    expect(rangeA!.to).toBeLessThan(positions[2]!);
    expect(rangeB!.to).toBe(positions[2]);
    editor.destroy();
  });
});
