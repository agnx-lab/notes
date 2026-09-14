// 场景：TipTap 标题折叠 — 由左侧 gutter 触发；隐藏直至下一同级/更高级标题。
import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const headingFoldPluginKey = new PluginKey<{ collapsed: Set<number> }>("agnxHeadingFold");

function sectionEnd(doc: ProseMirrorNode, pos: number, level: number): number {
  // TipTap 标题是顶层 block。forEach 只扫顶层；
  // descendants/nodesBetween 的 return false 都不会终止兄弟节点遍历。
  let passed = false;
  let end = doc.content.size;
  doc.forEach((node, offset) => {
    if (!passed) {
      if (offset === pos) {
        passed = true;
      }
      return;
    }
    if (end !== doc.content.size) {
      return;
    }
    if (node.type.name === "heading" && Number(node.attrs.level ?? 99) <= level) {
      end = offset;
    }
  });
  return end;
}

export function headingSectionRange(
  editor: Editor,
  pos: number,
): { from: number; to: number; level: number } | null {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "heading") {
    return null;
  }
  const level = Number(node.attrs.level ?? 1);
  const from = pos + node.nodeSize;
  const to = sectionEnd(editor.state.doc, pos, level);
  return { from, to, level };
}

export function headingCanFold(editor: Editor, pos: number): boolean {
  const range = headingSectionRange(editor, pos);
  return Boolean(range && range.to > range.from);
}

export function isHeadingFolded(editor: Editor, pos: number): boolean {
  const state = headingFoldPluginKey.getState(editor.state);
  return Boolean(state?.collapsed.has(pos));
}

export function toggleHeadingFold(editor: Editor, pos: number): void {
  if (editor.isDestroyed) {
    return;
  }
  editor.view.dispatch(editor.state.tr.setMeta(headingFoldPluginKey, { type: "toggle", pos }));
}

/** 可折叠标题位置（有正文区间的 heading）。 */
export function listFoldableHeadingPositions(editor: Editor): number[] {
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading" && headingCanFold(editor, pos)) {
      positions.push(pos);
    }
  });
  return positions;
}

export function countFoldedHeadings(editor: Editor): number {
  const state = headingFoldPluginKey.getState(editor.state);
  return state?.collapsed.size ?? 0;
}

/** true = 全部折叠；false = 全部展开。 */
export function setAllHeadingFolds(editor: Editor, folded: boolean): void {
  if (editor.isDestroyed) {
    return;
  }
  const positions = folded ? listFoldableHeadingPositions(editor) : [];
  editor.view.dispatch(
    editor.state.tr.setMeta(headingFoldPluginKey, {
      type: "setAll",
      positions,
    }),
  );
}

/** 若存在可折叠标题且已全部折叠 → 下一步应展开；否则下一步折叠。 */
export function shouldExpandAllHeadings(editor: Editor): boolean {
  const foldable = listFoldableHeadingPositions(editor);
  if (foldable.length === 0) {
    return false;
  }
  const state = headingFoldPluginKey.getState(editor.state);
  if (!state || state.collapsed.size === 0) {
    return false;
  }
  return foldable.every((pos) => state.collapsed.has(pos));
}

export function createHeadingFoldExtension() {
  return Extension.create({
    name: "agnxHeadingFold",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: headingFoldPluginKey,
          state: {
            init: () => ({ collapsed: new Set<number>() }),
            apply(tr, value) {
              const meta = tr.getMeta(headingFoldPluginKey) as
                | { type: "toggle"; pos: number }
                | { type: "clear" }
                | { type: "setAll"; positions: number[] }
                | undefined;
              if (!meta) {
                if (!tr.docChanged) {
                  return value;
                }
                return { collapsed: new Set<number>() };
              }
              if (meta.type === "clear") {
                return { collapsed: new Set<number>() };
              }
              if (meta.type === "setAll") {
                return { collapsed: new Set(meta.positions) };
              }
              const next = new Set(value.collapsed);
              if (next.has(meta.pos)) {
                next.delete(meta.pos);
              } else {
                next.add(meta.pos);
              }
              return { collapsed: next };
            },
          },
          props: {
            decorations(state) {
              const pluginState = headingFoldPluginKey.getState(state);
              if (!pluginState || pluginState.collapsed.size === 0) {
                return null;
              }
              const decos: Decoration[] = [];
              for (const pos of pluginState.collapsed) {
                const node = state.doc.nodeAt(pos);
                if (!node || node.type.name !== "heading") {
                  continue;
                }
                const level = Number(node.attrs.level ?? 1);
                const from = pos + node.nodeSize;
                const to = sectionEnd(state.doc, pos, level);
                decos.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: "agnx-heading-folded",
                  }),
                );
                if (to > from) {
                  state.doc.nodesBetween(from, to, (block, blockPos) => {
                    if (block.isBlock) {
                      decos.push(
                        Decoration.node(blockPos, blockPos + block.nodeSize, {
                          class: "agnx-fold-hidden",
                        }),
                      );
                      return false;
                    }
                  });
                }
              }
              return DecorationSet.create(state.doc, decos);
            },
          },
        }),
      ];
    },
  });
}
