// 场景：块外左侧 SideMenu — 仅标题折叠手柄（六点拖动手柄已移除）。
import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { headingCanFold, isHeadingFolded, toggleHeadingFold } from "./heading-fold";

const DRAG_HANDLE_WIDTH = 24;

const BLOCK_SELECTORS = [
  "p",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "pre",
  "li",
  "table",
  "hr",
  "img",
].join(", ");

type HostWithEditor = HTMLElement & { __notesEditor?: Editor };

function absoluteRect(node: Element) {
  const data = node.getBoundingClientRect();
  return { top: data.top, left: data.left, width: data.width };
}

export function nodeDOMAtCoords(coords: { x: number; y: number }): Element | null {
  const elements = document.elementsFromPoint(coords.x, coords.y);
  for (const elem of elements) {
    if (!(elem instanceof Element)) {
      continue;
    }
    if (elem.closest("#editor-side-menu, .agnx-notes-link-view, [data-testid=notes-block-menu]")) {
      continue;
    }
    if (elem.matches("table") && elem.closest(".ProseMirror")) {
      return elem;
    }
    if (elem.matches(BLOCK_SELECTORS) && elem.closest(".ProseMirror")) {
      return elem;
    }
  }
  return null;
}

function createFoldHandle(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "fold-handle";
  btn.className = "agnx-notes-fold-handle fold-handle-hidden";
  btn.title = "折叠";
  btn.textContent = "▾";
  return btn;
}

function posFromBlockDOM(view: EditorView, node: Element): number | null {
  try {
    const pos = view.posAtDOM(node, 0);
    if (pos < 0) {
      return null;
    }
    const $pos = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size));
    if ($pos.depth === 0) {
      return $pos.pos;
    }
    return $pos.before($pos.depth);
  } catch {
    return null;
  }
}

function getNotesEditor(view: EditorView): Editor | null {
  const host = (view.dom as HTMLElement).closest(".agnx-notes-tiptap") as HostWithEditor | null;
  const ed = host?.__notesEditor;
  return ed && !ed.isDestroyed ? ed : null;
}

function syncFoldHandle(view: EditorView, block: Element | null, foldHandle: HTMLButtonElement) {
  const ed = getNotesEditor(view);
  if (
    !ed ||
    !block ||
    (block.tagName !== "H1" && block.tagName !== "H2" && block.tagName !== "H3")
  ) {
    foldHandle.classList.add("fold-handle-hidden");
    return;
  }
  const pos = posFromBlockDOM(view, block);
  if (pos == null || !headingCanFold(ed, pos)) {
    foldHandle.classList.add("fold-handle-hidden");
    return;
  }
  foldHandle.classList.remove("fold-handle-hidden");
  const folded = isHeadingFolded(ed, pos);
  foldHandle.textContent = folded ? "▸" : "▾";
  foldHandle.title = folded ? "展开" : "折叠";
}

export function createNotesSideMenuExtension() {
  return Extension.create({
    name: "agnxNotesSideMenu",
    addProseMirrorPlugins() {
      const editorSideMenu = document.createElement("div");
      editorSideMenu.id = "editor-side-menu";
      editorSideMenu.className = "agnx-notes-side-menu side-menu-hidden";

      const foldHandle = createFoldHandle();
      editorSideMenu.appendChild(foldHandle);

      let currentBlock: Element | null = null;

      const hideSideMenu = () => {
        editorSideMenu.classList.add("side-menu-hidden");
      };
      const showSideMenu = () => {
        editorSideMenu.classList.remove("side-menu-hidden");
      };

      return [
        new Plugin({
          key: new PluginKey("agnxNotesSideMenu"),
          view: (view) => {
            hideSideMenu();
            view.dom.parentElement?.appendChild(editorSideMenu);

            const onFoldClick = (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              if (!currentBlock) {
                return;
              }
              const ed = getNotesEditor(view);
              const pos = posFromBlockDOM(view, currentBlock);
              if (!ed || pos == null || !headingCanFold(ed, pos)) {
                return;
              }
              toggleHeadingFold(ed, pos);
              syncFoldHandle(view, currentBlock, foldHandle);
            };

            foldHandle.addEventListener("mousedown", onFoldClick);

            return {
              update: () => {
                syncFoldHandle(view, currentBlock, foldHandle);
              },
              destroy: () => {
                foldHandle.removeEventListener("mousedown", onFoldClick);
                editorSideMenu.remove();
              },
            };
          },
          props: {
            handleDOMEvents: {
              mousemove: (view, event) => {
                if (!view.editable) {
                  return false;
                }
                const node =
                  nodeDOMAtCoords({ x: event.clientX, y: event.clientY }) ??
                  nodeDOMAtCoords({
                    x: event.clientX + 50 + DRAG_HANDLE_WIDTH,
                    y: event.clientY,
                  });
                if (!(node instanceof Element) || node.matches("ul, ol")) {
                  hideSideMenu();
                  currentBlock = null;
                  return false;
                }
                // 仅标题块需要折叠手柄；其它块不显示侧轨
                if (node.tagName !== "H1" && node.tagName !== "H2" && node.tagName !== "H3") {
                  hideSideMenu();
                  currentBlock = null;
                  return false;
                }
                currentBlock = node;
                const compStyle = window.getComputedStyle(node);
                const lineHeight = Number.parseInt(compStyle.lineHeight, 10) || 20;
                const paddingTop = Number.parseInt(compStyle.paddingTop, 10) || 0;
                const rect = absoluteRect(node);
                rect.top += (lineHeight - 20) / 2 + paddingTop;
                editorSideMenu.style.position = "absolute";
                const hostEl = view.dom.parentElement;
                if (hostEl) {
                  const hostRect = hostEl.getBoundingClientRect();
                  const top = rect.top - hostRect.top + (hostEl as HTMLElement).scrollTop;
                  // 跟正文栏左缘，不要钉死在编辑区最左
                  const left = rect.left - hostRect.left - DRAG_HANDLE_WIDTH - 2;
                  editorSideMenu.style.left = `${Math.max(0, left)}px`;
                  editorSideMenu.style.top = `${Math.max(0, top)}px`;
                } else {
                  editorSideMenu.style.left = `${Math.max(0, rect.left - DRAG_HANDLE_WIDTH - 4)}px`;
                  editorSideMenu.style.top = `${rect.top}px`;
                }
                showSideMenu();
                syncFoldHandle(view, node, foldHandle);
                return false;
              },
              mousewheel: () => {
                hideSideMenu();
                return false;
              },
            },
          },
        }),
      ];
    },
  });
}
