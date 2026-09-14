// 场景：Notes 列表面贡献 — 经 activate(host) 注册。
import { StickyNote } from "lucide-react-native";
import type { WorkspaceAppHostApi } from "@getagnx/app-sdk";
import { NOTES_APP_ID, NOTES_NEW_COMMAND_ID, NOTES_PROVIDER_ID, NOTES_SEGMENT_ID } from "./ids";
import { listNotesAsWorkspaceItems, useNotesDemoStore } from "./store";

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
} from "./ids";

export function registerNotesListContributions(host: WorkspaceAppHostApi): void {
  // 可重复调用：卸载后再安装需重新 register；registry 按 key 覆盖。
  host.registerPrimarySegment({
    id: NOTES_SEGMENT_ID,
    appId: NOTES_APP_ID,
    label: "笔记",
    order: 50,
    icon: StickyNote,
    keywords: ["note", "notes", "笔记", "memo"],
    itemProviderId: NOTES_PROVIDER_ID,
    organizeBlockId: NOTES_SEGMENT_ID,
    emptyHint: "还没有笔记。点击此处或使用「新笔记」创建一个。",
    emptyActionCommandId: NOTES_NEW_COMMAND_ID,
  });
  host.registerItemProvider({
    id: NOTES_PROVIDER_ID,
    appId: NOTES_APP_ID,
    subscribe: (listener) => {
      listener(listNotesAsWorkspaceItems());
      return useNotesDemoStore.subscribe(() => {
        listener(listNotesAsWorkspaceItems());
      });
    },
    search: (query) => listNotesAsWorkspaceItems(query),
  });
  host.registerOrganize({
    id: NOTES_SEGMENT_ID,
    appId: NOTES_APP_ID,
    label: "笔记",
    sortOptions: [
      { id: "updatedAt", label: "最近更新" },
      { id: "title", label: "名称排序" },
    ],
    defaultSortOptionId: "updatedAt",
    organize: ({ query }) => [
      {
        key: "notes",
        title: "笔记",
        items: listNotesAsWorkspaceItems(query),
      },
    ],
  });
}

export function resetNotesListContributionsForTests(): void {
  // 列表贡献无模块级缓存；保留 reset 供测试对称调用。
}

/** @deprecated 使用 registerNotesListContributions(host) */
export function resetDemoNotesListContributionsForTests(): void {
  resetNotesListContributionsForTests();
}
