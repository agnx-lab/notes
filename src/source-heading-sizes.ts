// 场景：源码面 ATX 标题行字号对齐富文本 h1/h2/h3。
import { Decoration, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const ATX = /^(#{1,6})[ \t]+\S/;

const headingLineDeco = [
  null,
  Decoration.line({ class: "agnx-notes-cm-h1" }),
  Decoration.line({ class: "agnx-notes-cm-h2" }),
  Decoration.line({ class: "agnx-notes-cm-h3" }),
  Decoration.line({ class: "agnx-notes-cm-h4" }),
  Decoration.line({ class: "agnx-notes-cm-h4" }),
  Decoration.line({ class: "agnx-notes-cm-h4" }),
];

function buildHeadingLineDecos(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();
  for (let n = 1; n <= view.state.doc.lines; n += 1) {
    const line = view.state.doc.line(n);
    const m = ATX.exec(line.text);
    if (!m) {
      continue;
    }
    const level = Math.min(6, m[1]!.length);
    const deco = headingLineDeco[level];
    if (deco) {
      builder.add(line.from, line.from, deco);
    }
  }
  return builder.finish();
}

/** 给 ATX 标题行加 class，CSS 字号与 TipTap h1/h2/h3 对齐。 */
export function notesSourceHeadingLineSizes() {
  return ViewPlugin.fromClass(
    class {
      decorations = Decoration.none;
      constructor(view: EditorView) {
        this.decorations = buildHeadingLineDecos(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildHeadingLineDecos(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
