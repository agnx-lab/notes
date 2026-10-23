// 场景：Notes 打开 Tab 桥 — 打破 register-core ↔ agent-tools 循环依赖。
import type { WorkspaceAppRunContext } from "@agnx-lab/app-sdk";
import { NOTES_APP_ID, NOTES_PANEL_ID } from "./ids";
import type { DemoNote } from "./note-model";

interface OpenHost {
  openMiniAppTab: (input: {
    appId: string;
    panelId: string;
    entityId?: string;
    serverId?: string;
    workspaceId?: string;
    currentPathname?: string | null;
  }) => boolean;
}

let hostApi: OpenHost | null = null;

export function bindNotesOpenHost(host: OpenHost): void {
  hostApi = host;
}

export function openNoteTab(
  note: Pick<DemoNote, "id" | "title">,
  context?: WorkspaceAppRunContext,
): boolean {
  if (!hostApi) {
    throw new Error("Notes mini-app is not activated");
  }
  return hostApi.openMiniAppTab({
    appId: NOTES_APP_ID,
    panelId: NOTES_PANEL_ID,
    entityId: note.id,
    serverId: context?.serverId,
    workspaceId: context?.workspaceId,
    currentPathname: context?.currentPathname,
  });
}
