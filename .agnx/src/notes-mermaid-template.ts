// 场景：Mermaid fence 默认模板（slash / NodeView 共用，避免 slash 拉整包 mermaid）。
export const NOTES_MERMAID_TEMPLATE = `flowchart TD
  A[开始] --> B[结束]`;

/** 粗检：内容是否像 Mermaid 图源（便于「识别为 Mermaid」）。 */
export function looksLikeMermaidSource(text: string): boolean {
  const source = text.trim();
  if (!source) {
    return false;
  }
  const first = source.split(/\r?\n/, 1)[0]?.trim() || "";
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|C4Context|quadrantChart|xychart|block-beta|sankey|architecture)\b/i.test(
    first,
  );
}
