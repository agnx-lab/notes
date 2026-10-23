// 场景：笔记编辑 entity-menu 双表面 — seed / 订阅 / 编辑布局（left 顶栏格式 + right 底栏状态）。
import { useCallback, useSyncExternalStore } from "react";
import type { WorkspaceAppActionBarLayout, WorkspaceAppHostApi } from "@agnx-lab/app-sdk";
import { NOTES_APP_ID } from "./ids";
import {
  NOTES_EDITOR_CHROME_MENU_ID,
  NOTES_EDITOR_CHROME_SURFACE,
  NOTES_EDITOR_LEFT_ACTION_ICONS,
  NOTES_EDITOR_LEFT_ACTION_IDS,
  NOTES_EDITOR_LEFT_ACTION_LABELS,
  NOTES_EDITOR_RIGHT_ACTION_ICONS,
  NOTES_EDITOR_RIGHT_ACTION_IDS,
  NOTES_EDITOR_RIGHT_ACTION_LABELS,
  type NotesEditorChromeSurfaceId,
} from "./editor-chrome-actions";
import { getNotesHost } from "./notes-host";

function layoutsEqual(a: WorkspaceAppActionBarLayout, b: WorkspaceAppActionBarLayout): boolean {
  if (a === b) {
    return true;
  }
  if ((a.showBarLabels ?? false) !== (b.showBarLabels ?? false)) {
    return false;
  }
  const same = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && left.every((id, index) => id === right[index]);
  return same(a.bar, b.bar) && same(a.overflow, b.overflow) && same(a.hidden ?? [], b.hidden ?? []);
}

const layoutCache = new Map<string, WorkspaceAppActionBarLayout>();

function cachedLayout(
  cacheKey: string,
  layout: WorkspaceAppActionBarLayout,
): WorkspaceAppActionBarLayout {
  const prev = layoutCache.get(cacheKey);
  if (prev && layoutsEqual(prev, layout)) {
    return prev;
  }
  layoutCache.set(cacheKey, layout);
  return layout;
}

/** 右组默认：六枚状态动作外露 bar + 文字标签（对齐旧芯片）。 */
export function getDefaultNotesEditorRightLayout(): WorkspaceAppActionBarLayout {
  return {
    bar: [...NOTES_EDITOR_RIGHT_ACTION_IDS],
    overflow: [],
    hidden: [],
    showBarLabels: true,
  };
}

/** 左组默认：格式工具图标外露；听写/文件夹暂可藏进 overflow 或一并外露。 */
export function getDefaultNotesEditorLeftLayout(): WorkspaceAppActionBarLayout {
  return {
    bar: [...NOTES_EDITOR_LEFT_ACTION_IDS],
    overflow: [],
    hidden: [],
    showBarLabels: false,
  };
}

const STABLE_DEFAULT_RIGHT_LAYOUT = getDefaultNotesEditorRightLayout();
const STABLE_DEFAULT_LEFT_LAYOUT = getDefaultNotesEditorLeftLayout();

function surfaceConfig(surfaceId: NotesEditorChromeSurfaceId): {
  knownIds: readonly string[];
  title: string;
  defaultLayout: WorkspaceAppActionBarLayout;
  items: Array<{ id: string; label: string; icon: unknown; canHide: boolean }>;
} {
  if (surfaceId === NOTES_EDITOR_CHROME_SURFACE.left) {
    return {
      knownIds: NOTES_EDITOR_LEFT_ACTION_IDS,
      title: "编辑格式工具栏",
      defaultLayout: STABLE_DEFAULT_LEFT_LAYOUT,
      items: NOTES_EDITOR_LEFT_ACTION_IDS.map((id) => ({
        id,
        label: NOTES_EDITOR_LEFT_ACTION_LABELS[id],
        icon: NOTES_EDITOR_LEFT_ACTION_ICONS[id],
        canHide: true,
        shortcutSourceKey: `entity-menu:${NOTES_APP_ID}:${NOTES_EDITOR_CHROME_MENU_ID}:${id}`,
      })),
    };
  }
  return {
    knownIds: NOTES_EDITOR_RIGHT_ACTION_IDS,
    title: "编辑底栏工具",
    defaultLayout: STABLE_DEFAULT_RIGHT_LAYOUT,
    items: NOTES_EDITOR_RIGHT_ACTION_IDS.map((id) => ({
      id,
      label: NOTES_EDITOR_RIGHT_ACTION_LABELS[id],
      icon: NOTES_EDITOR_RIGHT_ACTION_ICONS[id],
      canHide: true,
      shortcutSourceKey: `entity-menu:${NOTES_APP_ID}:${NOTES_EDITOR_CHROME_MENU_ID}:${id}`,
    })),
  };
}

export function seedNotesEditorChromeMenus(hostApi: WorkspaceAppHostApi): void {
  for (const surfaceId of [
    NOTES_EDITOR_CHROME_SURFACE.left,
    NOTES_EDITOR_CHROME_SURFACE.right,
  ] as const) {
    const config = surfaceConfig(surfaceId);
    hostApi.ui.registerEntityMenuLayoutCatalog({
      appId: NOTES_APP_ID,
      menuId: NOTES_EDITOR_CHROME_MENU_ID,
      surfaceId,
      items: config.items as never,
      defaultLayout: config.defaultLayout,
      order: surfaceId === NOTES_EDITOR_CHROME_SURFACE.left ? 0 : 1,
    });
    hostApi.ui.seedEntityMenuLayoutIfAbsent({
      appId: NOTES_APP_ID,
      menuId: NOTES_EDITOR_CHROME_MENU_ID,
      surfaceId,
      knownIds: config.knownIds,
      layout: config.defaultLayout,
    });
  }
}

export function openNotesEditorChromeLayoutEditor(surfaceId: NotesEditorChromeSurfaceId): void {
  const hostApi = getNotesHost();
  if (!hostApi) {
    return;
  }
  const config = surfaceConfig(surfaceId);
  hostApi.ui.customizeEntityMenuLayout({
    appId: NOTES_APP_ID,
    menuId: NOTES_EDITOR_CHROME_MENU_ID,
    surfaceId,
    title: config.title,
    items: config.items as never,
    defaultLayout: config.defaultLayout,
  });
}

export function useNotesEditorChromeLayout(surfaceId: NotesEditorChromeSurfaceId): {
  layout: WorkspaceAppActionBarLayout;
  openEditLayout: () => void;
} {
  const config = surfaceConfig(surfaceId);
  const cacheKey = `${NOTES_APP_ID}:${NOTES_EDITOR_CHROME_MENU_ID}:${surfaceId}`;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const hostApi = getNotesHost();
      if (!hostApi) {
        return () => {};
      }
      try {
        return hostApi.ui.subscribeEntityMenuLayout(
          {
            appId: NOTES_APP_ID,
            menuId: NOTES_EDITOR_CHROME_MENU_ID,
            surfaceId,
          },
          onStoreChange,
        );
      } catch {
        return () => {};
      }
    },
    [surfaceId],
  );

  const getSnapshot = useCallback(() => {
    const hostApi = getNotesHost();
    if (!hostApi) {
      return cachedLayout(cacheKey, config.defaultLayout);
    }
    try {
      const layout = hostApi.ui.getEntityMenuLayout({
        appId: NOTES_APP_ID,
        menuId: NOTES_EDITOR_CHROME_MENU_ID,
        surfaceId,
        knownIds: config.knownIds,
      });
      return cachedLayout(cacheKey, layout);
    } catch {
      return cachedLayout(cacheKey, config.defaultLayout);
    }
  }, [cacheKey, config.defaultLayout, config.knownIds, surfaceId]);

  const layout = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const openEditLayout = useCallback(() => {
    openNotesEditorChromeLayoutEditor(surfaceId);
  }, [surfaceId]);

  return { layout, openEditLayout };
}
