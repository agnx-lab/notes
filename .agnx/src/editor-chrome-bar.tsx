// 场景：笔记标题上方左组 ActionBar — 单行横滚；正文样式为下拉。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- ActionBar 贡献表按态重建 */
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { WorkspaceAppActionBarProps, WorkspaceAppActionContribution } from "@getagnx/app-sdk";
import {
  NOTES_EDITOR_CHROME_MENU_ID,
  NOTES_EDITOR_CHROME_SURFACE,
  NOTES_EDITOR_LEFT_ACTION_ICONS,
  NOTES_EDITOR_LEFT_ACTION_IDS,
  NOTES_EDITOR_LEFT_ACTION_LABELS,
  type NotesEditorLeftActionId,
} from "./editor-chrome-actions";
import {
  emptyNotesLeftActionState,
  isNotesLeftActionStub,
  notesTextStyleShortLabel,
  type NotesLeftActionUiState,
  type NotesTextStyleId,
} from "./editor-chrome-format";
import { useNotesEditorChromeLayout } from "./editor-chrome-menu-surfaces";
import { NOTES_APP_ID } from "./ids";
import { getNotesHost } from "./notes-host";
import { NOTES_TEXT_STYLE_OUTSIDE_IGNORE, NotesTextStyleMenu } from "./notes-text-style-menu";
import { NotesTextStyleOptions } from "./notes-text-style-options";

function notesChromeShortcutSourceKey(actionId: string): string {
  return `entity-menu:${NOTES_APP_ID}:${NOTES_EDITOR_CHROME_MENU_ID}:${actionId}`;
}

export interface NotesEditorChromeBarProps {
  leftActionState?: NotesLeftActionUiState;
  onLeftAction: (id: NotesEditorLeftActionId) => void;
  onApplyTextStyle: (id: NotesTextStyleId) => void;
  /** 专属 Markdown 主题下覆盖壳层图标色，避免白底浅字。 */
  mutedColor?: string;
  accentColor?: string;
}

function leftTipLabel(id: NotesEditorLeftActionId, textStyleId: NotesTextStyleId): string {
  const base = NOTES_EDITOR_LEFT_ACTION_LABELS[id];
  if (isNotesLeftActionStub(id)) {
    return `${base}（即将支持）`;
  }
  if (id === "addFile") {
    return `${base}（图片/音视频/任意文件）`;
  }
  if (id === "textStyle") {
    return `正文样式（当前：${notesTextStyleShortLabel(textStyleId)}）`;
  }
  return base;
}

export function NotesEditorChromeBar(props: NotesEditorChromeBarProps) {
  const { theme, rt } = useUnistyles();
  const isCompact = rt.breakpoint === "xs" || rt.breakpoint === "sm";
  const host = getNotesHost();
  const leftMenu = useNotesEditorChromeLayout(NOTES_EDITOR_CHROME_SURFACE.left);
  const leftState = props.leftActionState ?? emptyNotesLeftActionState();
  const [textStyleOpen, setTextStyleOpen] = useState(false);
  const chromeDomProps = { [NOTES_TEXT_STYLE_OUTSIDE_IGNORE]: "1" } as Record<string, string>;

  useEffect(() => {
    const bind = host?.ui.bindEntityMenuShortcutRun;
    if (!bind) {
      return;
    }
    const disposers: Array<() => void> = [];
    for (const id of NOTES_EDITOR_LEFT_ACTION_IDS) {
      const actionId = id;
      disposers.push(
        bind(notesChromeShortcutSourceKey(actionId), () => {
          if (actionId === "textStyle") {
            setTextStyleOpen((open) => !open);
            return;
          }
          props.onLeftAction(actionId);
        }),
      );
    }
    return () => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [host, props]);

  const leftActions: WorkspaceAppActionContribution[] = NOTES_EDITOR_LEFT_ACTION_IDS.map((id) => {
    const isTextStyle = id === "textStyle";
    return {
      id,
      label: isTextStyle
        ? notesTextStyleShortLabel(leftState.textStyleId)
        : NOTES_EDITOR_LEFT_ACTION_LABELS[id],
      tipLabel: leftTipLabel(id, leftState.textStyleId),
      icon: NOTES_EDITOR_LEFT_ACTION_ICONS[id],
      active: isTextStyle
        ? textStyleOpen || Boolean(leftState.active[id])
        : Boolean(leftState.active[id]),
      disabled: Boolean(leftState.disabled[id]),
      onPress: () => {
        if (isTextStyle) {
          setTextStyleOpen((open) => !open);
          return;
        }
        props.onLeftAction(id);
      },
    };
  });

  if (!host?.ui.ActionBar) {
    return null;
  }

  const ActionBar = host.ui.ActionBar as ComponentType<WorkspaceAppActionBarProps>;

  return (
    <View
      style={styles.root}
      testID="notes-editor-chrome-bar"
      nativeID="notes-editor-chrome-layout-stack"
      {...chromeDomProps}
    >
      <View style={styles.sideFull} testID="notes-editor-chrome-left">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContentStart}
          testID="notes-editor-chrome-left-scroll"
        >
          <ActionBar
            layout={leftMenu.layout}
            actions={leftActions}
            shortcutEntityMenu={{
              appId: NOTES_APP_ID,
              menuId: NOTES_EDITOR_CHROME_MENU_ID,
            }}
            distribute="start"
            iconSize={16}
            mutedColor={props.mutedColor ?? theme.colors.foregroundMuted}
            accentColor={props.accentColor ?? theme.colors.accent}
            testID="notes-editor-chrome-left-actions"
            overflowMenu={{
              side: "bottom",
              align: "start",
              showEditLayout: true,
              editLayoutLabel: "编辑布局",
              onEditLayout: leftMenu.openEditLayout,
              testID: "notes-editor-chrome-left-overflow",
              renderHoverSidePanel: (id: string) => {
                if (id !== "textStyle") {
                  return null;
                }
                return (
                  <NotesTextStyleOptions
                    current={leftState.textStyleId}
                    onSelect={(styleId) => {
                      props.onApplyTextStyle(styleId);
                    }}
                  />
                );
              },
            }}
          />
        </ScrollView>
      </View>
      {textStyleOpen ? (
        <NotesTextStyleMenu
          current={leftState.textStyleId}
          onSelect={props.onApplyTextStyle}
          onClose={() => setTextStyleOpen(false)}
          anchorTestIds={[
            "notes-editor-chrome-left-actions-textStyle",
            "notes-editor-chrome-left-overflow-trigger",
          ]}
          placement={isCompact ? "above" : "below"}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
    width: "100%",
    minHeight: 32,
    zIndex: 20,
    overflow: "visible",
  },
  sideFull: {
    alignSelf: "stretch",
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
  },
  scroll: {
    maxWidth: "100%",
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContentStart: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingRight: 4,
  },
});
