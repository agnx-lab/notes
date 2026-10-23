// 场景：源码标题折叠 — 官方 markdown headerIndent + foldGutter/foldAll。
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { foldedRanges } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { JSDOM } from "jsdom";
import {
  foldAllSourceHeadings,
  getSourceFoldAllState,
  isSourceHeadingFolded,
  listSourceFoldableHeadingRanges,
  markdownHeadingFoldRange,
  notesSourceHeadingFoldExtensions,
  toggleSourceFoldAll,
} from "./source-fold";

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

function createView(doc: string) {
  const host = installDom();
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc,
      extensions: [markdown(), notesSourceHeadingFoldExtensions()],
    }),
  });
  return { host, view };
}

describe("markdownHeadingFoldRange (official headerIndent)", () => {
  it("folds from heading line end until next same-or-higher heading", () => {
    const state = EditorState.create({
      doc: "## A\na-body\n\n## B\nb-body\n\n## C\nc",
      extensions: [markdown()],
    });
    const lineA = state.doc.line(1);
    const range = markdownHeadingFoldRange(state, lineA.from, lineA.to);
    expect(range).not.toBeNull();
    expect(range!.from).toBe(lineA.to);
    let lineBFrom = -1;
    for (let n = 1; n <= state.doc.lines; n += 1) {
      if (state.doc.line(n).text.startsWith("## B")) {
        lineBFrom = state.doc.line(n).from;
        break;
      }
    }
    expect(range!.to).toBeGreaterThan(range!.from);
    expect(range!.to).toBeLessThanOrEqual(lineBFrom);
  });
});

describe("foldAllSourceHeadings runtime", () => {
  it("fold-all folds every section body and keeps nested headings visible", () => {
    const { host, view } = createView(
      ["# A", "intro", "## a1", "x", "## a2", "y", "# B", "z"].join("\n"),
    );
    foldAllSourceHeadings(view);
    const headings = [...host.querySelectorAll(".cm-line")]
      .map((el) => el.textContent ?? "")
      .filter((t) => /^#{1,6}\s/.test(t));
    // 递归大纲：子标题仍可见，不能只剩顶级
    expect(headings).toEqual(["# A", "## a1", "## a2", "# B"]);
    expect(getSourceFoldAllState(view).foldedAll).toBe(true);
    expect([...host.querySelectorAll(".cm-line")].map((el) => el.textContent)).not.toContain(
      "intro",
    );
    view.destroy();
  });

  it("fold-all on large doc keeps all nested headings (forces full parse)", () => {
    const parts: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      parts.push(`# H${i}`, `intro${i}`, `## H${i}.1`, `body${i}.1`, `## H${i}.2`, `body${i}.2`);
    }
    const { view } = createView(parts.join("\n"));
    foldAllSourceHeadings(view);
    const folds: Array<{ from: number; to: number }> = [];
    foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
      folds.push({ from, to });
    });
    expect(folds.length).toBe(120);
    let visibleHeads = 0;
    let hiddenHeads = 0;
    for (let n = 1; n <= view.state.doc.lines; n += 1) {
      const line = view.state.doc.line(n);
      if (!/^#{1,6}\s/.test(line.text)) {
        continue;
      }
      const inFold = folds.some((f) => line.from >= f.from && line.from < f.to);
      if (inFold) {
        hiddenHeads += 1;
      } else {
        visibleHeads += 1;
      }
    }
    // jsdom 视口高度为 0 时 DOM 只画局部；以「标题行未被 fold 区间吞掉」为准
    expect(hiddenHeads).toBe(0);
    expect(visibleHeads).toBe(120);
    expect(getSourceFoldAllState(view).foldedAll).toBe(true);
    view.destroy();
  });

  it("toggle fold-all unfolds", () => {
    const { view } = createView("## A\nbody-a\n\n## B\nbody-b\n\n## C\nbody-c");
    foldAllSourceHeadings(view);
    let foldCount = 0;
    foldedRanges(view.state).between(0, view.state.doc.length, () => {
      foldCount += 1;
    });
    expect(foldCount).toBeGreaterThan(0);
    expect(toggleSourceFoldAll(view).foldedAll).toBe(false);
    view.destroy();
  });

  it("lists foldable heading ranges from official foldable", () => {
    const { view } = createView(["## 0. a", "body0", "## 1. b", "body1"].join("\n"));
    const ranges = listSourceFoldableHeadingRanges(view.state);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
    for (const r of ranges) {
      expect(isSourceHeadingFolded(view.state, r)).toBe(false);
    }
    foldAllSourceHeadings(view);
    expect(getSourceFoldAllState(view).foldedAll).toBe(true);
    expect(getSourceFoldAllState(view).foldable).toBeGreaterThanOrEqual(2);
    view.destroy();
  });
});
