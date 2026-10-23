// 场景：agnx.notes 入口 — 宿主按 manifest.main / 包名 import 后调用 activate(host)。
import type { WorkspaceAppHostApi, WorkspaceAppModule } from "@agnx-lab/app-sdk";
import { registerNotesEditorPanel } from "./editor";
import { NOTES_APP_ID } from "./list-contributions";
import { activateNotesCore } from "./register-core";

export const appId = NOTES_APP_ID;

export function activate(host: WorkspaceAppHostApi): void {
  activateNotesCore(host);
  registerNotesEditorPanel(host);
}

const moduleExport: WorkspaceAppModule = {
  appId: NOTES_APP_ID,
  activate,
};

export default moduleExport;

export {
  DEMO_NOTES_MINI_APP_ID,
  DEMO_NOTES_NEW_COMMAND_ID,
  DEMO_NOTES_PANEL_ID,
  DEMO_NOTES_PROVIDER_ID,
  DEMO_NOTES_SEGMENT_ID,
  NOTES_APP_ID,
  NOTES_EXPORT_COMMAND_ID,
  NOTES_NEW_COMMAND_ID,
  NOTES_PANEL_ID,
  NOTES_PROVIDER_ID,
  NOTES_SEGMENT_ID,
  registerNotesListContributions,
  resetDemoNotesListContributionsForTests,
  resetNotesListContributionsForTests,
} from "./list-contributions";
export {
  activateNotesCore,
  createAndOpenDemoNote,
  createAndOpenNote,
  openDemoNoteTab,
  openNoteTab,
  resetDemoNotesMiniAppRegistrationForTests,
  resetNotesAppRegistrationForTests,
  resetNotesCoreRegistrationForTests,
} from "./register-core";
export { registerNotesEditorPanel } from "./editor";
export { registerNotesAgentTools } from "./agent-tools";
export {
  bindNotesHostStorage,
  listNotesAsWorkspaceItems,
  noteToListItem,
  refreshNotesListFromHostStorage,
  useNotesDemoStore,
  type DemoNote,
  type NoteVersion,
} from "./store";
export {
  countChars,
  countWords,
  extractOutline,
  extractTitleFromMarkdown,
  noteToMarkdownDocument,
} from "./note-model";
