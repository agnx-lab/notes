// 场景：Mermaid SVG 全屏预览 — 舞台居中、适配可放大填满、滚轮缩放/平移、Esc 关闭。
import { createElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MIN_USER_ZOOM = 0.25;
const MAX_USER_ZOOM = 16;
const ZOOM_STEP = 1.25;
/** 舞台内边距 + 底部工具条预留 */
const STAGE_PAD_X = 48;
const STAGE_PAD_Y = 96;

function clampUserZoom(zoom: number): number {
  return Math.min(MAX_USER_ZOOM, Math.max(MIN_USER_ZOOM, zoom));
}

/** 适配舞台：可大于 1，让小图也能铺满可视区（contain）。 */
function computeFitScale(
  naturalWidth: number,
  naturalHeight: number,
  stageWidth: number,
  stageHeight: number,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0 || stageWidth <= 0 || stageHeight <= 0) {
    return 1;
  }
  return Math.min(stageWidth / naturalWidth, stageHeight / naturalHeight);
}

function readSvgNaturalSize(svg: SVGSVGElement): { w: number; h: number } {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return { w: vb.width, h: vb.height };
  }
  const attrW = Number.parseFloat(svg.getAttribute("width") || "");
  const attrH = Number.parseFloat(svg.getAttribute("height") || "");
  if (Number.isFinite(attrW) && Number.isFinite(attrH) && attrW > 0 && attrH > 0) {
    return { w: attrW, h: attrH };
  }
  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) {
      return { w: box.width, h: box.height };
    }
  } catch {
    // SVG 未挂载时 getBBox 可能抛错
  }
  return { w: 800, h: 600 };
}

export function NotesMermaidLightbox(props: { svgMarkup: string; onClose: () => void }) {
  const { svgMarkup, onClose } = props;
  const [userZoom, setUserZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [fitScale, setFitScale] = useState(1);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const userZoomRef = useRef(userZoom);
  userZoomRef.current = userZoom;

  const refreshFit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || natural.w <= 0 || natural.h <= 0) {
      return;
    }
    // host 有 content-box padding 20px，适配时一并计入
    const hostPad = 40;
    setFitScale(
      computeFitScale(
        natural.w + hostPad,
        natural.h + hostPad,
        Math.max(1, stage.clientWidth - STAGE_PAD_X),
        Math.max(1, stage.clientHeight - STAGE_PAD_Y),
      ),
    );
  }, [natural.h, natural.w]);

  useEffect(() => {
    refreshFit();
  }, [refreshFit]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") {
      return;
    }
    const ro = new ResizeObserver(() => refreshFit());
    ro.observe(stage);
    return () => ro.disconnect();
  }, [refreshFit]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    host.innerHTML = svgMarkup;
    const svg = host.querySelector("svg");
    if (svg instanceof SVGSVGElement) {
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.display = "block";
      setNatural(readSvgNaturalSize(svg));
    }
  }, [svgMarkup]);

  const zoomBy = useCallback((factor: number) => {
    setUserZoom((prev) => clampUserZoom(prev * factor));
  }, []);

  const resetView = useCallback(() => {
    setUserZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

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
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, resetView, zoomBy]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey) {
        zoomBy(Math.exp(-event.deltaY * 0.01));
        return;
      }
      setOffset((off) => ({
        x: off.x - (event.deltaX || 0),
        y: off.y - (event.deltaY || 0),
      }));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
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
  // 相对「适配」的百分比：点「适配」恒为 100%
  const percent = Math.round(userZoom * 100);
  const ready = natural.w > 0 && natural.h > 0 && displayScale > 0;

  const overlay = createElement(
    "div",
    {
      className: "agnx-notes-image-lightbox",
      "data-testid": "notes-mermaid-lightbox",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Mermaid 全屏预览",
      onClick: (event: { target: EventTarget | null; currentTarget: EventTarget }) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      },
    },
    createElement(
      "div",
      {
        className: "agnx-notes-image-lightbox-stage agnx-notes-mermaid-lightbox-stage",
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
      createElement("div", {
        className: "agnx-notes-mermaid-lightbox-host",
        ref: (el: HTMLDivElement | null) => {
          hostRef.current = el;
        },
        style: ready
          ? {
              width: `${natural.w}px`,
              height: `${natural.h}px`,
              // 以舞台中心为锚点：先移到中心，再平移，再缩放
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${displayScale})`,
              cursor: userZoom > 1.01 ? "grab" : "zoom-in",
              opacity: 1,
            }
          : {
              opacity: 0,
              pointerEvents: "none",
            },
        onDoubleClick: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
          event.preventDefault();
          event.stopPropagation();
          if (userZoomRef.current > 1.05) {
            resetView();
          } else {
            setUserZoom((z) => clampUserZoom(z * 2));
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
      createElement(
        "span",
        { className: "agnx-notes-image-lightbox-path", title: "相对适配窗口的缩放" },
        `Mermaid · ${percent}%`,
      ),
      createElement("div", { className: "agnx-notes-image-lightbox-sep" }),
      createElement(
        "button",
        {
          type: "button",
          className: "agnx-notes-image-lightbox-tool",
          title: "缩小",
          "aria-label": "缩小",
          onClick: () => zoomBy(1 / ZOOM_STEP),
        },
        "−",
      ),
      createElement(
        "button",
        {
          type: "button",
          className: "agnx-notes-image-lightbox-tool",
          title: "放大",
          "aria-label": "放大",
          onClick: () => zoomBy(ZOOM_STEP),
        },
        "+",
      ),
      createElement(
        "button",
        {
          type: "button",
          className: "agnx-notes-image-lightbox-tool",
          title: "适配窗口（居中填满）",
          "aria-label": "适配窗口",
          onClick: resetView,
        },
        "适配",
      ),
      createElement(
        "button",
        {
          type: "button",
          className: "agnx-notes-image-lightbox-tool",
          title: "关闭（Esc）",
          "aria-label": "关闭",
          "data-testid": "notes-mermaid-lightbox-close",
          onClick: onClose,
        },
        "✕",
      ),
    ),
  );

  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(overlay, document.body);
}
