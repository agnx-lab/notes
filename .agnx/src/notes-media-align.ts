// 场景：笔记图片/附件块对齐 — left/center/right，写入节点 attrs 并驱动 DOM。
export type NotesMediaAlign = "left" | "center" | "right";

export const NOTES_MEDIA_ALIGN_IDS = ["left", "center", "right"] as const;

export const NOTES_MEDIA_ALIGN_LABELS: Record<NotesMediaAlign, string> = {
  left: "左对齐",
  center: "居中",
  right: "右对齐",
};

export function parseNotesMediaAlign(value: unknown): NotesMediaAlign {
  if (value === "center" || value === "right" || value === "left") {
    return value;
  }
  return "left";
}

/** 路径 chrome 单按钮：left → center → right → left。 */
export function cycleNotesMediaAlign(current: NotesMediaAlign): NotesMediaAlign {
  const index = NOTES_MEDIA_ALIGN_IDS.indexOf(current);
  const next = NOTES_MEDIA_ALIGN_IDS[(index + 1) % NOTES_MEDIA_ALIGN_IDS.length];
  return next ?? "left";
}
