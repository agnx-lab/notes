// 场景：选中图片/附件后显示路径条 — 改路径 + 单按钮循环左/中/右对齐。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- DOM chrome 内联 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { updateImageAlign, updateImageManagedPath } from "./insert-image";
import { updateAttachmentAlign, updateAttachmentManagedPath } from "./insert-attachment";
import { NotesImageLightbox } from "./image-lightbox";
import { resolveImageManagedUri } from "./note-image-model";
import {
  cycleNotesMediaAlign,
  NOTES_MEDIA_ALIGN_LABELS,
  parseNotesMediaAlign,
  type NotesMediaAlign,
} from "./notes-media-align";
import { computeNotesChromeAboveStart, isNotesTargetInHostView } from "./notes-chrome-position";

function applyNotesPathChromeThemeVars(
  el: HTMLElement,
  colors: {
    popover: string;
    border: string;
    foreground: string;
    foregroundMuted: string;
    accent: string;
    input: string;
  },
) {
  el.style.setProperty("--agnx-notes-chip-bg", colors.popover);
  el.style.setProperty("--agnx-notes-chip-input", colors.input);
  el.style.setProperty("--agnx-notes-chip-border", colors.border);
  el.style.setProperty("--agnx-notes-chip-fg", colors.foreground);
  el.style.setProperty("--agnx-notes-chip-muted", colors.foregroundMuted);
  el.style.setProperty("--agnx-notes-link-accent", colors.accent);
}

type MediaKind = "image" | "attachment";

interface PathChromeState {
  kind: MediaKind;
  pos: number;
  managedUri: string;
  alt: string;
  align: NotesMediaAlign;
}

const PATH_CHROME_WIDTH_ESTIMATE = 360;
const PATH_CHROME_HEIGHT_ESTIMATE = 44;

function pathFromImageNode(node: { attrs: Record<string, unknown> }): string {
  return (
    resolveImageManagedUri({
      src: String(node.attrs.src ?? ""),
      title: String(node.attrs.title ?? ""),
    }) ||
    String(node.attrs.title || node.attrs.src || "") ||
    ""
  );
}

function pathFromAttachmentNode(node: { attrs: Record<string, unknown> }): string {
  return String(node.attrs.href || node.attrs.title || node.attrs.src || "") || "";
}

function resolveImagePathFromDom(editor: Editor, img: HTMLImageElement): string {
  try {
    const domPos = editor.view.posAtDOM(img, 0);
    if (domPos < 0) {
      return img.getAttribute("title") || img.currentSrc || img.src || "";
    }
    let node = editor.state.doc.nodeAt(domPos);
    if (!node || node.type.name !== "image") {
      const $pos = editor.state.doc.resolve(domPos);
      if ($pos.nodeAfter?.type.name === "image") {
        node = $pos.nodeAfter;
      } else if ($pos.nodeBefore?.type.name === "image") {
        node = $pos.nodeBefore;
      } else {
        node = null;
      }
    }
    if (node?.type.name === "image") {
      return pathFromImageNode(node);
    }
  } catch {
    // fall through
  }
  return img.getAttribute("title") || img.currentSrc || img.src || "";
}

const ALIGN_ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
} as const;

export function NotesImageViewContainer(props: {
  editor: Editor | null;
  scrollHost: HTMLElement | null;
}) {
  const { theme } = useUnistyles();
  const editor = props.editor;
  const host = props.scrollHost;
  const [state, setState] = useState<PathChromeState | null>(null);
  const [draftPath, setDraftPath] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [lightbox, setLightbox] = useState<{ src: string; alt: string; path: string } | null>(null);
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const draftPathRef = useRef(draftPath);
  draftPathRef.current = draftPath;

  useEffect(() => {
    if (!host) {
      return;
    }
    applyNotesPathChromeThemeVars(host, theme.colors);
  }, [host, theme.colors]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !host) {
      setState(null);
      return;
    }

    const syncFromSelection = () => {
      const { selection } = editor.state;
      if (!(selection instanceof NodeSelection)) {
        setState(null);
        return;
      }
      const node = selection.node;
      const nodePos = selection.from;
      let kind: MediaKind | null = null;
      let managedUri = "";
      let alt = "";
      let align: NotesMediaAlign = "left";
      if (node.type.name === "image") {
        kind = "image";
        managedUri = pathFromImageNode(node);
        alt = String(node.attrs.alt ?? "");
        align = parseNotesMediaAlign(node.attrs.align);
      } else if (node.type.name === "notesAttachment") {
        kind = "attachment";
        managedUri = pathFromAttachmentNode(node);
        alt = String(node.attrs.fileName ?? "");
        align = parseNotesMediaAlign(node.attrs.align);
      }
      if (!kind) {
        setState(null);
        return;
      }

      const dom = editor.view.nodeDOM(nodePos);
      if (!(dom instanceof HTMLElement) || !host.contains(dom)) {
        setState(null);
        return;
      }
      const hostRect = host.getBoundingClientRect();
      const rect = dom.getBoundingClientRect();
      if (!isNotesTargetInHostView(hostRect, rect)) {
        setState(null);
        return;
      }
      const chromeWidth = floatingRef.current?.offsetWidth || PATH_CHROME_WIDTH_ESTIMATE;
      const chromeHeight = floatingRef.current?.offsetHeight || PATH_CHROME_HEIGHT_ESTIMATE;
      setPos(
        computeNotesChromeAboveStart({
          host: hostRect,
          target: rect,
          chromeWidth,
          chromeHeight,
          gap: 8,
        }),
      );
      setState((prev) => {
        if (
          prev &&
          prev.pos === nodePos &&
          prev.kind === kind &&
          prev.managedUri === managedUri &&
          prev.align === align
        ) {
          return prev;
        }
        return { kind, pos: nodePos, managedUri, alt, align };
      });
      setDraftPath((prev) => (prev === managedUri ? prev : managedUri));
    };

    syncFromSelection();
    editor.on("selectionUpdate", syncFromSelection);
    editor.on("transaction", syncFromSelection);
    host.addEventListener("scroll", syncFromSelection, { passive: true });

    const onDblClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const img = target?.closest?.(
        "img.agnx-notes-image, .ProseMirror img",
      ) as HTMLImageElement | null;
      if (!img || !host.contains(img)) {
        return;
      }
      const src = (img.currentSrc || img.src || "").trim();
      if (!src) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setLightbox({ src, alt: img.alt || "", path: resolveImagePathFromDom(editor, img) });
    };
    host.addEventListener("dblclick", onDblClick);

    return () => {
      editor.off("selectionUpdate", syncFromSelection);
      editor.off("transaction", syncFromSelection);
      host.removeEventListener("scroll", syncFromSelection);
      host.removeEventListener("dblclick", onDblClick);
    };
  }, [editor, host]);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  const applyPath = useCallback(() => {
    if (!editor || !state) {
      return;
    }
    const next = draftPathRef.current.trim();
    if (!next || next === state.managedUri) {
      setDraftPath(state.managedUri);
      return;
    }
    const run =
      state.kind === "image"
        ? updateImageManagedPath(editor, state.pos, next)
        : updateAttachmentManagedPath(editor, state.pos, next);
    void run.then((ok) => {
      if (ok) {
        setState((prev) => (prev ? { ...prev, managedUri: next } : prev));
      } else {
        setDraftPath(state.managedUri);
      }
      return undefined;
    });
  }, [editor, state]);

  const applyAlign = useCallback(
    (align: NotesMediaAlign) => {
      if (!editor || !state || !editor.isEditable) {
        return;
      }
      const ok =
        state.kind === "image"
          ? updateImageAlign(editor, state.pos, align)
          : updateAttachmentAlign(editor, state.pos, align);
      if (ok) {
        setState((prev) => (prev ? { ...prev, align } : prev));
      }
    },
    [editor, state],
  );

  const lightboxEl = lightbox
    ? createElement(NotesImageLightbox, {
        src: lightbox.src,
        alt: lightbox.alt,
        path: lightbox.path,
        onClose: closeLightbox,
      })
    : null;

  if (!state || !editor) {
    return lightboxEl;
  }

  const AlignIcon = ALIGN_ICONS[state.align];
  const alignLabel = NOTES_MEDIA_ALIGN_LABELS[state.align];
  const alignCycleButton = createElement(
    "button",
    {
      type: "button",
      className: "agnx-notes-path-align-btn is-active",
      title: `${alignLabel}（点击切换）`,
      "aria-label": `块对齐：${alignLabel}，点击切换下一态`,
      "data-testid": "notes-media-align-cycle",
      "data-align": state.align,
      disabled: !editor.isEditable,
      onMouseDown: (event: { preventDefault: () => void }) => {
        // 避免抢焦点导致路径 input blur 抢先保存
        event.preventDefault();
      },
      onClick: () => applyAlign(cycleNotesMediaAlign(state.align)),
    },
    createElement(AlignIcon, { size: 14, color: theme.colors.accent }),
  );

  return createElement(
    "div",
    { className: "agnx-notes-image-chrome", "data-testid": "notes-image-chrome" },
    createElement(
      "div",
      {
        ref: (node: HTMLDivElement | null) => {
          floatingRef.current = node;
          if (node) {
            applyNotesPathChromeThemeVars(node, theme.colors);
          }
        },
        className: "agnx-notes-image-view",
        "data-testid": "notes-media-path-chrome",
        style: {
          top: `${Math.round(pos.top)}px`,
          left: `${Math.round(pos.left)}px`,
        },
      },
      createElement(
        "div",
        { className: "agnx-notes-image-edit", "data-testid": "notes-media-path-edit" },
        createElement("input", {
          className: "agnx-notes-link-edit-input",
          value: draftPath,
          readOnly: !editor.isEditable,
          title: "托管路径（直接编辑，Enter/失焦保存）",
          onChange: (event: { target: { value: string } }) => setDraftPath(event.target.value),
          onKeyDown: (event: { key: string; preventDefault: () => void }) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyPath();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraftPath(state.managedUri);
            }
          },
          onBlur: () => applyPath(),
        }),
        createElement(
          "div",
          {
            className: "agnx-notes-path-align-group",
            "data-testid": "notes-media-align-group",
            role: "group",
            "aria-label": "块对齐",
          },
          alignCycleButton,
        ),
      ),
    ),
    lightboxEl,
  );
}
