// 场景：TipTap 笔记附件节点 — 音视频点播才挂载；托管路径重新 resolve，避免空进度条。
import { mergeAttributes, Node } from "@tiptap/core";
import type { NodeViewRendererProps } from "@tiptap/core";
import { formatNotesAttachmentBytes, type NotesAttachmentKind } from "./note-attachment-model";
import {
  isEphemeralAttachmentSrc,
  peekNotesAttachmentPlaySrcCache,
  rememberNotesAttachmentPlaySrc,
  resolveNotesAttachmentPlaySrc,
  forgetNotesAttachmentPlaySrc,
} from "./notes-attachment-src";
import { parseNotesMediaAlign, type NotesMediaAlign } from "./notes-media-align";

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseByteSizeAttr(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseAttachmentAttrsFromElement(element: HTMLElement): Record<string, unknown> {
  const media = element.querySelector("audio, video") as HTMLMediaElement | null;
  let kind = element.dataset.kind || "file";
  if (!element.dataset.kind) {
    if (media?.tagName === "VIDEO") {
      kind = "video";
    } else if (media?.tagName === "AUDIO") {
      kind = "audio";
    }
  }
  const caption = element.querySelector("figcaption")?.textContent;
  return {
    kind,
    fileName: element.dataset.name || caption || "文件",
    mimeType: media?.getAttribute("type") || element.dataset.mime || "",
    byteSize: parseByteSizeAttr(element.dataset.byteSize),
    src: media?.getAttribute("src") || element.dataset.src || "",
    href: element.getAttribute("title") || element.getAttribute("data-href") || "",
    title: element.getAttribute("title") || "",
    align: parseNotesMediaAlign(element.dataset.align || element.getAttribute("data-align")),
  };
}

function buildPlaceholderCard(params: {
  kind: NotesAttachmentKind;
  fileName: string;
  mimeType: string;
  sizeLabel: string;
  canPlay: boolean;
  loading?: boolean;
}): HTMLElement {
  const card = document.createElement("div");
  card.className = "agnx-notes-attachment-card";
  if (params.canPlay) {
    card.classList.add("agnx-notes-attachment-card-playable");
  }
  const name = document.createElement("div");
  name.className = "agnx-notes-attachment-name";
  name.textContent = params.fileName;
  const meta = document.createElement("div");
  meta.className = "agnx-notes-attachment-meta";
  let kindLabel = params.mimeType || params.kind;
  if (params.kind === "video") {
    kindLabel = "视频";
  } else if (params.kind === "audio") {
    kindLabel = "音频";
  }
  let hint = "";
  if (params.loading) {
    hint = "加载中…";
  } else if (params.canPlay) {
    hint = "点击加载播放";
  }
  const metaParts = [kindLabel, params.sizeLabel, hint].filter(Boolean);
  meta.textContent = metaParts.join(" · ");
  card.append(name, meta);
  return card;
}

function mountMediaElement(params: {
  kind: "audio" | "video";
  src: string;
  mimeType: string;
  fileName: string;
  sizeLabel: string;
  body: HTMLElement;
}): HTMLMediaElement {
  const media = document.createElement(params.kind === "video" ? "video" : "audio");
  media.className =
    params.kind === "video"
      ? "agnx-notes-attachment-media agnx-notes-attachment-video"
      : "agnx-notes-attachment-media";
  media.controls = true;
  media.preload = "metadata";
  media.autoplay = false;
  if (params.kind === "video") {
    (media as HTMLVideoElement).playsInline = true;
  }
  if (params.mimeType) {
    media.setAttribute("type", params.mimeType);
  }
  media.src = params.src;
  media.load();
  const caption = document.createElement("figcaption");
  caption.className = "agnx-notes-attachment-caption";
  caption.textContent = params.sizeLabel
    ? `${params.fileName} · ${params.sizeLabel}`
    : params.fileName;
  params.body.replaceChildren(media, caption);
  return media;
}

function tryPlayMedia(media: HTMLMediaElement): void {
  const start = () => {
    void media.play().catch(() => undefined);
  };
  if (media.readyState >= HTMLMediaElement.HAVE_METADATA) {
    start();
    return;
  }
  const onReady = () => {
    media.removeEventListener("loadedmetadata", onReady);
    media.removeEventListener("canplay", onReady);
    start();
  };
  media.addEventListener("loadedmetadata", onReady);
  media.addEventListener("canplay", onReady);
  // 若元数据一直不来（失效 blob），允许用户再点卡片重试
  window.setTimeout(() => {
    if (media.readyState === HTMLMediaElement.HAVE_NOTHING && Number.isNaN(media.duration)) {
      media.dispatchEvent(new Event("notes-media-empty"));
    }
  }, 2500);
}

function createAttachmentNodeView(props: NodeViewRendererProps) {
  const { node, editor, getPos } = props;
  const dom = document.createElement("figure");
  dom.className = "agnx-notes-attachment";
  dom.setAttribute("data-notes-attachment", "1");
  dom.setAttribute("data-drag-handle", "");
  dom.contentEditable = "false";

  const body = document.createElement("div");
  body.className = "agnx-notes-attachment-body";

  const frame = document.createElement("div");
  frame.className = "agnx-notes-attachment-frame";
  frame.contentEditable = "false";
  frame.setAttribute("aria-hidden", "true");

  let mediaMounted = false;
  let loading = false;
  /** 当前挂载对应的托管路径（或直接可播 URI），用于避免 attrs blob 抖动拆掉 media */
  let mountedKey = "";
  let currentAttrs = node.attrs;
  let activateSeq = 0;

  const attachmentKey = (attrs: typeof node.attrs): string => {
    const managed = String(attrs.href ?? attrs.title ?? "").trim();
    if (managed && !isEphemeralAttachmentSrc(managed)) {
      return managed;
    }
    const src = String(attrs.src ?? "").trim();
    return src;
  };

  const showPlaceholder = (attrs: typeof node.attrs, isLoading: boolean) => {
    const kind = String(attrs.kind ?? "file") as NotesAttachmentKind;
    const fileName = String(attrs.fileName ?? "文件");
    const mimeType = String(attrs.mimeType ?? "");
    const sizeLabel = formatNotesAttachmentBytes(parseByteSizeAttr(attrs.byteSize));
    const canPlay = kind === "audio" || kind === "video";
    body.replaceChildren(
      buildPlaceholderCard({
        kind,
        fileName,
        mimeType,
        sizeLabel,
        canPlay,
        loading: isLoading,
      }),
    );
  };

  const apply = (current: typeof node) => {
    currentAttrs = current.attrs;
    const kind = String(current.attrs.kind ?? "file") as NotesAttachmentKind;
    const fileName = String(current.attrs.fileName ?? "文件");
    const src = String(current.attrs.src ?? "");
    const managed = String(current.attrs.href ?? current.attrs.title ?? "");
    const sizeLabel = formatNotesAttachmentBytes(parseByteSizeAttr(current.attrs.byteSize));
    const key = attachmentKey(current.attrs);
    const canPlay = kind === "audio" || kind === "video";
    const align = parseNotesMediaAlign(current.attrs.align) as NotesMediaAlign;

    dom.dataset.kind = kind;
    dom.dataset.name = fileName;
    dom.dataset.align = align;
    if (src && !isEphemeralAttachmentSrc(src)) {
      dom.dataset.src = src;
    } else {
      delete dom.dataset.src;
    }
    if (managed) {
      dom.title = managed;
    }

    // 已挂载/加载同一文件：不因 attrs.src 抖动拆掉
    if (canPlay && key && key === mountedKey && (mediaMounted || loading)) {
      if (mediaMounted) {
        const caption = body.querySelector("figcaption");
        if (caption) {
          caption.textContent = sizeLabel ? `${fileName} · ${sizeLabel}` : fileName;
        }
      }
      return;
    }

    mediaMounted = false;
    mountedKey = "";
    if (!loading) {
      showPlaceholder(current.attrs, false);
    }
  };

  const activateMedia = () => {
    const kind = String(currentAttrs.kind ?? "file");
    if ((kind !== "audio" && kind !== "video") || mediaMounted || loading) {
      return;
    }
    const managed = String(currentAttrs.href ?? currentAttrs.title ?? "").trim();
    const fallbackSrc = String(currentAttrs.src ?? "").trim();
    const key = attachmentKey(currentAttrs);
    if (!key) {
      return;
    }

    const fileName = String(currentAttrs.fileName ?? "文件");
    const mimeType = String(currentAttrs.mimeType ?? "");
    const sizeLabel = formatNotesAttachmentBytes(parseByteSizeAttr(currentAttrs.byteSize));
    const seq = ++activateSeq;
    loading = true;
    mountedKey = key;
    showPlaceholder(currentAttrs, true);

    const cached = managed ? peekNotesAttachmentPlaySrcCache(managed) : undefined;

    void (async () => {
      let playSrc = cached ?? "";
      if (!playSrc) {
        playSrc = await resolveNotesAttachmentPlaySrc({
          managedUri: managed,
          fallbackSrc,
        });
      }
      if (seq !== activateSeq || editor.isDestroyed) {
        return;
      }
      if (!playSrc) {
        loading = false;
        mountedKey = "";
        showPlaceholder(currentAttrs, false);
        return;
      }

      if (managed && !isEphemeralAttachmentSrc(managed)) {
        rememberNotesAttachmentPlaySrc(managed, playSrc);
      }

      loading = false;
      mediaMounted = true;
      mountedKey = key;
      const media = mountMediaElement({
        kind: kind as "audio" | "video",
        src: playSrc,
        mimeType,
        fileName,
        sizeLabel,
        body,
      });

      const onEmpty = () => {
        media.removeEventListener("notes-media-empty", onEmpty);
        if (managed && !isEphemeralAttachmentSrc(managed)) {
          forgetNotesAttachmentPlaySrc(managed);
        }
        mediaMounted = false;
        mountedKey = "";
        showPlaceholder(currentAttrs, false);
      };
      media.addEventListener("notes-media-empty", onEmpty);
      media.addEventListener(
        "error",
        () => {
          onEmpty();
        },
        { once: true },
      );

      tryPlayMedia(media);
    })();
  };

  apply(node);
  dom.append(body, frame);

  const syncSelection = () => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") {
      return;
    }
    const { selection } = editor.state;
    const selected =
      selection.from <= pos && selection.to >= pos + (editor.state.doc.nodeAt(pos)?.nodeSize ?? 0);
    dom.classList.toggle("is-selected", selected);
  };

  dom.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("audio, video, button, a")) {
      return;
    }
    const playable = target?.closest(".agnx-notes-attachment-card-playable");
    if (playable && editor.isEditable !== false) {
      event.preventDefault();
      event.stopPropagation();
      activateMedia();
      const pos = typeof getPos === "function" ? getPos() : null;
      if (typeof pos === "number") {
        editor.chain().setNodeSelection(pos).run();
        syncSelection();
      }
      return;
    }
    if (!editor.isEditable) {
      return;
    }
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos === "number") {
      editor.chain().setNodeSelection(pos).run();
      syncSelection();
    }
  });

  editor.on("selectionUpdate", syncSelection);
  editor.on("transaction", syncSelection);
  syncSelection();

  return {
    dom,
    update: (updated: typeof node) => {
      if (updated.type.name !== "notesAttachment") {
        return false;
      }
      apply(updated);
      syncSelection();
      return true;
    },
    selectNode: () => {
      dom.classList.add("is-selected");
    },
    deselectNode: () => {
      dom.classList.remove("is-selected");
    },
    destroy: () => {
      activateSeq += 1;
      editor.off("selectionUpdate", syncSelection);
      editor.off("transaction", syncSelection);
    },
    stopEvent: (event: Event) => {
      const target = event.target as HTMLElement | null;
      return Boolean(target?.closest("audio, video"));
    },
  };
}

export const NotesAttachment = Node.create({
  name: "notesAttachment",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      href: { default: null },
      title: { default: null },
      fileName: { default: "文件" },
      mimeType: { default: "" },
      byteSize: { default: null },
      kind: { default: "file" },
      align: {
        default: "left",
        parseHTML: (element: HTMLElement) =>
          parseNotesMediaAlign(element.dataset.align || element.getAttribute("data-align")),
        renderHTML: (attributes: { align?: unknown }) => {
          const align = parseNotesMediaAlign(attributes.align);
          return align === "left" ? {} : { "data-align": align };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-notes-attachment]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          return parseAttachmentAttrsFromElement(element);
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const kind = String(HTMLAttributes.kind ?? "file");
    const fileName = String(HTMLAttributes.fileName ?? "文件");
    const src = String(HTMLAttributes.src ?? "");
    const managed = String(HTMLAttributes.href || HTMLAttributes.title || "");
    const mimeType = String(HTMLAttributes.mimeType ?? "");
    const byteSize = HTMLAttributes.byteSize;
    const align = parseNotesMediaAlign(HTMLAttributes.align);
    const sizeLabel = formatNotesAttachmentBytes(
      typeof byteSize === "number" ? byteSize : Number(byteSize),
    );
    const figureAttrs = mergeAttributes({
      "data-notes-attachment": "1",
      "data-kind": kind,
      "data-name": fileName,
      "data-mime": mimeType || undefined,
      "data-src": src && !isEphemeralAttachmentSrc(src) ? src : undefined,
      "data-align": align === "left" ? undefined : align,
      "data-byte-size":
        typeof byteSize === "number" && Number.isFinite(byteSize) ? String(byteSize) : undefined,
      title: managed || undefined,
      class: "agnx-notes-attachment",
    });

    let kindLabel = mimeType || kind;
    if (kind === "video") {
      kindLabel = "视频";
    } else if (kind === "audio") {
      kindLabel = "音频";
    }
    const metaParts = [kindLabel, sizeLabel].filter(Boolean);
    return [
      "figure",
      figureAttrs,
      [
        "div",
        { class: "agnx-notes-attachment-card" },
        ["div", { class: "agnx-notes-attachment-name" }, escapeHtmlAttr(fileName)],
        ["div", { class: "agnx-notes-attachment-meta" }, escapeHtmlAttr(metaParts.join(" · "))],
      ],
    ];
  },

  addNodeView() {
    return (props) => createAttachmentNodeView(props);
  },
});
