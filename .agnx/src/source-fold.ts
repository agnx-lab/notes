// 场景：源码面折叠 — @codemirror/lang-markdown 自带 headerIndent + 官方 foldGutter；
// 「全部折叠」在官方 foldable 上做递归应用（父级只折导语，保留子标题大纲）。
import { type EditorState, type Extension, type StateEffectType } from "@codemirror/state";
import {
  codeFolding,
  ensureSyntaxTree,
  foldEffect,
  foldGutter,
  foldable,
  foldedRanges,
  unfoldAll,
  unfoldEffect,
} from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

const ATX_HEADING = /^(#{1,6})[ \t]+\S/;

/** 大文档必须先解析完整语法树，否则 foldable 会把未解析区当成「无子标题」整段吞掉。 */
function ensureMarkdownTree(state: EditorState): void {
  ensureSyntaxTree(state, state.doc.length, 8000);
  syntaxTree(state);
}

/** 读官方 foldable（markdown headerIndent）在标题行上的结果。 */
export function markdownHeadingFoldRange(
  state: EditorState,
  lineStart: number,
  lineEnd: number,
): { from: number; to: number } | null {
  return foldable(state, lineStart, lineEnd);
}

export function listSourceFoldableHeadingRanges(
  state: EditorState,
): Array<{ from: number; to: number; level: number; headingFrom: number }> {
  ensureMarkdownTree(state);
  const ranges: Array<{ from: number; to: number; level: number; headingFrom: number }> = [];
  for (let n = 1; n <= state.doc.lines; n += 1) {
    const line = state.doc.line(n);
    const match = ATX_HEADING.exec(line.text);
    if (!match) {
      continue;
    }
    const range = foldable(state, line.from, line.to);
    if (!range) {
      continue;
    }
    ranges.push({
      from: range.from,
      to: range.to,
      level: match[1]!.length,
      headingFrom: line.from,
    });
  }
  return ranges;
}

export function listSourceHeadingFoldRanges(state: EditorState) {
  return listSourceFoldableHeadingRanges(state).map((r) => ({
    headingFrom: r.headingFrom,
    hideFrom: r.from,
    hideTo: r.to,
    level: r.level,
  }));
}

export function isSourceHeadingFolded(
  state: EditorState,
  range: { from: number; to: number },
): boolean {
  let found = false;
  foldedRanges(state).between(range.from, range.from, (from, to) => {
    if (from === range.from && to === range.to) {
      found = true;
    }
  });
  return found;
}

function pinScrollAroundHeading(view: EditorView, headingFrom: number, run: () => void) {
  const beforeTop = view.lineBlockAt(headingFrom).top;
  const beforeScroll = view.scrollDOM.scrollTop;
  const anchorInView = beforeTop - beforeScroll;
  run();
  const restore = () => {
    const afterTop = view.lineBlockAt(headingFrom).top;
    view.scrollDOM.scrollTop = Math.max(0, afterTop - anchorInView);
  };
  view.requestMeasure();
  restore();
  requestAnimationFrame(restore);
}

export function notesSourceHeadingFoldExtensions(): Extension {
  return [
    codeFolding({
      placeholderDOM: () => {
        const el = document.createElement("span");
        el.className = "cm-foldPlaceholder agnx-notes-cm-fold-ph";
        el.setAttribute("aria-hidden", "true");
        el.style.display = "none";
        return el;
      },
    }),
    foldGutter({
      openText: "▾",
      closedText: "▸",
      markerDOM: (open) => {
        const el = document.createElement("span");
        el.className = `agnx-notes-cm-fold-marker${open ? "" : " folded"}`;
        el.textContent = open ? "▾" : "▸";
        el.title = open ? "折叠" : "展开";
        return el;
      },
      domEventHandlers: {
        click: (view, line) => {
          let folded: { from: number; to: number } | null = null;
          foldedRanges(view.state).between(line.from, line.to, (from, to) => {
            if (!folded || folded.from > from) {
              folded = { from, to };
            }
          });
          const range = foldable(view.state, line.from, line.to);
          if (folded) {
            pinScrollAroundHeading(view, line.from, () => {
              view.dispatch({ effects: unfoldEffect.of(folded!) });
            });
            return true;
          }
          if (range) {
            pinScrollAroundHeading(view, line.from, () => {
              view.dispatch({ effects: foldEffect.of(range) });
            });
            return true;
          }
          return false;
        },
      },
    }),
  ];
}

/** 源码「全部折叠」：按 ATX 标题行切段，折到下一标题前（大纲递归，绝不吞子标题）。
 * 单行三角仍走官方 foldable/headerIndent。 */
function listAtxHeadingLines(state: EditorState): Array<{ lineFrom: number; lineTo: number }> {
  const out: Array<{ lineFrom: number; lineTo: number }> = [];
  for (let n = 1; n <= state.doc.lines; n += 1) {
    const line = state.doc.line(n);
    if (ATX_HEADING.exec(line.text)) {
      out.push({ lineFrom: line.from, lineTo: line.to });
    }
  }
  return out;
}

export function listOutlineFoldAllTargets(state: EditorState): Array<{ from: number; to: number }> {
  const heads = listAtxHeadingLines(state);
  const targets: Array<{ from: number; to: number }> = [];
  for (let i = 0; i < heads.length; i += 1) {
    const cur = heads[i]!;
    const next = heads[i + 1];
    let from = cur.lineTo;
    const to = next ? next.lineFrom : state.doc.length;
    // 有下一标题时跳过标题后首个换行，避免 `# A` 与 `## a1` 粘行
    if (next && from < to && state.doc.sliceString(from, from + 1) === "\n") {
      from += 1;
    }
    if (from < to && state.doc.sliceString(from, to).trim()) {
      targets.push({ from, to });
    }
  }
  return targets;
}

export function foldAllSourceHeadings(view: EditorView): void {
  // 先清空，避免残留的官方顶层 fold 继续吞大纲
  unfoldAll(view);
  const targets = listOutlineFoldAllTargets(view.state);
  if (targets.length === 0) {
    return;
  }
  view.dispatch({
    effects: targets.map((range) => foldEffect.of(range)),
  });
}

export function getSourceFoldAllState(view: EditorView): { foldedAll: boolean; foldable: number } {
  const targets = listOutlineFoldAllTargets(view.state);
  let foldedCount = 0;
  for (const range of targets) {
    if (isSourceHeadingFolded(view.state, range)) {
      foldedCount += 1;
    }
  }
  return {
    foldable: targets.length,
    foldedAll: targets.length > 0 && foldedCount >= targets.length,
  };
}

export function toggleSourceFoldAll(view: EditorView): { foldedAll: boolean; foldable: number } {
  const before = getSourceFoldAllState(view);
  if (before.foldedAll) {
    unfoldAll(view);
  } else {
    foldAllSourceHeadings(view);
  }
  return getSourceFoldAllState(view);
}

export function isSourceFoldEffect(effect: {
  is: (type: StateEffectType<unknown>) => boolean;
}): boolean {
  return effect.is(foldEffect) || effect.is(unfoldEffect);
}

export const sourceFoldEffect = foldEffect;
export const sourceUnfoldEffect = unfoldEffect;

export function findHeadingRangeInBlock(
  state: EditorState,
  blockFrom: number,
  blockTo: number,
): { from: number; to: number } | null {
  syntaxTree(state);
  for (let pos = Math.max(0, blockFrom); pos <= Math.min(blockTo, state.doc.length); ) {
    const docLine = state.doc.lineAt(Math.min(pos, state.doc.length));
    if (ATX_HEADING.exec(docLine.text)) {
      const range = foldable(state, docLine.from, docLine.to);
      if (range) {
        return range;
      }
    }
    if (docLine.to >= state.doc.length) {
      break;
    }
    const next = docLine.to + 1;
    if (next <= pos) {
      break;
    }
    pos = next;
  }
  return null;
}

export function dispatchFoldPreservingScroll(
  view: EditorView,
  range: { from: number; to: number },
  fold: boolean,
): void {
  const line = view.state.doc.lineAt(Math.max(0, range.from - 1));
  pinScrollAroundHeading(view, line.from, () => {
    view.dispatch({
      effects: fold ? foldEffect.of(range) : unfoldEffect.of(range),
    });
  });
}
