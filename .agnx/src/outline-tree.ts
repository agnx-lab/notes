// 场景：大纲标题按 markdown level 建树（纯函数，供侧栏与单测）。
import type { NoteOutlineHeading } from "./note-model";

export interface OutlineTreeNode {
  heading: NoteOutlineHeading;
  depth: number;
  children: OutlineTreeNode[];
}

/** 按 markdown heading level 建树（H3 挂在最近的更高层标题下）。 */
export function buildOutlineTree(headings: NoteOutlineHeading[]): OutlineTreeNode[] {
  const roots: OutlineTreeNode[] = [];
  const stack: OutlineTreeNode[] = [];
  for (const heading of headings) {
    const node: OutlineTreeNode = { heading, depth: 0, children: [] };
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      if (top.heading.level < heading.level) {
        break;
      }
      stack.pop();
    }
    if (stack.length === 0) {
      node.depth = 0;
      roots.push(node);
    } else {
      const parent = stack[stack.length - 1]!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    }
    stack.push(node);
  }
  return roots;
}
