// 场景：Notes 浮动 chrome 相对滚动宿主定位 — 默认贴目标上方，不夹顶造成 sticky。
export function isNotesTargetInHostView(host: DOMRect, target: DOMRect, margin = 4): boolean {
  return target.bottom > host.top + margin && target.top < host.bottom - margin;
}

function clampLeft(left: number, hostWidth: number, chromeWidth: number): number {
  const maxLeft = Math.max(0, hostWidth - chromeWidth - 4);
  return Math.min(Math.max(0, left), maxLeft);
}

function clampRight(right: number, hostWidth: number, chromeWidth: number): number {
  // 保证 chrome 左缘不超出宿主：left = hostWidth - right - chromeWidth >= 4
  const maxRight = Math.max(0, hostWidth - chromeWidth - 4);
  return Math.min(Math.max(0, right), maxRight);
}

/** 贴在目标上方、左对齐（链接 / 图片路径条）。 */
export function computeNotesChromeAboveStart(input: {
  host: DOMRect;
  target: DOMRect;
  chromeHeight: number;
  chromeWidth: number;
  gap?: number;
}): { top: number; left: number } {
  const gap = input.gap ?? 8;
  return {
    top: input.target.top - input.host.top - input.chromeHeight - gap,
    left: clampLeft(input.target.left - input.host.left, input.host.width, input.chromeWidth),
  };
}

/**
 * 贴在目标上方、右对齐（表格 / Mermaid / 代码块工具条）。
 * 用 CSS `right` 锚定目标右缘，避免「估算 chromeWidth > 实际宽度」时 left 算偏、看起来不在右上角。
 */
export function computeNotesChromeAboveEnd(input: {
  host: DOMRect;
  target: DOMRect;
  chromeHeight: number;
  chromeWidth: number;
  gap?: number;
}): { top: number; right: number } {
  const gap = input.gap ?? 8;
  const idealRight = input.host.right - input.target.right;
  return {
    top: input.target.top - input.host.top - input.chromeHeight - gap,
    right: clampRight(idealRight, input.host.width, input.chromeWidth),
  };
}
