// 场景：向 DOM 注入 Notes TipTap 样式 v57 — Mermaid 预览底色跟主题；单图主题浮层。
const STYLE_ID = "agnx-notes-tiptap-style-v57";

export function ensureNotesEditorStyles(): void {
  if (typeof document === "undefined") {
    return;
  }
  for (const id of [
    "agnx-notes-tiptap-style",
    "agnx-notes-tiptap-style-v2",
    "agnx-notes-tiptap-style-v3",
    "agnx-notes-tiptap-style-v4",
    "agnx-notes-tiptap-style-v5",
    "agnx-notes-tiptap-style-v6",
    "agnx-notes-tiptap-style-v7",
    "agnx-notes-tiptap-style-v8",
    "agnx-notes-tiptap-style-v9",
    "agnx-notes-tiptap-style-v10",
    "agnx-notes-tiptap-style-v11",
    "agnx-notes-tiptap-style-v12",
    "agnx-notes-tiptap-style-v13",
    "agnx-notes-tiptap-style-v14",
    "agnx-notes-tiptap-style-v15",
    "agnx-notes-tiptap-style-v16",
    "agnx-notes-tiptap-style-v17",
    "agnx-notes-tiptap-style-v18",
    "agnx-notes-tiptap-style-v19",
    "agnx-notes-tiptap-style-v20",
    "agnx-notes-tiptap-style-v21",
    "agnx-notes-tiptap-style-v22",
    "agnx-notes-tiptap-style-v23",
    "agnx-notes-tiptap-style-v24",
    "agnx-notes-tiptap-style-v25",
    "agnx-notes-tiptap-style-v26",
    "agnx-notes-tiptap-style-v27",
    "agnx-notes-tiptap-style-v28",
    "agnx-notes-tiptap-style-v50",
    "agnx-notes-tiptap-style-v51",
    "agnx-notes-tiptap-style-v52",
    "agnx-notes-tiptap-style-v53",
    "agnx-notes-tiptap-style-v54",
    "agnx-notes-tiptap-style-v55",
    "agnx-notes-tiptap-style-v56",
  ]) {
    document.getElementById(id)?.remove();
  }
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.agnx-notes-cm {
  display: flex !important;
  flex: 1 1 auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box;
  background: transparent !important;
}
.agnx-notes-cm .cm-editor {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  height: 100% !important;
  background: transparent !important;
}
.agnx-notes-cm .cm-scroller {
  font-family: inherit !important;
  font-size: 15px !important;
  line-height: 1.7 !important;
  min-width: 0 !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(160, 160, 160, 0.45) transparent;
}
.agnx-notes-cm .cm-scroller::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.agnx-notes-cm .cm-scroller::-webkit-scrollbar-track {
  background: transparent;
}
.agnx-notes-cm .cm-scroller::-webkit-scrollbar-thumb {
  background: rgba(140, 140, 140, 0.45);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.agnx-notes-cm .cm-scroller::-webkit-scrollbar-thumb:hover {
  background: rgba(180, 180, 180, 0.7);
  background-clip: content-box;
  border: 2px solid transparent;
}
/* 换行开启时禁止横向条 */
.agnx-notes-cm:not(.no-wrap) .cm-scroller {
  overflow-x: hidden !important;
}
.agnx-notes-cm .cm-content {
  min-width: 0 !important;
  font-size: 15px !important;
  line-height: 1.7 !important;
}
.agnx-notes-cm .cm-line.agnx-notes-cm-h1 {
  font-size: 1.85rem !important;
  font-weight: 700 !important;
  line-height: 1.25 !important;
  letter-spacing: -0.02em;
}
.agnx-notes-cm .cm-line.agnx-notes-cm-h2 {
  font-size: 1.4rem !important;
  font-weight: 650 !important;
  line-height: 1.3 !important;
}
.agnx-notes-cm .cm-line.agnx-notes-cm-h3 {
  font-size: 1.15rem !important;
  font-weight: 600 !important;
  line-height: 1.35 !important;
}
.agnx-notes-cm .cm-line.agnx-notes-cm-h4 {
  font-size: 15px !important;
  font-weight: 600 !important;
  line-height: 1.7 !important;
}
.agnx-notes-cm .cm-lineNumbers .cm-gutterElement {
  font-size: 15px !important;
  /* 高度由 CM 按行块写入，勿写死 line-height 以免和大标题行错位 */
  line-height: inherit !important;
}
.agnx-notes-cm .cm-foldGutter {
  width: 16px !important;
}
.agnx-notes-cm .agnx-notes-cm-fold-marker {
  color: rgba(180, 180, 180, 0.95) !important;
  font-size: 12px !important;
  line-height: 1.7 !important;
  cursor: pointer;
  display: inline-block;
  min-width: 12px;
  text-align: center;
}
/* 折叠占位必须彻底不占布局；block+height:0 会多出空行并把行号撑歪 */
.agnx-notes-cm .cm-foldPlaceholder,
.agnx-notes-cm .agnx-notes-cm-fold-ph {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  color: transparent !important;
  font-size: 0 !important;
  line-height: 0 !important;
}
.agnx-notes-cm.no-wrap .cm-content,
.agnx-notes-cm .cm-editor.agnx-notes-cm-nowrap .cm-content {
  white-space: pre !important;
}
.agnx-notes-source {
  display: flex !important;
  flex-direction: row;
  align-items: stretch;
  flex: 1 1 auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box;
  background: transparent !important;
  padding: 0 12px 0 0;
}
.agnx-notes-source-gutter {
  flex: 0 0 44px;
  height: 100% !important;
  max-height: 100%;
  margin: 0;
  padding: 8px 10px 48px 0;
  overflow: hidden !important;
  text-align: right;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(160, 160, 160, 0.55);
  user-select: none;
  white-space: pre;
  box-sizing: border-box;
  background: transparent !important;
  border-right: 1px solid rgba(127, 127, 127, 0.18);
}
.agnx-notes-source-input {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  width: 100% !important;
  height: 100% !important;
  max-height: 100%;
  margin: 0 !important;
  padding: 8px 8px 48px 14px !important;
  border: 0 !important;
  outline: none !important;
  resize: none !important;
  background: transparent !important;
  color: inherit !important;
  caret-color: #22c55e;
  font: inherit;
  font-size: 15px !important;
  line-height: 1.7 !important;
  overflow-x: hidden;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgba(160, 160, 160, 0.55) transparent;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
  -webkit-appearance: none;
  appearance: none;
  field-sizing: fixed;
}
.agnx-notes-source.no-wrap .agnx-notes-source-input {
  overflow-x: auto;
  white-space: pre;
  word-break: normal;
}
.agnx-notes-side-menu {
  position: absolute;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  z-index: 8;
  opacity: 1;
  transition: opacity 0.12s ease;
  pointer-events: auto;
}
.agnx-notes-side-menu.side-menu-hidden {
  opacity: 0;
  pointer-events: none;
}
.agnx-notes-drag-handle,
.agnx-notes-fold-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--agnx-notes-muted, var(--agnx-notes-chip-muted, rgba(200, 200, 200, 0.95)));
  cursor: grab;
}
.agnx-notes-fold-handle {
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
}
.agnx-notes-drag-handle:hover,
.agnx-notes-fold-handle:hover {
  background: var(--agnx-notes-fold-hover-bg, rgba(255, 255, 255, 0.14));
  color: var(--agnx-notes-fold-hover-fg, var(--agnx-notes-fg, #fff));
}
.agnx-notes-fold-handle.fold-handle-hidden {
  display: none;
}
.agnx-notes-tiptap {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgba(160, 160, 160, 0.55) transparent;
  /* 左侧：折叠轨 + drag handle */
  padding-left: 40px;
  box-sizing: border-box;
  background: var(--agnx-notes-panel-bg, transparent);
  color: var(--agnx-notes-fg, inherit);
}
.agnx-notes-fold-rail {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: auto;
  pointer-events: none;
  z-index: 6;
}
.agnx-notes-fold-btn {
  position: absolute;
  width: 16px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--agnx-notes-muted, rgba(120, 120, 120, 0.85));
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  cursor: pointer;
  pointer-events: auto;
  border-radius: 3px;
  z-index: 2;
}
.agnx-notes-fold-btn:hover {
  background: var(--agnx-notes-fold-hover-bg, rgba(255, 255, 255, 0.1));
  color: var(--agnx-notes-fold-hover-fg, var(--agnx-notes-fg, #fff));
}
.agnx-notes-tiptap::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.agnx-notes-tiptap::-webkit-scrollbar-track {
  background: transparent;
}
.agnx-notes-tiptap::-webkit-scrollbar-thumb {
  background: rgba(140, 140, 140, 0.45);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.agnx-notes-tiptap::-webkit-scrollbar-thumb:hover {
  background: rgba(180, 180, 180, 0.7);
  background-clip: content-box;
  border: 2px solid transparent;
}
.agnx-notes-tiptap .ProseMirror {
  outline: none;
  min-height: 220px;
  max-width: var(--agnx-notes-prose-max-width, 100%);
  margin-left: auto;
  margin-right: auto;
  padding: 4px 10px 64px 2px;
  font-size: var(--agnx-notes-font-size, 15px);
  line-height: var(--agnx-notes-line-height, 1.7);
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: normal;
  tab-size: 4;
  caret-color: #22c55e;
  color: var(--agnx-notes-fg, inherit);
}
.agnx-notes-tiptap .ProseMirror-gapcursor {
  display: none;
  pointer-events: none;
  position: absolute;
}
.agnx-notes-tiptap .ProseMirror-focused .ProseMirror-gapcursor {
  display: block;
}
.agnx-notes-tiptap .ProseMirror-gapcursor:after {
  content: "";
  display: block;
  position: absolute;
  top: -2px;
  width: 1.5px;
  height: 1.15em;
  background: #22c55e;
  border: none;
  animation: agnx-notes-caret-blink 1.1s steps(2, start) infinite;
}
@keyframes agnx-notes-caret-blink {
  to {
    visibility: hidden;
  }
}
.agnx-notes-tiptap.no-wrap {
  overflow-x: auto;
}
.agnx-notes-tiptap.no-wrap .ProseMirror {
  width: max-content;
  min-width: 100%;
  word-break: keep-all;
  overflow-wrap: normal;
  white-space: nowrap;
}
.agnx-notes-tiptap.no-wrap .ProseMirror pre,
.agnx-notes-tiptap.no-wrap .ProseMirror p,
.agnx-notes-tiptap.no-wrap .ProseMirror li,
.agnx-notes-tiptap.no-wrap .ProseMirror h1,
.agnx-notes-tiptap.no-wrap .ProseMirror h2,
.agnx-notes-tiptap.no-wrap .ProseMirror h3,
.agnx-notes-tiptap.no-wrap .ProseMirror blockquote {
  white-space: pre;
}
.agnx-notes-tiptap.no-wrap .ProseMirror table {
  white-space: normal;
}
.agnx-notes-tiptap .ProseMirror .agnx-fold-hidden {
  display: none !important;
}
.agnx-notes-tiptap .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  opacity: 0.45;
}
.agnx-notes-tiptap .ProseMirror h1 {
  font-size: 1.85rem;
  font-weight: 700;
  margin: 1em 0 0.4em;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: var(--agnx-notes-heading, inherit);
}
.agnx-notes-tiptap .ProseMirror h2 {
  font-size: 1.4rem;
  font-weight: 650;
  margin: 0.95em 0 0.35em;
  line-height: 1.3;
  padding-left: 0;
  border-left: none;
  color: var(--agnx-notes-heading, inherit);
}
.agnx-notes-tiptap .ProseMirror h3 {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0.85em 0 0.3em;
  line-height: 1.35;
  padding-left: 0;
  border-left: none;
  color: var(--agnx-notes-heading, inherit);
}
.agnx-notes-tiptap .ProseMirror p,
.agnx-notes-tiptap .ProseMirror ul,
.agnx-notes-tiptap .ProseMirror ol,
.agnx-notes-tiptap .ProseMirror pre,
.agnx-notes-tiptap .ProseMirror blockquote {
  margin: var(--agnx-notes-paragraph-gap, 0.75em) 0;
}
.agnx-notes-tiptap .ProseMirror ul,
.agnx-notes-tiptap .ProseMirror ol {
  padding-left: 1.35em;
}
.agnx-notes-tiptap .ProseMirror li {
  margin: 0.15em 0;
}
.agnx-notes-tiptap .ProseMirror li > p {
  margin: 0;
}
.agnx-notes-tiptap .ProseMirror li + li {
  margin-top: 0.2em;
}
.agnx-notes-tiptap .ProseMirror ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0.1em;
  margin: 0.5em 0;
}
.agnx-notes-tiptap .ProseMirror ul[data-type="taskList"] li {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0.45em;
  margin: 0.28em 0;
}
.agnx-notes-tiptap .ProseMirror ul[data-type="taskList"] li > label {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  margin-top: 0.28em;
  user-select: none;
}
.agnx-notes-tiptap .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
  margin: 0;
  width: 0.95em;
  height: 0.95em;
  cursor: pointer;
}
.agnx-notes-tiptap .ProseMirror ul[data-type="taskList"] li > div {
  flex: 1 1 auto;
  min-width: 0;
}
.agnx-notes-tiptap .ProseMirror ul[data-type="taskList"] li > div > p {
  margin: 0;
}
.agnx-notes-tiptap .ProseMirror blockquote {
  border-left: 3px solid var(--agnx-notes-quote-bar, rgba(127, 127, 127, 0.55));
  padding-left: 0.9em;
  margin-left: 0;
  opacity: 0.92;
}
.agnx-notes-tiptap .ProseMirror code:not(pre code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.88em;
  padding: 0.1em 0.42em;
  border-radius: 5px;
  background: var(--agnx-notes-inline-code-bg, rgba(154, 82, 28, 0.72));
  color: var(--agnx-notes-inline-code-fg, #fff4e8);
  border: 1px solid var(--agnx-notes-inline-code-border, rgba(251, 146, 60, 0.28));
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.agnx-notes-tiptap .ProseMirror pre {
  border-radius: 10px;
  padding: 0.85em 1em;
  overflow-x: auto;
  background: var(--agnx-notes-code-bg, #151820);
  border: 1px solid var(--agnx-notes-code-border, rgba(255, 255, 255, 0.08));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.86em;
  line-height: 1.55;
  white-space: pre;
  tab-size: 2;
}
.agnx-notes-tiptap .ProseMirror pre code {
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: inherit;
  color: var(--agnx-notes-code-fg, #e8eaef);
}
.agnx-notes-tiptap .ProseMirror pre .hljs-comment,
.agnx-notes-tiptap .ProseMirror pre .hljs-quote {
  color: var(--agnx-notes-hljs-comment, #8b93a7);
  font-style: italic;
}
.agnx-notes-tiptap .ProseMirror pre .hljs-keyword,
.agnx-notes-tiptap .ProseMirror pre .hljs-selector-tag,
.agnx-notes-tiptap .ProseMirror pre .hljs-meta .hljs-keyword {
  color: var(--agnx-notes-hljs-keyword, #c792ea);
}
.agnx-notes-tiptap .ProseMirror pre .hljs-string,
.agnx-notes-tiptap .ProseMirror pre .hljs-doctag,
.agnx-notes-tiptap .ProseMirror pre .hljs-regexp {
  color: var(--agnx-notes-hljs-string, #c3e88d);
}
.agnx-notes-tiptap .ProseMirror pre .hljs-number,
.agnx-notes-tiptap .ProseMirror pre .hljs-literal {
  color: var(--agnx-notes-hljs-number, #f78c6c);
}
.agnx-notes-tiptap .ProseMirror pre .hljs-title,
.agnx-notes-tiptap .ProseMirror pre .hljs-section,
.agnx-notes-tiptap .ProseMirror pre .hljs-title.class_,
.agnx-notes-tiptap .ProseMirror pre .hljs-title.function_ {
  color: var(--agnx-notes-hljs-title, #82aaff);
}
.agnx-notes-tiptap .ProseMirror pre .hljs-attr,
.agnx-notes-tiptap .ProseMirror pre .hljs-attribute,
.agnx-notes-tiptap .ProseMirror pre .hljs-property,
.agnx-notes-tiptap .ProseMirror pre .hljs-variable,
.agnx-notes-tiptap .ProseMirror pre .hljs-template-variable {
  color: var(--agnx-notes-hljs-attr, #ffcb6b);
}
.agnx-notes-tiptap .ProseMirror pre .hljs-type,
.agnx-notes-tiptap .ProseMirror pre .hljs-built_in,
.agnx-notes-tiptap .ProseMirror pre .hljs-builtin-name,
.agnx-notes-tiptap .ProseMirror pre .hljs-symbol {
  color: var(--agnx-notes-hljs-type, #89ddff);
}
.agnx-notes-tiptap .ProseMirror pre .hljs-meta,
.agnx-notes-tiptap .ProseMirror pre .hljs-params {
  color: var(--agnx-notes-hljs-meta, #f07178);
}
.agnx-notes-tiptap .ProseMirror pre .hljs-deletion {
  color: var(--agnx-notes-hljs-deletion, #ff9cac);
}
.agnx-notes-tiptap .ProseMirror pre .hljs-addition {
  color: var(--agnx-notes-hljs-addition, #c3e88d);
}
.agnx-notes-tiptap .ProseMirror pre .hljs-punctuation {
  color: var(--agnx-notes-hljs-punctuation, #89ddff);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-hr-wrap {
  margin: 0.85em 0;
  padding: 12px 8px;
  cursor: pointer;
  border-radius: 8px;
  box-sizing: border-box;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-hr-line {
  height: 1px;
  width: 100%;
  background: var(--agnx-notes-hr, rgba(127, 127, 127, 0.42));
  border-radius: 1px;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-hr-wrap.ProseMirror-selectednode {
  outline: 2px solid #6aa8ff;
  outline-offset: 0;
  background: color-mix(in srgb, #6aa8ff 12%, transparent);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-hr-wrap.ProseMirror-selectednode .agnx-notes-hr-line {
  background: #6aa8ff;
}
/* 旧 hr 回退（无 NodeView 时） */
.agnx-notes-tiptap .ProseMirror hr,
.agnx-notes-tiptap .ProseMirror hr.agnx-notes-hr {
  border: none;
  height: 1px;
  margin: 1.1em 0;
  padding: 0;
  background: rgba(127, 127, 127, 0.42);
}
.agnx-notes-tiptap .ProseMirror hr.ProseMirror-selectednode {
  outline: 2px solid #6aa8ff;
  outline-offset: 8px;
  background: #6aa8ff;
}
.agnx-notes-link-view,
.agnx-notes-image-view {
  position: absolute;
  z-index: 30;
  pointer-events: auto;
}
.agnx-notes-link-edit,
.agnx-notes-image-preview,
.agnx-notes-image-edit {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(440px, 85vw);
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--agnx-notes-chip-border, rgba(255, 255, 255, 0.22));
  background: var(--agnx-notes-chip-bg, rgba(28, 32, 40, 0.96));
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06);
  color: var(--agnx-notes-chip-fg, rgba(255, 255, 255, 0.92));
  font-size: 12px;
  line-height: 1.2;
  backdrop-filter: blur(12px);
}
.agnx-notes-image-edit {
  min-width: min(320px, 80vw);
}
.agnx-notes-image-edit .agnx-notes-link-edit-input {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
}
.agnx-notes-path-align-group {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
}
.agnx-notes-path-align-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--agnx-notes-chip-muted, rgba(255, 255, 255, 0.72));
  cursor: pointer;
}
.agnx-notes-path-align-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}
.agnx-notes-path-align-btn.is-active {
  background: rgba(255, 255, 255, 0.12);
}
.agnx-notes-path-align-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.agnx-notes-link-edit {
  border-radius: 12px;
  gap: 6px;
}
.agnx-notes-link-url {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--agnx-notes-chip-muted, rgba(255, 255, 255, 0.72));
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.agnx-notes-link-url:hover {
  color: var(--agnx-notes-link-accent, #c26a3a);
}
.agnx-notes-link-icon-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--agnx-notes-chip-muted, rgba(255, 255, 255, 0.72));
  cursor: pointer;
}
.agnx-notes-link-icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--agnx-notes-chip-fg, #fff);
}
.agnx-notes-link-icon-btn.danger:hover {
  color: var(--agnx-notes-danger, #f87171);
}
.agnx-notes-link-text-btn {
  flex: 0 0 auto;
  margin: 0;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--agnx-notes-chip-fg, rgba(255, 255, 255, 0.92));
  cursor: pointer;
  font-size: 12px;
}
.agnx-notes-link-text-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
.agnx-notes-link-text-btn.danger {
  color: var(--agnx-notes-danger, #f87171);
}
.agnx-notes-link-edit-input {
  flex: 1 1 auto;
  min-width: 160px;
  margin: 0;
  padding: 6px 8px;
  border: 1px solid var(--agnx-notes-chip-border, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  background: var(--agnx-notes-chip-input, rgba(0, 0, 0, 0.28));
  color: var(--agnx-notes-chip-fg, #fff);
  font-size: 12px;
  outline: none;
}
.agnx-notes-tiptap .ProseMirror a,
.agnx-notes-tiptap .ProseMirror a.agnx-notes-link {
  color: var(--agnx-notes-md-link, var(--agnx-notes-link-accent, #3b82f6));
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(
    in srgb,
    var(--agnx-notes-md-link, var(--agnx-notes-link-accent, #3b82f6)) 55%,
    transparent
  );
  cursor: pointer;
  font-weight: 500;
}
.agnx-notes-tiptap .ProseMirror a:hover,
.agnx-notes-tiptap .ProseMirror a.agnx-notes-link:hover {
  color: var(--agnx-notes-link-accent-hover, #60a5fa);
  text-decoration-thickness: 2px;
  text-decoration-color: currentColor;
}
.agnx-notes-tiptap .ProseMirror a:focus-visible,
.agnx-notes-tiptap .ProseMirror a.agnx-notes-link:focus-visible {
  outline: 2px solid var(--agnx-notes-link-accent, #3b82f6);
  outline-offset: 2px;
  border-radius: 2px;
}
.agnx-notes-tiptap .ProseMirror img,
.agnx-notes-tiptap .ProseMirror img.agnx-notes-image {
  max-width: min(480px, 72%);
  width: auto;
  height: auto;
  border-radius: 8px;
  display: block;
  margin: 0.75em 0;
  cursor: default;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-wrap {
  position: relative;
  display: block;
  width: fit-content;
  max-width: 100%;
  margin: 0.75em 0;
  line-height: 0;
  border-radius: 8px;
  box-sizing: border-box;
  /* 用自定义选中框，关掉 PM 默认 outline（块级时常拉满整行，像左侧一条） */
  outline: none !important;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-wrap.ProseMirror-selectednode {
  outline: none !important;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-wrap > img.agnx-notes-image {
  margin: 0;
  max-width: min(480px, 72%);
  cursor: pointer;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-wrap[data-has-width="1"] > img.agnx-notes-image {
  max-width: 100%;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-frame {
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-radius: 8px;
  box-sizing: border-box;
  pointer-events: none;
  z-index: 1;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-selection-mask {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: color-mix(in srgb, Highlight 42%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, Highlight 70%, transparent);
  opacity: 0;
  pointer-events: none;
  z-index: 1;
}
@supports not (background: color-mix(in srgb, red 50%, transparent)) {
  .agnx-notes-tiptap .ProseMirror .agnx-notes-image-selection-mask {
    background: rgba(47, 132, 255, 0.38);
    box-shadow: inset 0 0 0 1px rgba(47, 132, 255, 0.55);
  }
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-wrap.is-in-selection .agnx-notes-image-selection-mask {
  opacity: 1;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-wrap.is-selected .agnx-notes-image-frame {
  border-color: var(--agnx-notes-link-accent, #6aa8ff);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-resize {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.92);
  background: var(--agnx-notes-link-accent, #6aa8ff);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  opacity: 0;
  pointer-events: none;
  z-index: 2;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-wrap.is-selected .agnx-notes-image-resize {
  opacity: 1;
  pointer-events: auto;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-resize-nw {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-resize-ne {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-resize-sw {
  bottom: -5px;
  left: -5px;
  cursor: nesw-resize;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-resize-se {
  bottom: -5px;
  right: -5px;
  cursor: nwse-resize;
}
.agnx-notes-tiptap .ProseMirror[contenteditable="false"] .agnx-notes-image-resize {
  display: none !important;
}
.agnx-notes-image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: stretch;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(6px);
}
.agnx-notes-image-lightbox-stage {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: default;
}
.agnx-notes-image-lightbox-img {
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  user-select: none;
  image-rendering: auto;
  will-change: transform, width;
  touch-action: none;
}
.agnx-notes-mermaid-lightbox-stage {
  position: relative;
}
.agnx-notes-mermaid-lightbox-host {
  position: absolute;
  left: 50%;
  top: 50%;
  box-sizing: content-box;
  padding: 20px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  overflow: visible;
  user-select: none;
  touch-action: none;
  transform-origin: center center;
  will-change: transform;
}
.agnx-notes-mermaid-lightbox-host svg {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
}
.agnx-notes-image-lightbox-chrome {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: calc(100vw - 32px);
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.72);
  box-sizing: border-box;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}
.agnx-notes-image-lightbox-path {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0 4px;
  overflow-x: auto;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.4;
  user-select: text;
  cursor: text;
}
.agnx-notes-image-lightbox-sep {
  flex: 0 0 auto;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.22);
}
.agnx-notes-image-lightbox-tool {
  flex: 0 0 auto;
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.95);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.agnx-notes-image-lightbox-tool:hover {
  background: rgba(255, 255, 255, 0.12);
}
.agnx-notes-image-lightbox-tool.is-active {
  background: rgba(255, 255, 255, 0.18);
}
.agnx-notes-image-lightbox-zoom-label {
  min-width: 52px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.agnx-notes-image-lightbox-copy {
  font-size: 12px !important;
  min-width: 52px;
  background: rgba(255, 255, 255, 0.1);
}
.agnx-notes-image-lightbox-toolbar,
.agnx-notes-image-lightbox-pathbar,
.agnx-notes-image-lightbox-hint,
.agnx-notes-image-lightbox-toast {
  display: none !important;
}
.agnx-notes-image-lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 255, 255, 0.95);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.agnx-notes-image-lightbox-close:hover {
  background: rgba(0, 0, 0, 0.7);
}
.agnx-notes-image-preview .agnx-notes-link-icon-btn,
.agnx-notes-image-edit .agnx-notes-link-text-btn {
  width: auto;
  min-width: 22px;
  padding: 0 6px;
  font-size: 12px;
}
.agnx-notes-tiptap .tableWrapper {
  display: block;
  width: fit-content;
  max-width: 100%;
  overflow-x: auto;
  margin: 0.75em 0;
  padding-bottom: 4px;
}
.agnx-notes-tiptap .tableWrapper[data-align="left"],
.agnx-notes-tiptap .tableWrapper:has(> table[data-align="left"]),
.agnx-notes-tiptap .ProseMirror .agnx-notes-table[data-align="left"] {
  margin-left: 0;
  margin-right: auto;
}
.agnx-notes-tiptap .tableWrapper[data-align="center"],
.agnx-notes-tiptap .tableWrapper:has(> table[data-align="center"]),
.agnx-notes-tiptap .ProseMirror .agnx-notes-table[data-align="center"] {
  margin-left: auto;
  margin-right: auto;
}
.agnx-notes-tiptap .tableWrapper[data-align="right"],
.agnx-notes-tiptap .tableWrapper:has(> table[data-align="right"]),
.agnx-notes-tiptap .ProseMirror .agnx-notes-table[data-align="right"] {
  margin-left: auto;
  margin-right: 0;
}
.agnx-notes-table-view {
  position: absolute;
  z-index: 30;
  pointer-events: auto;
}
.agnx-notes-table-edit {
  min-width: 0;
  flex-wrap: wrap;
}
/* 单元格焦点/选区：仅蓝色描边，不加粗格线、不画左缘色条（选行/列靠插件边距点击） */
.agnx-notes-tiptap .ProseMirror td.agnx-notes-table-cell-focus,
.agnx-notes-tiptap .ProseMirror th.agnx-notes-table-cell-focus,
.agnx-notes-tiptap .ProseMirror .selectedCell {
  outline: 2px solid #6aa8ff;
  outline-offset: -2px;
  background: color-mix(in srgb, #6aa8ff 14%, transparent) !important;
  box-shadow: none !important;
  border-color: rgba(127, 127, 127, 0.38) !important;
}
.agnx-notes-tiptap .ProseMirror .selectedCell::after {
  content: none !important;
  display: none !important;
  border: none !important;
  background: transparent !important;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-wrap {
  margin: 0.75em 0;
  position: relative;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-bottom: 4px;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-body {
  display: flex;
  align-items: stretch;
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  background: var(--agnx-notes-code-bg, #151820);
  border: 1px solid var(--agnx-notes-code-border, rgba(255, 255, 255, 0.08));
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-gutter {
  flex: 0 0 auto;
  min-width: 2.4em;
  padding: 0.85em 0.55em 0.85em 0.75em;
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.86em;
  line-height: 1.55;
  white-space: pre;
  color: var(--agnx-notes-code-gutter, rgba(232, 234, 239, 0.38));
  user-select: none;
  -webkit-user-select: none;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.18);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-pre {
  flex: 1 1 auto;
  margin: 0;
  border: 0;
  border-radius: 0;
  min-width: 0;
  overflow-x: auto;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-wrap.is-word-wrap .agnx-notes-codeblock-body {
  overflow-x: hidden;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-wrap.is-word-wrap .agnx-notes-codeblock-pre,
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-wrap.is-word-wrap .agnx-notes-codeblock-pre code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  overflow-x: hidden;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-wrap.has-edge-chip:not(.is-collapsed) .agnx-notes-codeblock-pre {
  padding-bottom: 2.4em;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-wrap.is-collapsed .agnx-notes-codeblock-body {
  max-height: calc(0.86em * 1.55 * 5 + 1.7em);
  overflow: hidden;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3.2em;
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  /* 渐变只做视觉，不挡编辑；仅胶囊按钮可点 */
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--agnx-notes-code-bg, #151820) 0%, transparent) 0%,
    color-mix(in srgb, var(--agnx-notes-code-bg, #151820) 78%, transparent) 48%,
    var(--agnx-notes-code-bg, #151820) 100%
  );
  color: var(--agnx-notes-code-fg, rgba(232, 234, 239, 0.88));
  font-size: 12px;
  letter-spacing: 0.01em;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-wrap:not(.has-edge-chip) .agnx-notes-codeblock-fade,
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-fade[hidden] {
  display: none !important;
}
/* 已展开：轻量底栏，仅收起胶囊，避免大面积遮挡 */
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-wrap:not(.is-collapsed) .agnx-notes-codeblock-fade {
  height: auto;
  min-height: 0;
  padding-top: 4px;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--agnx-notes-code-bg, #151820) 0%, transparent) 0%,
    color-mix(in srgb, var(--agnx-notes-code-bg, #151820) 42%, transparent) 100%
  );
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-fade-label {
  pointer-events: auto;
  margin-bottom: 8px;
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid var(--agnx-notes-code-border, rgba(255, 255, 255, 0.14));
  background: color-mix(in srgb, var(--agnx-notes-fg, #000) 14%, var(--agnx-notes-code-bg, #151820));
  color: var(--agnx-notes-code-fg, rgba(232, 234, 239, 0.92));
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-fade-label:hover {
  background: color-mix(in srgb, var(--agnx-notes-fg, #000) 22%, var(--agnx-notes-code-bg, #151820));
  color: var(--agnx-notes-fg, #fff);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-codeblock-fade-label:empty {
  display: none !important;
}
.agnx-notes-codeblock-view {
  position: absolute;
  z-index: 30;
  pointer-events: auto;
}
.agnx-notes-codeblock-edit {
  flex-wrap: nowrap !important;
  align-items: center;
  gap: 2px;
  max-width: min(92vw, 420px);
  white-space: nowrap;
}
.agnx-notes-codeblock-sep {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--agnx-notes-chip-border, rgba(255, 255, 255, 0.18));
  flex: 0 0 auto;
}
.agnx-notes-codeblock-lang-label {
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.agnx-notes-codeblock-lang-select {
  appearance: none;
  -webkit-appearance: none;
  max-width: 9.5em;
  height: 28px;
  margin: 0;
  padding: 0 22px 0 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  background-color: transparent;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%9ca3af' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 7px center;
  background-size: 12px;
  color: var(--agnx-notes-chip-fg, rgba(255, 255, 255, 0.92));
  font-size: 12px;
  font-weight: 600;
  line-height: 28px;
  cursor: pointer;
}
.agnx-notes-codeblock-lang-select:hover,
.agnx-notes-codeblock-lang-select:focus {
  background-color: rgba(255, 255, 255, 0.1);
  outline: none;
}
.agnx-notes-codeblock-lang-select:disabled {
  opacity: 0.55;
  cursor: default;
}
.agnx-notes-codeblock-edit .agnx-notes-mermaid-chrome-btn {
  padding: 4px 8px;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid {
  margin: 0.75em 0;
  border: 1px solid rgba(127, 127, 127, 0.35);
  border-radius: 10px;
  overflow: hidden;
  /* 底色由 NodeView 按 Mermaid 主题写入；缺省先给暗半透明，避免闪白 */
  background: rgba(0, 0, 0, 0.18);
  position: relative;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid[data-mermaid-surface="light"] {
  background: #ffffff;
  border-color: rgba(0, 0, 0, 0.12);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid[data-mermaid-surface="dark"] {
  background: #0f172a;
  border-color: rgba(255, 255, 255, 0.18);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-status {
  position: absolute;
  left: 10px;
  top: 8px;
  z-index: 1;
  opacity: 0.7;
  font-size: 11px;
  pointer-events: none;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid[data-mermaid-surface="light"] .agnx-notes-mermaid-status {
  color: rgba(15, 23, 42, 0.7);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid[data-mermaid-surface="dark"] .agnx-notes-mermaid-status {
  color: rgba(248, 250, 252, 0.7);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-preview {
  padding: 12px;
  overflow-x: auto;
  text-align: center;
  cursor: default;
  user-select: text;
  -webkit-user-select: text;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-preview svg {
  max-width: 100%;
  height: auto;
  cursor: default;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-preview svg text,
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-preview svg tspan {
  cursor: text;
  user-select: text;
  -webkit-user-select: text;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-error {
  text-align: left;
  color: #f87171;
  white-space: pre-wrap;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.agnx-notes-mermaid-view {
  position: absolute;
  z-index: 32;
  pointer-events: auto;
}
.agnx-notes-mermaid-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 999px;
  border: 1px solid var(--agnx-notes-chip-border, rgba(255, 255, 255, 0.22));
  background: var(--agnx-notes-chip-bg, rgba(28, 32, 40, 0.96));
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
}
.agnx-notes-mermaid-chrome-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 28px;
  margin: 0;
  padding: 4px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--agnx-notes-chip-fg, rgba(255, 255, 255, 0.92));
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.agnx-notes-mermaid-chrome-label {
  line-height: 1;
}
.agnx-notes-mermaid-chrome-btn:hover,
.agnx-notes-mermaid-chrome-btn.is-active {
  background: rgba(255, 255, 255, 0.1);
}
.agnx-notes-mermaid-theme-menu {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  min-width: 148px;
  max-height: 240px;
  overflow: auto;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--agnx-notes-chip-border, rgba(255, 255, 255, 0.22));
  background: var(--agnx-notes-chip-bg, rgba(28, 32, 40, 0.96));
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
}
.agnx-notes-mermaid-theme-option {
  appearance: none;
  display: block;
  width: 100%;
  margin: 0;
  padding: 7px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--agnx-notes-chip-fg, rgba(255, 255, 255, 0.92));
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.agnx-notes-mermaid-theme-option:hover,
.agnx-notes-mermaid-theme-option.is-active {
  background: rgba(255, 255, 255, 0.1);
  color: var(--agnx-notes-link-accent, #7dd3fc);
}
.agnx-notes-mermaid-toast {
  margin-top: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid var(--agnx-notes-chip-border, rgba(255, 255, 255, 0.22));
  background: var(--agnx-notes-chip-bg, rgba(28, 32, 40, 0.96));
  color: var(--agnx-notes-chip-muted, rgba(255, 255, 255, 0.8));
  font-size: 11px;
  text-align: right;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-status[hidden] {
  display: none !important;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-toggle {
  appearance: none;
  border: 1px solid rgba(127, 127, 127, 0.45);
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  border-radius: 8px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-toggle:hover {
  background: rgba(255, 255, 255, 0.14);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-toggle.is-primary {
  border-color: color-mix(in srgb, var(--agnx-notes-link-accent, #7dd3fc) 55%, transparent);
  background: color-mix(in srgb, var(--agnx-notes-link-accent, #7dd3fc) 22%, transparent);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-source {
  margin: 0;
  padding: 12px;
  background: transparent;
  overflow-x: auto;
}
/* 预览态：源码仍留在 DOM（contentDOM），仅视觉折叠，避免 display:none 触发 NodeView 重建 */
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid[data-mode="preview"] .agnx-notes-mermaid-source {
  height: 0;
  max-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid[data-mode="source"] .agnx-notes-mermaid-preview {
  display: none;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-mermaid-source code {
  display: block;
  min-height: 4em;
  outline: none;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
}
.agnx-notes-tiptap .ProseMirror table,
.agnx-notes-tiptap .ProseMirror .agnx-notes-table {
  border-collapse: collapse;
  /* 按内容收缩，禁止撑满整行 */
  width: max-content;
  max-width: 100%;
  margin: 0;
  table-layout: auto;
  border: 1px solid rgba(127, 127, 127, 0.38);
}
.agnx-notes-tiptap .ProseMirror th,
.agnx-notes-tiptap .ProseMirror td {
  border: 1px solid rgba(127, 127, 127, 0.38);
  padding: 7px 12px;
  vertical-align: top;
  min-width: 2.5em;
  max-width: 28em;
  position: relative;
  box-sizing: border-box;
  white-space: normal;
  word-break: break-word;
}
.agnx-notes-tiptap .ProseMirror th[data-text-align="left"],
.agnx-notes-tiptap .ProseMirror td[data-text-align="left"] {
  text-align: left;
}
.agnx-notes-tiptap .ProseMirror th[data-text-align="center"],
.agnx-notes-tiptap .ProseMirror td[data-text-align="center"] {
  text-align: center;
}
.agnx-notes-tiptap .ProseMirror th[data-text-align="right"],
.agnx-notes-tiptap .ProseMirror td[data-text-align="right"] {
  text-align: right;
}
.agnx-notes-tiptap .ProseMirror th {
  font-weight: 600;
  background: var(--agnx-notes-table-header-bg, rgba(0, 0, 0, 0.22));
  text-align: left;
  white-space: nowrap;
}
.agnx-notes-tiptap .ProseMirror th > *,
.agnx-notes-tiptap .ProseMirror td > * {
  margin: 0;
}
.agnx-notes-tiptap .ProseMirror .column-resize-handle {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 5px;
  z-index: 6;
  background: rgba(96, 165, 250, 0.85);
  /* 事件由 columnResizing 按坐标处理；手柄仅作可视反馈 */
  pointer-events: none;
}
.agnx-notes-tiptap .ProseMirror.resize-cursor {
  cursor: col-resize;
}
.agnx-notes-tiptap .ProseMirror.resize-cursor td,
.agnx-notes-tiptap .ProseMirror.resize-cursor th {
  cursor: col-resize;
}

.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment {
  position: relative;
  margin: 0.5em 0;
  padding: 0;
  border: 1px solid var(--agnx-notes-table-border, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  overflow: hidden;
  background: color-mix(in srgb, var(--agnx-notes-muted, #888) 8%, var(--agnx-notes-panel-bg, transparent));
  max-width: min(420px, 100%);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment[data-align="left"],
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-wrap[data-align="left"] {
  margin-left: 0;
  margin-right: auto;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment[data-align="center"],
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-wrap[data-align="center"] {
  margin-left: auto;
  margin-right: auto;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment[data-align="right"],
.agnx-notes-tiptap .ProseMirror .agnx-notes-image-wrap[data-align="right"] {
  margin-left: auto;
  margin-right: 0;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment-body {
  position: relative;
  z-index: 0;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment-frame {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  border: 2px solid transparent;
  border-radius: 8px;
  box-sizing: border-box;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment.is-selected .agnx-notes-attachment-frame,
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment.ProseMirror-selectednode .agnx-notes-attachment-frame {
  border-color: rgba(96, 165, 250, 0.95);
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.35);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment-media {
  display: block;
  width: 100%;
  max-width: 100%;
  background: color-mix(in srgb, var(--agnx-notes-fg, #000) 8%, var(--agnx-notes-panel-bg, transparent));
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment-video {
  max-height: 360px;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment-caption {
  margin: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--agnx-notes-muted, rgba(255, 255, 255, 0.72));
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  min-height: 0;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment-card-playable {
  cursor: pointer;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment-card-playable:hover {
  background: color-mix(in srgb, var(--agnx-notes-fg, #000) 6%, transparent);
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--agnx-notes-fg, rgba(255, 255, 255, 0.92));
  word-break: break-all;
}
.agnx-notes-tiptap .ProseMirror .agnx-notes-attachment-meta {
  font-size: 11px;
  line-height: 1.2;
  color: var(--agnx-notes-muted, rgba(255, 255, 255, 0.55));
}
`;
  document.head.appendChild(style);
}
