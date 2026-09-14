// 场景：链接路径条 — 对齐图片托管路径：可编辑 URL + 可选开 Browser Tab + 取消链接。
import { createElement, useEffect, useState } from "react";
import type { NotesLinkViewProps } from "./link-view-types";
import { isNotesLinkHrefAllowed, openNotesLinkHref } from "./notes-link";

function decodeHrefForEdit(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

export function NotesLinkEditView(props: { viewProps: NotesLinkViewProps }) {
  const { editor, from, to, url, closeLinkView } = props.viewProps;
  const [localUrl, setLocalUrl] = useState(() => decodeHrefForEdit(url));

  useEffect(() => {
    setLocalUrl(decodeHrefForEdit(url));
  }, [url, from, to]);

  const removeLink = () => {
    if (!editor.isEditable) {
      return;
    }
    editor.view.dispatch(editor.state.tr.removeMark(from, to, editor.schema.marks.link));
    closeLinkView();
  };

  const apply = () => {
    if (!editor.isEditable) {
      closeLinkView();
      return;
    }
    const next = localUrl.trim();
    const current = decodeHrefForEdit(url).trim();
    if (next === current) {
      closeLinkView();
      return;
    }
    if (!next) {
      removeLink();
      return;
    }
    if (!isNotesLinkHrefAllowed(next)) {
      return;
    }
    const tr = editor.state.tr
      .removeMark(from, to, editor.schema.marks.link)
      .addMark(from, to, editor.schema.marks.link.create({ href: next }));
    editor.view.dispatch(tr);
    closeLinkView();
  };

  const openInBrowserTab = () => {
    const next = localUrl.trim() || decodeHrefForEdit(url).trim();
    if (!next || !isNotesLinkHrefAllowed(next)) {
      return;
    }
    // 若输入有改动，先写回再打开
    if (editor.isEditable && next !== decodeHrefForEdit(url).trim()) {
      const tr = editor.state.tr
        .removeMark(from, to, editor.schema.marks.link)
        .addMark(from, to, editor.schema.marks.link.create({ href: next }));
      editor.view.dispatch(tr);
    }
    openNotesLinkHref(next);
    closeLinkView();
  };

  const canOpenInBrowser = /^https?:\/\//i.test(localUrl.trim() || decodeHrefForEdit(url));

  return createElement(
    "div",
    {
      className: "agnx-notes-link-edit agnx-notes-image-edit",
      "data-testid": "notes-link-edit",
    },
    createElement("input", {
      className: "agnx-notes-link-edit-input",
      value: localUrl,
      autoFocus: true,
      readOnly: !editor.isEditable,
      placeholder: "https:// 或相对路径",
      title: "链接地址（Enter/失焦保存）",
      onChange: (e: { target: HTMLInputElement }) => setLocalUrl(e.target.value),
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          apply();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeLinkView();
        }
      },
      onBlur: (e: { relatedTarget: EventTarget | null; currentTarget: HTMLElement }) => {
        const related = e.relatedTarget;
        if (related instanceof Node && e.currentTarget.parentElement?.contains(related)) {
          return;
        }
        apply();
      },
    }),
    canOpenInBrowser
      ? createElement(
          "button",
          {
            type: "button",
            className: "agnx-notes-link-icon-btn",
            title: "在浏览器 Tab 打开",
            "aria-label": "在浏览器 Tab 打开",
            "data-testid": "notes-link-open-browser",
            onMouseDown: (event: { preventDefault: () => void }) => {
              event.preventDefault();
            },
            onClick: openInBrowserTab,
          },
          createElement(
            "svg",
            {
              width: 14,
              height: 14,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              "aria-hidden": true,
            },
            createElement("path", {
              d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
            }),
            createElement("polyline", { points: "15 3 21 3 21 9" }),
            createElement("line", { x1: 10, y1: 14, x2: 21, y2: 3 }),
          ),
        )
      : null,
    editor.isEditable
      ? createElement(
          "button",
          {
            type: "button",
            className: "agnx-notes-link-icon-btn danger",
            title: "取消链接",
            "aria-label": "取消链接",
            "data-testid": "notes-link-unlink",
            onMouseDown: (event: { preventDefault: () => void }) => {
              event.preventDefault();
            },
            onClick: removeLink,
          },
          createElement(
            "svg",
            {
              width: 14,
              height: 14,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              "aria-hidden": true,
            },
            createElement("path", { d: "M3 6h18" }),
            createElement("path", { d: "M8 6V4h8v2" }),
            createElement("path", { d: "M19 6l-1 14H6L5 6" }),
          ),
        )
      : null,
  );
}
