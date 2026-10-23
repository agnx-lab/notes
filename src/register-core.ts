// 场景：Notes 无 UI 贡献注册 — bundled 同步 activate 与磁盘 loader 共用。
import { createElement } from "react";
import type { WorkspaceAppHostApi, WorkspaceAppRunContext } from "@agnx-lab/app-sdk";
import { FileDown, StickyNote, Trash2 } from "lucide-react-native";
import { registerNotesAgentTools } from "./agent-tools";
import { exportNoteMarkdown } from "./export-markdown";
import {
  NOTES_APP_ID,
  NOTES_NEW_COMMAND_ID,
  NOTES_SEGMENT_ID,
  registerNotesListContributions,
} from "./list-contributions";
import { seedNotesEditorChromeMenus } from "./editor-chrome-menu-surfaces";
import { bindNotesHostApi, getNotesHost } from "./notes-host";
import { bindNotesOpenHost, openNoteTab } from "./open-note";
import { NotesMermaidThemeDetailField } from "./notes-mermaid-theme-field";
import {
  bindNotesMermaidThemeConfig,
  getCachedNotesMermaidTheme,
  notesMermaidThemeLabel,
} from "./notes-mermaid-theme";
import { bindNotesMarkdownThemeConfig } from "./notes-prose-theme";
import { bindNotesHostStorage, useNotesDemoStore, type DemoNote } from "./store";

let hostApi: WorkspaceAppHostApi | null = null;
let unregisterAgentTools: (() => void) | null = null;
let unregisterMermaidTheme: (() => void) | null = null;
let unregisterMarkdownTheme: (() => void) | null = null;
let unregisterDetailSheetExtras: (() => void) | null = null;

function host(): WorkspaceAppHostApi {
  if (!hostApi) {
    throw new Error("Notes mini-app is not activated");
  }
  return hostApi;
}

export { getNotesHost };

export { openNoteTab };
export const openDemoNoteTab = openNoteTab;

export function createAndOpenNote(context?: WorkspaceAppRunContext): DemoNote {
  const note = useNotesDemoStore.getState().createNote();
  openNoteTab(note, context);
  return note;
}

export const createAndOpenDemoNote = createAndOpenNote;

function registerNotesCommandsAndShortcuts(nextHost: WorkspaceAppHostApi): void {
  // product 键进 Tab 详情「快捷键」Rebind；Settings 经 detailManaged 剔除。
  // 编辑器 chrome entity-menu 仍走 layoutManaged + 编辑布局。
  nextHost.registerShortcutGroup({
    id: "notes-product",
    appId: NOTES_APP_ID,
    groupKey: "notes",
    title: "Notes",
    kind: "product",
    detailManagedShortcutSourceKeys: [
      "sidebar-wechat-view-notes",
      "notes-new",
    ],
  });
  nextHost.registerCommand({
    id: NOTES_NEW_COMMAND_ID,
    appId: NOTES_APP_ID,
    title: "新笔记",
    keywords: ["note", "notes", "新建", "笔记", "memo", "新笔记"],
    shortcutHelpId: "notes-new",
    icon: StickyNote,
    sidebarAction: {
      defaultVisible: true,
      label: "新笔记",
      order: 30,
    },
    run: (context) => {
      createAndOpenNote(context);
    },
  });
  nextHost.registerItemMenu({
    id: "notes.delete",
    appId: NOTES_APP_ID,
    segmentId: NOTES_SEGMENT_ID,
    label: "删除",
    icon: Trash2,
    run: (item) => {
      useNotesDemoStore.getState().deleteNote(item.id);
    },
  });
  nextHost.registerItemMenu({
    id: "notes.export",
    appId: NOTES_APP_ID,
    segmentId: NOTES_SEGMENT_ID,
    label: "导出 Markdown",
    icon: FileDown,
    run: (item) => {
      const note = useNotesDemoStore.getState().getNote(item.id);
      if (!note) {
        return;
      }
      void exportNoteMarkdown(note);
    },
  });
  nextHost.registerShortcut({
    id: "view-notes",
    appId: NOTES_APP_ID,
    actionId: "workspace.app.view.notes",
    helpId: "sidebar-wechat-view-notes",
    label: "切换到笔记主视图",
    sectionId: "notes",
    sectionTitle: "Notes",
    macCombo: "Cmd+5",
    nonMacCombo: "Ctrl+5",
    helpKeys: ["mod", "5"],
    run: () => {
      host().requestPrimaryView(NOTES_SEGMENT_ID);
    },
  });
  nextHost.registerShortcut({
    id: "new-note",
    appId: NOTES_APP_ID,
    actionId: "notes.new",
    helpId: "notes-new",
    label: "新笔记",
    sectionId: "notes",
    sectionTitle: "Notes",
    macCombo: "Cmd+Shift+N",
    nonMacCombo: "Ctrl+Shift+N",
    helpKeys: ["mod", "shift", "N"],
    run: (context) => {
      createAndOpenNote(context);
    },
  });
}

function registerNotesDetailSheetExtras(nextHost: WorkspaceAppHostApi): void {
  unregisterDetailSheetExtras?.();
  const unregisterMeta = nextHost.ui.registerDetailSheetExtras({
    appId: NOTES_APP_ID,
    surface: "both",
    buildRows: (context) => {
      const noteId = context?.entityId?.trim() || "";
      const note = noteId ? useNotesDemoStore.getState().getNote(noteId) : null;
      if (!note) {
        return [];
      }
      return [
        {
          label: "更新时间",
          value: new Date(note.updatedAt).toLocaleString(),
        },
      ];
    },
  });
  const unregisterConfig = nextHost.ui.registerDetailSheetExtras({
    appId: NOTES_APP_ID,
    surface: "config",
    buildRows: () => {
      const themeId = getCachedNotesMermaidTheme();
      return [
        {
          label: "Mermaid 主题",
          value: notesMermaidThemeLabel(themeId),
          helpText:
            "本应用全部 Mermaid 图的默认主题；单图可在右上角「主题」覆盖。改后打开的预览会立即重渲。",
          valueContent: createElement(NotesMermaidThemeDetailField),
        },
        {
          label: "切换到笔记主视图",
          value: "",
          groupId: "notes-shortcuts",
          groupTitle: "快捷键",
          shortcutHelpId: "sidebar-wechat-view-notes",
        },
        {
          label: "新笔记",
          value: "",
          groupId: "notes-shortcuts",
          groupTitle: "快捷键",
          shortcutHelpId: "notes-new",
        },
      ];
    },
  });
  unregisterDetailSheetExtras = () => {
    unregisterMeta();
    unregisterConfig();
  };
}

/** 同步注册列表/命令/快捷键；编辑 Tab 由 activate 异步补全。 */
export function activateNotesCore(nextHost: WorkspaceAppHostApi): void {
  hostApi = nextHost;
  bindNotesHostApi(nextHost);
  bindNotesOpenHost(nextHost);
  bindNotesHostStorage(nextHost.storage, nextHost.sync);
  registerNotesListContributions(nextHost);
  registerNotesCommandsAndShortcuts(nextHost);
  registerNotesDetailSheetExtras(nextHost);
  seedNotesEditorChromeMenus(nextHost);
  unregisterMermaidTheme?.();
  unregisterMermaidTheme = bindNotesMermaidThemeConfig(nextHost);
  unregisterMarkdownTheme?.();
  unregisterMarkdownTheme = bindNotesMarkdownThemeConfig(nextHost);
  unregisterAgentTools?.();
  unregisterAgentTools = registerNotesAgentTools(nextHost);
}

export function resetNotesCoreRegistrationForTests(): void {
  hostApi = null;
  bindNotesHostApi(null);
  unregisterMermaidTheme?.();
  unregisterMermaidTheme = null;
  unregisterMarkdownTheme?.();
  unregisterMarkdownTheme = null;
  unregisterDetailSheetExtras?.();
  unregisterDetailSheetExtras = null;
  unregisterAgentTools?.();
  unregisterAgentTools = null;
}

export const resetNotesAppRegistrationForTests = resetNotesCoreRegistrationForTests;
export const resetDemoNotesMiniAppRegistrationForTests = resetNotesCoreRegistrationForTests;
