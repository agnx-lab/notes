// 场景：链接点击路径条 — 贴链接上方；随滚动重定位，滚出视口则关闭（不 sticky）。
import { createElement, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useUnistyles } from "react-native-unistyles";
import { NotesLinkEditView } from "./link-edit-view";
import type { NotesLinkViewProps } from "./link-view-types";
import { isNotesLinkHrefAllowed } from "./notes-link";
import { computeNotesChromeAboveStart, isNotesTargetInHostView } from "./notes-chrome-position";

const LINK_CHROME_WIDTH_ESTIMATE = 360;
const LINK_CHROME_HEIGHT_ESTIMATE = 44;

function applyNotesLinkThemeVars(
  el: HTMLElement,
  colors: {
    input: string;
    border: string;
    foreground: string;
    foregroundMuted: string;
    accent: string;
    statusDanger?: string;
  },
) {
  el.style.setProperty("--agnx-notes-chip-bg", colors.input);
  el.style.setProperty("--agnx-notes-chip-input", colors.input);
  el.style.setProperty("--agnx-notes-chip-border", colors.border);
  el.style.setProperty("--agnx-notes-chip-fg", colors.foreground);
  el.style.setProperty("--agnx-notes-chip-muted", colors.foregroundMuted);
  el.style.setProperty("--agnx-notes-link-accent", colors.accent);
  el.style.setProperty(
    "--agnx-notes-link-accent-hover",
    `color-mix(in srgb, ${colors.accent} 62%, #ffffff)`,
  );
  el.style.setProperty("--agnx-notes-danger", colors.statusDanger ?? "#f87171");
}

function findLinkAnchor(target: EventTarget | null, host: HTMLElement): HTMLAnchorElement | null {
  const el = target instanceof Element ? target : null;
  const anchor = el?.closest?.("a") as HTMLAnchorElement | null;
  if (!anchor || !host.contains(anchor)) {
    return null;
  }
  return anchor;
}

function positionAboveAnchor(
  host: HTMLElement,
  anchor: HTMLElement,
  floating: HTMLElement | null,
): { top: number; left: number } | null {
  const hostRect = host.getBoundingClientRect();
  const rect = anchor.getBoundingClientRect();
  if (!isNotesTargetInHostView(hostRect, rect)) {
    return null;
  }
  return computeNotesChromeAboveStart({
    host: hostRect,
    target: rect,
    chromeWidth: floating?.offsetWidth || LINK_CHROME_WIDTH_ESTIMATE,
    chromeHeight: floating?.offsetHeight || LINK_CHROME_HEIGHT_ESTIMATE,
    gap: 8,
  });
}

function openPropsFromAnchor(
  editor: Editor,
  anchor: HTMLAnchorElement,
  host: HTMLElement,
  floating: HTMLElement | null,
  closeLinkView: () => void,
): { props: NotesLinkViewProps; top: number; left: number } | null {
  const href = (anchor.getAttribute("href") || "").trim();
  if (!href || !isNotesLinkHrefAllowed(href)) {
    return null;
  }
  try {
    const domPos = editor.view.posAtDOM(anchor, 0);
    if (domPos < 0) {
      return null;
    }
    const node = editor.state.doc.nodeAt(domPos);
    if (!node) {
      return null;
    }
    const mark = node.marks.find((m) => m.type.name === "link");
    if (!mark) {
      return null;
    }
    const pos = positionAboveAnchor(host, anchor, floating);
    if (!pos) {
      return null;
    }
    return {
      top: pos.top,
      left: pos.left,
      props: {
        editor,
        from: domPos,
        to: domPos + node.nodeSize,
        url: mark.attrs.href || href,
        text: node.textContent || "",
        closeLinkView,
      },
    };
  } catch {
    return null;
  }
}

export function NotesLinkViewContainer(props: {
  editor: Editor | null;
  scrollHost: HTMLElement | null;
}) {
  const { theme } = useUnistyles();
  const editor = props.editor;
  const host = props.scrollHost;
  const [open, setOpen] = useState(false);
  const [linkProps, setLinkProps] = useState<NotesLinkViewProps | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(false);
  const anchorFromRef = useRef<number | null>(null);
  openRef.current = open;

  const close = () => {
    setOpen(false);
    setLinkProps(null);
    anchorFromRef.current = null;
  };

  useEffect(() => {
    if (!host) {
      return;
    }
    applyNotesLinkThemeVars(host, theme.colors);
  }, [host, theme.colors]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !host) {
      close();
      return;
    }

    const syncOpenPosition = () => {
      if (!openRef.current || anchorFromRef.current == null) {
        return;
      }
      try {
        const dom = editor.view.domAtPos(anchorFromRef.current).node;
        const el = dom instanceof HTMLElement ? dom : dom.parentElement;
        const anchor = el?.closest?.("a") as HTMLAnchorElement | null;
        if (!anchor || !host.contains(anchor)) {
          close();
          return;
        }
        const next = positionAboveAnchor(host, anchor, floatingRef.current);
        if (!next) {
          close();
          return;
        }
        setPos(next);
      } catch {
        close();
      }
    };

    const onHostClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = findLinkAnchor(event.target, host);
      if (!anchor) {
        return;
      }
      const opened = openPropsFromAnchor(editor, anchor, host, floatingRef.current, close);
      if (!opened) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      anchorFromRef.current = opened.props.from;
      setPos({ top: opened.top, left: opened.left });
      setLinkProps(opened.props);
      setOpen(true);
    };

    const onPointerDownCapture = (event: PointerEvent) => {
      if (!openRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (floatingRef.current?.contains(target)) {
        return;
      }
      if (findLinkAnchor(target, host)) {
        return;
      }
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openRef.current) {
        if (floatingRef.current?.contains(document.activeElement)) {
          return;
        }
        event.preventDefault();
        close();
      }
    };

    host.addEventListener("click", onHostClick);
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    window.addEventListener("keydown", onKeyDown);
    host.addEventListener("scroll", syncOpenPosition, { passive: true });
    editor.on("transaction", syncOpenPosition);
    return () => {
      host.removeEventListener("click", onHostClick);
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("scroll", syncOpenPosition);
      editor.off("transaction", syncOpenPosition);
    };
  }, [editor, host]);

  if (!open || !linkProps) {
    return null;
  }

  return createElement(
    "div",
    {
      ref: (node: HTMLDivElement | null) => {
        floatingRef.current = node;
        if (node) {
          applyNotesLinkThemeVars(node, theme.colors);
        }
      },
      className: "agnx-notes-link-view",
      "data-testid": "notes-link-view-container",
      style: {
        top: `${Math.round(pos.top)}px`,
        left: `${Math.round(pos.left)}px`,
      },
    },
    createElement(NotesLinkEditView, { viewProps: linkProps }),
  );
}
