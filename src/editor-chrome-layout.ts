// 场景：笔记顶栏左右 ActionBar — 宽屏并排（组内芯片可换行）；过窄（<480）上下叠放。

export type NotesEditorChromeLayoutMode = "row" | "stack";

/** 容器过窄时左右两组改为上下两行；各组内芯片优先换行。 */
export const NOTES_EDITOR_CHROME_STACK_BELOW = 480;

export function resolveNotesEditorChromeLayout(
  containerWidth: number,
): NotesEditorChromeLayoutMode {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return "row";
  }
  if (containerWidth < NOTES_EDITOR_CHROME_STACK_BELOW) {
    return "stack";
  }
  return "row";
}
