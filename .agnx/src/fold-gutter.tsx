// 场景：左侧折叠轨 — 按钮水平跟着正文栏（页面宽度收窄后不再钉死在编辑区左缘）。
import { useEffect, useState } from "react";
import { createElement } from "react";
import type { Editor } from "@tiptap/core";
import { headingCanFold, isHeadingFolded, toggleHeadingFold } from "./heading-fold";

interface FoldMark {
  pos: number;
  top: number;
  left: number;
  folded: boolean;
}

const FOLD_BTN_WIDTH = 16;
const FOLD_BTN_GAP = 6;

export function NotesFoldGutter(props: { editor: Editor | null; scrollHost: HTMLElement | null }) {
  const [marks, setMarks] = useState<FoldMark[]>([]);

  useEffect(() => {
    const editor = props.editor;
    const host = props.scrollHost;
    if (!editor || editor.isDestroyed || !host) {
      setMarks([]);
      return;
    }

    const refresh = () => {
      if (editor.isDestroyed) {
        return;
      }
      const hostRect = host.getBoundingClientRect();
      const next: FoldMark[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name !== "heading") {
          return;
        }
        if (!headingCanFold(editor, pos)) {
          return;
        }
        const dom = editor.view.nodeDOM(pos);
        if (!(dom instanceof HTMLElement)) {
          return;
        }
        const rect = dom.getBoundingClientRect();
        // 被上级折叠藏起的标题 rect 为 0，勿把按钮堆到顶部
        if (rect.height < 1 || rect.width < 1) {
          return;
        }
        if (dom.classList.contains("agnx-fold-hidden")) {
          return;
        }
        const top = rect.top - hostRect.top + (rect.height - 18) / 2;
        if (top < -24 || top > hostRect.height + 24) {
          return;
        }
        // 贴在标题左缘外侧，随 max-width 居中的正文栏一起移动
        const left = rect.left - hostRect.left - FOLD_BTN_WIDTH - FOLD_BTN_GAP;
        next.push({
          pos,
          top,
          left: Math.max(0, left),
          folded: isHeadingFolded(editor, pos),
        });
      });
      setMarks(next);
    };

    const onTx = () => requestAnimationFrame(refresh);
    refresh();
    editor.on("transaction", onTx);
    editor.on("selectionUpdate", onTx);
    host.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(refresh) : null;
    ro?.observe(host);
    const prose = host.querySelector(".ProseMirror");
    if (prose instanceof Element) {
      ro?.observe(prose);
    }

    return () => {
      editor.off("transaction", onTx);
      editor.off("selectionUpdate", onTx);
      host.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      ro?.disconnect();
    };
  }, [props.editor, props.scrollHost]);

  if (!props.scrollHost) {
    return null;
  }

  return createElement(
    "div",
    {
      className: "agnx-notes-fold-rail",
      "data-testid": "notes-fold-gutter",
    },
    marks.map((mark) =>
      createElement(
        "button",
        {
          key: String(mark.pos),
          type: "button",
          className: `agnx-notes-fold-btn${mark.folded ? " folded" : ""}`,
          style: {
            top: `${Math.round(mark.top)}px`,
            left: `${Math.round(mark.left)}px`,
          },
          title: mark.folded ? "展开" : "折叠",
          onMouseDown: (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (props.editor && !props.editor.isDestroyed) {
              toggleHeadingFold(props.editor, mark.pos);
            }
          },
        },
        mark.folded ? "▸" : "▾",
      ),
    ),
  );
}
