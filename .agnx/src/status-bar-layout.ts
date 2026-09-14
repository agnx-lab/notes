// 场景：笔记底栏按可用宽度在「单行左右 / 双行 / 操作区横滚」间切换。

export type NotesStatusBarLayoutMode = "row" | "stack" | "scroll";

/** 低于此宽度：meta 与操作分成两行；再窄则操作区横滚。 */
export const NOTES_STATUS_BAR_STACK_BELOW = 560;
/** 低于此宽度：操作芯片改为水平滚动，避免折成多行碎块。 */
export const NOTES_STATUS_BAR_SCROLL_BELOW = 380;

export function resolveNotesStatusBarLayout(width: number): NotesStatusBarLayoutMode {
  if (!Number.isFinite(width) || width <= 0) {
    return "row";
  }
  if (width < NOTES_STATUS_BAR_SCROLL_BELOW) {
    return "scroll";
  }
  if (width < NOTES_STATUS_BAR_STACK_BELOW) {
    return "stack";
  }
  return "row";
}
