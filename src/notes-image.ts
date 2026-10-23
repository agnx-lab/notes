// 场景：TipTap Image — 点击选中四角缩放；width 写入 attrs + HTML 持久化，重启不丢（align）。
import { Image } from "@tiptap/extension-image";
import type { NodeViewRendererProps } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  escapeMarkdownImageAlt,
  escapeMarkdownImageSrc,
  escapeNotesImageHtmlAttr,
  resolveImageManagedUri,
} from "./note-image-model";
import { parseNotesMediaAlign } from "./notes-media-align";

/** 未指定 width 时的展示上限（仍不超过编辑器）。 */
export const NOTES_IMAGE_DEFAULT_MAX_WIDTH_PX = 480;
export const NOTES_IMAGE_MIN_WIDTH_PX = 96;

type ResizeCorner = "nw" | "ne" | "sw" | "se";

function parseWidthAttr(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return null;
}

export function resolveNotesImageDisplayWidth(input: {
  naturalWidth?: number | null;
  editorWidth?: number | null;
}): number {
  const editorWidth =
    typeof input.editorWidth === "number" && input.editorWidth > 0 ? input.editorWidth : 640;
  const editorCap = Math.max(
    NOTES_IMAGE_MIN_WIDTH_PX,
    Math.floor(Math.min(NOTES_IMAGE_DEFAULT_MAX_WIDTH_PX, editorWidth * 0.72)),
  );
  const natural =
    typeof input.naturalWidth === "number" && input.naturalWidth > 0
      ? Math.round(input.naturalWidth)
      : editorCap;
  return Math.max(NOTES_IMAGE_MIN_WIDTH_PX, Math.min(editorCap, natural));
}

function clampImageWidth(width: number, editorWidth: number): number {
  const max = Math.max(NOTES_IMAGE_MIN_WIDTH_PX, Math.floor(editorWidth));
  return Math.round(Math.min(max, Math.max(NOTES_IMAGE_MIN_WIDTH_PX, width)));
}

function createResizableImageNodeView(props: NodeViewRendererProps) {
  const { node, editor, getPos } = props;
  // block 图片用 div，避免 span + 块级 NodeView 导致选中框宽度错位
  const dom = document.createElement("div");
  dom.className = "agnx-notes-image-wrap";
  dom.setAttribute("data-drag-handle", "");

  const img = document.createElement("img");
  img.className = "agnx-notes-image";
  img.draggable = false;

  const frame = document.createElement("div");
  frame.className = "agnx-notes-image-frame";
  frame.contentEditable = "false";
  frame.setAttribute("aria-hidden", "true");

  const selectionMask = document.createElement("div");
  selectionMask.className = "agnx-notes-image-selection-mask";
  selectionMask.contentEditable = "false";
  selectionMask.setAttribute("aria-hidden", "true");

  const corners: ResizeCorner[] = ["nw", "ne", "sw", "se"];
  const handles = new Map<ResizeCorner, HTMLDivElement>();
  for (const corner of corners) {
    const handle = document.createElement("div");
    handle.className = `agnx-notes-image-resize agnx-notes-image-resize-${corner}`;
    handle.dataset.corner = corner;
    handle.contentEditable = "false";
    handle.setAttribute("aria-hidden", "true");
    frame.appendChild(handle);
    handles.set(corner, handle);
  }

  const syncWrapWidth = (widthPx: number | null) => {
    if (widthPx && widthPx > 0) {
      dom.style.width = `${widthPx}px`;
      dom.style.maxWidth = "100%";
      return;
    }
    dom.style.width = "";
    dom.style.maxWidth = "";
  };

  let latestAttrs = node.attrs;
  let widthSeeded = Boolean(parseWidthAttr(node.attrs.width));

  const syncSelectionHighlight = () => {
    if (editor.isDestroyed) {
      return;
    }
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") {
      dom.classList.remove("is-in-selection");
      return;
    }
    const current = editor.state.doc.nodeAt(pos);
    if (!current || current.type.name !== "image") {
      dom.classList.remove("is-in-selection");
      return;
    }
    const { selection } = editor.state;
    const nodeSize = current.nodeSize;
    const overlaps = selection.from < pos + nodeSize && selection.to > pos;
    const isNodeSel = selection instanceof NodeSelection && selection.from === pos;
    // Ctrl+A / 拖选包含图片：蒙层；单独 NodeSelection 也带蒙层，与文字高亮一致
    dom.classList.toggle("is-in-selection", overlaps);
    dom.classList.toggle("is-selected", isNodeSel);
  };

  const applyNode = (current: typeof node) => {
    latestAttrs = current.attrs;
    const src = String(current.attrs.src ?? "");
    const alt = String(current.attrs.alt ?? "");
    const title = String(current.attrs.title ?? "");
    const align = parseNotesMediaAlign(current.attrs.align);
    if (img.getAttribute("src") !== src) {
      img.src = src;
    }
    img.alt = alt;
    if (title) {
      img.title = title;
    } else {
      img.removeAttribute("title");
    }
    dom.dataset.align = align;
    const width = parseWidthAttr(current.attrs.width);
    if (width) {
      widthSeeded = true;
      img.style.width = `${width}px`;
      img.style.maxWidth = "100%";
      dom.dataset.hasWidth = "1";
      syncWrapWidth(width);
    } else {
      img.style.width = "";
      img.style.maxWidth = "";
      delete dom.dataset.hasWidth;
      syncWrapWidth(null);
    }
    img.style.height = "auto";
  };

  const commitWidth = (width: number) => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number" || editor.isDestroyed) {
      return;
    }
    const next = clampImageWidth(width, editor.view.dom.clientWidth || 640);
    editor
      .chain()
      .command(({ tr, state }) => {
        const current = state.doc.nodeAt(pos);
        if (!current || current.type.name !== "image") {
          return false;
        }
        if (parseWidthAttr(current.attrs.width) === next) {
          return true;
        }
        tr.setNodeMarkup(pos, undefined, {
          ...current.attrs,
          width: next,
        });
        return true;
      })
      .run();
  };

  const seedWidthFromNatural = () => {
    if (widthSeeded || !editor.isEditable || editor.isDestroyed) {
      return;
    }
    const natural = img.naturalWidth || 0;
    if (natural <= 0) {
      return;
    }
    widthSeeded = true;
    const next = resolveNotesImageDisplayWidth({
      naturalWidth: natural,
      editorWidth: editor.view.dom.clientWidth,
    });
    img.style.width = `${next}px`;
    img.style.maxWidth = "100%";
    dom.dataset.hasWidth = "1";
    syncWrapWidth(next);
    commitWidth(next);
  };

  applyNode(node);
  dom.appendChild(img);
  dom.appendChild(selectionMask);
  dom.appendChild(frame);

  if (img.complete && img.naturalWidth > 0) {
    seedWidthFromNatural();
  } else {
    img.addEventListener("load", seedWidthFromNatural, { once: true });
  }

  editor.on("selectionUpdate", syncSelectionHighlight);
  editor.on("transaction", syncSelectionHighlight);
  syncSelectionHighlight();

  let resizing = false;
  let activeCorner: ResizeCorner = "se";
  let startX = 0;
  let startWidth = 0;

  const onPointerMove = (event: PointerEvent) => {
    if (!resizing) {
      return;
    }
    const deltaX = event.clientX - startX;
    // 左边角：向左拖变大；右边角：向右拖变大
    const signed = activeCorner === "nw" || activeCorner === "sw" ? -deltaX : deltaX;
    const editorWidth = editor.view.dom.clientWidth || 640;
    const next = clampImageWidth(startWidth + signed, editorWidth);
    img.style.width = `${next}px`;
    img.style.maxWidth = "100%";
    dom.dataset.hasWidth = "1";
    syncWrapWidth(next);
  };

  const stopResize = (event: PointerEvent) => {
    if (!resizing) {
      return;
    }
    resizing = false;
    const active = handles.get(activeCorner);
    active?.releasePointerCapture?.(event.pointerId);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopResize);
    window.removeEventListener("pointercancel", stopResize);
    const width = Math.round(img.getBoundingClientRect().width);
    syncWrapWidth(width);
    commitWidth(width);
  };

  const startResize = (corner: ResizeCorner, event: PointerEvent) => {
    if (!editor.isEditable || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // 选中本节点，露出选中框
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos === "number") {
      editor.chain().setNodeSelection(pos).run();
    }
    resizing = true;
    activeCorner = corner;
    startX = event.clientX;
    startWidth = img.getBoundingClientRect().width || NOTES_IMAGE_DEFAULT_MAX_WIDTH_PX;
    handles.get(corner)?.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  };

  for (const [corner, handle] of handles) {
    handle.addEventListener("pointerdown", (event) => startResize(corner, event));
  }

  // 点击图片：NodeSelection，显示四角框；点别处由 PM 取消选中
  img.addEventListener("click", (event) => {
    if (!editor.isEditable) {
      return;
    }
    event.preventDefault();
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos === "number") {
      editor.chain().focus().setNodeSelection(pos).run();
    }
  });

  // 双击预览：仅 preventDefault，让事件冒泡到 image-view-container
  img.addEventListener("dblclick", (event) => {
    event.preventDefault();
  });

  return {
    dom,
    selectNode() {
      dom.classList.add("is-selected");
      dom.classList.add("is-in-selection");
    },
    deselectNode() {
      dom.classList.remove("is-selected");
      // 可能仍在 Ctrl+A 范围选中内，交给 sync 判断
      syncSelectionHighlight();
    },
    update(updated: typeof node) {
      if (updated.type.name !== "image") {
        return false;
      }
      applyNode(updated);
      syncSelectionHighlight();
      return true;
    },
    destroy() {
      editor.off("selectionUpdate", syncSelectionHighlight);
      editor.off("transaction", syncSelectionHighlight);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      void latestAttrs;
    },
    ignoreMutation: () => true,
  };
}

export const NotesImage = Image.extend({
  name: "image",
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const attr = element.getAttribute("width");
          if (attr) {
            return parseWidthAttr(attr);
          }
          const styleWidth = element.style?.width;
          if (styleWidth) {
            return parseWidthAttr(styleWidth);
          }
          return null;
        },
        renderHTML: (attributes) => {
          const width = parseWidthAttr(attributes.width);
          if (!width) {
            return {};
          }
          return {
            width: String(width),
            style: `width: ${width}px; max-width: 100%; height: auto;`,
          };
        },
      },
      align: {
        default: "left",
        parseHTML: (element) =>
          parseNotesMediaAlign(
            element.getAttribute("data-align") ||
              (element.closest?.("[data-align]") as HTMLElement | null)?.dataset.align,
          ),
        renderHTML: (attributes) => {
          const align = parseNotesMediaAlign(attributes.align);
          return align === "left" ? {} : { "data-align": align };
        },
      },
    };
  },
  addNodeView() {
    return (props) => createResizableImageNodeView(props);
  },
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (text: string) => void; closeBlock: (node: unknown) => void },
          node: {
            attrs: {
              src?: string;
              alt?: string;
              title?: string;
              width?: number | null;
              align?: string | null;
            };
          },
        ) {
          const managed =
            resolveImageManagedUri({
              src: node.attrs.src,
              title: node.attrs.title,
            }) || String(node.attrs.src ?? "");
          const alt = escapeMarkdownImageAlt(String(node.attrs.alt ?? ""));
          const src = escapeMarkdownImageSrc(managed);
          const title = escapeNotesImageHtmlAttr(String(node.attrs.title || managed));
          const width = parseWidthAttr(node.attrs.width);
          const align = parseNotesMediaAlign(node.attrs.align);
          const widthAttr = width ? ` width="${width}"` : "";
          const styleAttr = width
            ? ` style="width: ${width}px; max-width: 100%; height: auto;"`
            : "";
          const alignAttr = align === "left" ? "" : ` data-align="${align}"`;
          state.write(
            `<img class="agnx-notes-image" src="${escapeNotesImageHtmlAttr(src)}" alt="${escapeNotesImageHtmlAttr(alt)}" title="${title}"${widthAttr}${styleAttr}${alignAttr} />`,
          );
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
}).configure({
  inline: false,
  allowBase64: true,
  HTMLAttributes: { class: "agnx-notes-image" },
});
