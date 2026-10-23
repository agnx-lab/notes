// 场景：官方 foldGutter 下折叠后标题行有三角。
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { JSDOM } from "jsdom";
import { foldAllSourceHeadings, notesSourceHeadingFoldExtensions } from "./source-fold";

function installDom(): HTMLElement {
  const dom = new JSDOM("<!doctype html><html><body><div id='host'></div></body></html>", {
    pretendToBeVisual: true,
  });
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Window: window.Window,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number,
    MutationObserver:
      window.MutationObserver ??
      class {
        observe() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    ResizeObserver:
      (window as unknown as { ResizeObserver?: unknown }).ResizeObserver ??
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
  });
  return window.document.getElementById("host")!;
}

const SAMPLE = [
  "# Title",
  "intro line",
  "",
  "## 0. a",
  "body0",
  "## 1. b",
  "body1",
  "## 2. c",
  "body2",
].join("\n");

function visibleFoldMarkers(host: HTMLElement) {
  return [...host.querySelectorAll(".cm-foldGutter .cm-gutterElement")].filter(
    (el) =>
      (el as HTMLElement).style.visibility !== "hidden" &&
      (el as HTMLElement).style.height !== "0px" &&
      (el.textContent === "▸" || el.textContent === "▾"),
  );
}

describe("official fold gutter", () => {
  it("shows fold markers on headings after fold-all", () => {
    const host = installDom();
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: SAMPLE,
        extensions: [markdown(), notesSourceHeadingFoldExtensions(), lineNumbers()],
      }),
    });
    foldAllSourceHeadings(view);
    const markers = visibleFoldMarkers(host);
    expect(markers.length).toBeGreaterThanOrEqual(1);
    expect(markers.some((el) => el.textContent === "▸")).toBe(true);
    expect(host.textContent ?? "").not.toMatch(/…/);
    view.destroy();
  });
});
