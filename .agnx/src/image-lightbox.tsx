// 场景：笔记图片全屏预览 — 按原图像素缩放（非 transform 放大缩略图），滚轮/按钮/拖拽。
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MIN_USER_ZOOM = 0.25;
const MAX_USER_ZOOM = 16;
const ZOOM_STEP = 1.25;

function clampUserZoom(zoom: number): number {
  return Math.min(MAX_USER_ZOOM, Math.max(MIN_USER_ZOOM, zoom));
}

function computeFitScale(
  naturalWidth: number,
  naturalHeight: number,
  stageWidth: number,
  stageHeight: number,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0 || stageWidth <= 0 || stageHeight <= 0) {
    return 1;
  }
  // 初始「适配窗口」，可小于 1；不允许默认就放大超过原图像素
  return Math.min(1, stageWidth / naturalWidth, stageHeight / naturalHeight);
}

export function NotesImageLightbox(props: {
  src: string;
  alt?: string;
  /** 托管路径 / 稳定 URI，供展示与复制 */
  path?: string;
  onClose: () => void;
}) {
  const { onClose, src, alt, path = "" } = props;
  /** 相对「适配窗口」的用户缩放；1 = 刚好铺满舞台且不超过原图像素 */
  const [userZoom, setUserZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [fitScale, setFitScale] = useState(1);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const copyHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const userZoomRef = useRef(userZoom);
  userZoomRef.current = userZoom;

  const refreshFit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || natural.w <= 0 || natural.h <= 0) {
      return;
    }
    const next = computeFitScale(natural.w, natural.h, stage.clientWidth, stage.clientHeight);
    setFitScale(next);
  }, [natural.h, natural.w]);

  useEffect(() => {
    refreshFit();
  }, [refreshFit]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") {
      return;
    }
    const ro = new ResizeObserver(() => {
      refreshFit();
    });
    ro.observe(stage);
    return () => {
      ro.disconnect();
    };
  }, [refreshFit]);

  const zoomBy = useCallback((factor: number) => {
    setUserZoom((prev) => clampUserZoom(prev * factor));
  }, []);

  const resetView = useCallback(() => {
    setUserZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const copyPath = useCallback(async () => {
    const text = path.trim();
    if (!text) {
      setCopyHint("无路径可复制");
    } else {
      try {
        await navigator.clipboard?.writeText(text);
        setCopyHint("已复制路径");
      } catch {
        setCopyHint("复制失败");
      }
    }
    if (copyHintTimer.current) {
      clearTimeout(copyHintTimer.current);
    }
    copyHintTimer.current = setTimeout(() => {
      setCopyHint(null);
      copyHintTimer.current = null;
    }, 1800);
  }, [path]);

  /** 1:1 原图像素（相对适配比例放大） */
  const zoomToActualPixels = useCallback(() => {
    if (fitScale <= 0) {
      return;
    }
    setUserZoom(clampUserZoom(1 / fitScale));
    setOffset({ x: 0, y: 0 });
  }, [fitScale]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomBy(ZOOM_STEP);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomBy(1 / ZOOM_STEP);
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        resetView();
        return;
      }
      if (event.key === "1") {
        event.preventDefault();
        zoomToActualPixels();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (copyHintTimer.current) {
        clearTimeout(copyHintTimer.current);
      }
    };
  }, [onClose, resetView, zoomBy, zoomToActualPixels]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      // macOS Chrome/Safari：双指捏合 → wheel + ctrlKey；双指滑动 → 普通 wheel（应平移）
      if (event.ctrlKey) {
        const factor = Math.exp(-event.deltaY * 0.01);
        zoomBy(factor);
        return;
      }
      setOffset((off) => ({
        x: off.x - (event.deltaX || 0),
        y: off.y - (event.deltaY || 0),
      }));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
    };
  }, [zoomBy]);

  const onPointerDown = (event: {
    button: number;
    pointerId: number;
    clientX: number;
    clientY: number;
    preventDefault: () => void;
    currentTarget: HTMLElement;
  }) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const onPointerMove = (event: { pointerId: number; clientX: number; clientY: number }) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  };

  const onPointerUp = (event: { pointerId: number; currentTarget: HTMLElement }) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const displayScale = fitScale * userZoom;
  const displayW = natural.w > 0 ? Math.max(1, Math.round(natural.w * displayScale)) : undefined;
  const percent = Math.round(displayScale * 100);
  const isActual = natural.w > 0 && Math.abs(displayScale - 1) < 0.02;

  const overlay = createElement(
    "div",
    {
      className: "agnx-notes-image-lightbox",
      "data-testid": "notes-image-lightbox",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "图片预览",
      onClick: (event: { target: EventTarget | null; currentTarget: EventTarget }) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      },
    },
    createElement(
      "div",
      {
        className: "agnx-notes-image-lightbox-stage",
        ref: (el: HTMLDivElement | null) => {
          stageRef.current = el;
        },
        onClick: (event: {
          target: EventTarget | null;
          currentTarget: EventTarget;
          stopPropagation: () => void;
        }) => {
          event.stopPropagation();
          if (event.target === event.currentTarget) {
            onClose();
          }
        },
      },
      createElement("img", {
        className: "agnx-notes-image-lightbox-img",
        src,
        alt: alt || "预览",
        draggable: false,
        style: {
          width: displayW ? `${displayW}px` : "auto",
          height: "auto",
          maxWidth: "none",
          maxHeight: "none",
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          cursor: userZoom > 1.01 ? "grab" : "zoom-in",
        },
        onLoad: (event: { currentTarget: HTMLImageElement }) => {
          const img = event.currentTarget;
          const w = img.naturalWidth || 0;
          const h = img.naturalHeight || 0;
          if (w > 0 && h > 0) {
            setNatural({ w, h });
          }
        },
        onDoubleClick: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
          event.preventDefault();
          event.stopPropagation();
          if (userZoomRef.current > 1.05) {
            resetView();
          } else {
            zoomToActualPixels();
          }
        },
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
      }),
    ),
    createElement(
      "div",
      {
        className: "agnx-notes-image-lightbox-chrome",
        onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
      },
      path
        ? createElement(
            "code",
            {
              className: "agnx-notes-image-lightbox-path",
              title: path,
            },
            path,
          )
        : null,
      path
        ? createElement(
            "button",
            {
              type: "button",
              className: "agnx-notes-image-lightbox-tool agnx-notes-image-lightbox-copy",
              title: "复制完整路径",
              onClick: () => {
                void copyPath();
              },
            },
            copyHint === "已复制路径" ? "已复制" : "复制",
          )
        : null,
      createElement("span", { className: "agnx-notes-image-lightbox-sep", "aria-hidden": true }),
      createElement(
        "button",
        {
          type: "button",
          className: "agnx-notes-image-lightbox-tool",
          title: "缩小 (-)",
          onClick: () => zoomBy(1 / ZOOM_STEP),
        },
        "−",
      ),
      createElement(
        "button",
        {
          type: "button",
          className: "agnx-notes-image-lightbox-tool agnx-notes-image-lightbox-zoom-label",
          title: "适配窗口 (0)",
          onClick: resetView,
        },
        `${percent}%`,
      ),
      createElement(
        "button",
        {
          type: "button",
          className: "agnx-notes-image-lightbox-tool",
          title: "放大 (+)",
          onClick: () => zoomBy(ZOOM_STEP),
        },
        "+",
      ),
      createElement(
        "button",
        {
          type: "button",
          className: `agnx-notes-image-lightbox-tool${isActual ? " is-active" : ""}`,
          title: "1:1 原图像素 (1)",
          onClick: zoomToActualPixels,
        },
        "1:1",
      ),
      createElement(
        "button",
        {
          type: "button",
          className: "agnx-notes-image-lightbox-tool",
          title: "关闭 (Esc)",
          "aria-label": "关闭预览",
          onClick: onClose,
        },
        "×",
      ),
    ),
  );

  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(overlay, document.body);
}
