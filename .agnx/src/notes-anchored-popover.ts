// 场景：笔记 chrome 浮层按触发按钮 DOM 矩形锚定（fixed，不挤布局）。
// 打开时锚定触发按钮；锚点缺失时 fallback，避免静默不渲染。
//
// 【硬约束】浮层/下拉必须 portal 到 body + fixed；禁止嵌进 chrome pill / 详情行 / ActionBar。
// 新下拉优先用 notes-floating-select；排版/主题滑条用本文件 hooks。
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { View } from "react-native";

export type NotesPopoverPlacement = "above" | "below";

/** 点外关闭时忽略这些容器内的点击（由按钮自己 toggle）。 */
export const NOTES_TYPOGRAPHY_OUTSIDE_IGNORE = "data-notes-typography-chrome";

const NOTES_POPOVER_Z_INDEX = 10050;

function escapeAttrValue(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function queryNotesTestIdElement(testId: string): Element | null {
  if (typeof document === "undefined") {
    return null;
  }
  const escaped = escapeAttrValue(testId);
  return (
    document.querySelector(`[data-testid="${escaped}"]`) ??
    document.querySelector(`[data-testID="${escaped}"]`) ??
    document.querySelector(`[testid="${escaped}"]`)
  );
}

export function computeNotesAnchoredStyle(input: {
  rect: DOMRect;
  placement: NotesPopoverPlacement;
  panelWidth: number;
  gap?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  /** center=相对触发器居中；start=左对齐触发器（窄下拉默认）。 */
  align?: "center" | "start";
}): CSSProperties {
  const gap = input.gap ?? 6;
  const viewportWidth =
    input.viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  const viewportHeight =
    input.viewportHeight ?? (typeof window !== "undefined" ? window.innerHeight : 800);
  const maxLeft = Math.max(8, viewportWidth - input.panelWidth - 8);
  const preferredLeft =
    input.align === "start"
      ? input.rect.left
      : input.rect.left + input.rect.width / 2 - input.panelWidth / 2;
  const left = Math.min(maxLeft, Math.max(8, preferredLeft));

  if (input.placement === "above") {
    return {
      position: "fixed",
      left,
      bottom: Math.max(8, viewportHeight - input.rect.top + gap),
      top: "auto",
      right: "auto",
      zIndex: NOTES_POPOVER_Z_INDEX,
    };
  }

  return {
    position: "fixed",
    left,
    top: input.rect.bottom + gap,
    bottom: "auto",
    right: "auto",
    zIndex: NOTES_POPOVER_Z_INDEX,
  };
}

/** 锚点找不到时仍给出可用位置，避免 `anchorStyle === null` 整层 return null。 */
export function computeNotesFallbackAnchoredStyle(input: {
  placement: NotesPopoverPlacement;
  panelWidth: number;
  viewportWidth?: number;
  viewportHeight?: number;
}): CSSProperties {
  const viewportWidth =
    input.viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  const viewportHeight =
    input.viewportHeight ?? (typeof window !== "undefined" ? window.innerHeight : 800);
  const left = Math.min(
    Math.max(8, viewportWidth - input.panelWidth - 8),
    Math.max(8, (viewportWidth - input.panelWidth) / 2),
  );

  if (input.placement === "above") {
    return {
      position: "fixed",
      left,
      bottom: Math.max(48, Math.min(120, Math.round(viewportHeight * 0.08))),
      top: "auto",
      right: "auto",
      zIndex: NOTES_POPOVER_Z_INDEX,
    };
  }

  return {
    position: "fixed",
    left,
    top: Math.max(48, Math.min(120, Math.round(viewportHeight * 0.08))),
    bottom: "auto",
    right: "auto",
    zIndex: NOTES_POPOVER_Z_INDEX,
  };
}

/** 打开时跟随 anchorTestIds 中第一个命中的按钮；滚动/resize 时重算；找不到则 fallback。 */
export function useNotesAnchoredPopoverStyle(input: {
  open: boolean;
  /** 优先用第一个存在的 testId（外露按钮 → 三点触发器等回退） */
  anchorTestIds: readonly string[];
  placement: NotesPopoverPlacement;
  panelWidth: number;
  align?: "center" | "start";
}): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const anchorKey = input.anchorTestIds.join("|");
  const align = input.align ?? "center";

  useLayoutEffect(() => {
    if (!input.open || input.anchorTestIds.length === 0) {
      setStyle(null);
      return;
    }

    const update = () => {
      let el: Element | null = null;
      for (const testId of input.anchorTestIds) {
        el = queryNotesTestIdElement(testId);
        if (el) {
          break;
        }
      }
      if (!el) {
        setStyle(
          computeNotesFallbackAnchoredStyle({
            placement: input.placement,
            panelWidth: input.panelWidth,
          }),
        );
        return;
      }
      setStyle(
        computeNotesAnchoredStyle({
          rect: el.getBoundingClientRect(),
          placement: input.placement,
          panelWidth: input.panelWidth,
          align,
        }),
      );
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [input.open, anchorKey, input.placement, input.panelWidth, input.anchorTestIds, align]);

  return style;
}

/**
 * 点外关闭：延迟一帧再启用，避免「打开当次」pointerdown 把刚挂上的浮层立刻关掉。
 * 面板自身与底栏 chrome 上的点击忽略。
 */
export function useNotesPopoverOutsideDismiss(input: {
  enabled: boolean;
  onClose: () => void;
  panelRef: RefObject<View | null>;
}) {
  const onCloseRef = useRef(input.onClose);
  onCloseRef.current = input.onClose;

  useEffect(() => {
    if (!input.enabled || typeof document === "undefined") {
      return;
    }

    let dismissArmed = false;
    const armTimer = window.setTimeout(() => {
      dismissArmed = true;
    }, 0);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!dismissArmed) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const node = input.panelRef.current as unknown as {
        contains?: (n: Node) => boolean;
      } | null;
      if (node?.contains?.(target)) {
        return;
      }
      if (target.closest(`[${NOTES_TYPOGRAPHY_OUTSIDE_IGNORE}]`)) {
        return;
      }
      if (target.closest('[data-testid="workspace-app-action-overflow-hover-side-panel"]')) {
        return;
      }
      onCloseRef.current();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.clearTimeout(armTimer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [input.enabled, input.panelRef]);
}
