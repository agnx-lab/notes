// 场景：笔记编辑底栏 — 左三枚状态徽章 + 右对齐横滚 ActionBar；排版滑块向上浮出。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- ActionBar 贡献表按态重建 */
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet as RNStyleSheet } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { WorkspaceAppActionBarProps, WorkspaceAppActionContribution } from "@getagnx/app-sdk";
import {
  NOTES_EDITOR_CHROME_MENU_ID,
  NOTES_EDITOR_CHROME_SURFACE,
  NOTES_EDITOR_RIGHT_ACTION_ICONS,
  NOTES_EDITOR_RIGHT_ACTION_IDS,
  resolveRightActionLabel,
  type NotesEditorRightActionId,
} from "./editor-chrome-actions";
import { useNotesEditorChromeLayout } from "./editor-chrome-menu-surfaces";
import { NOTES_APP_ID } from "./ids";
import { getNotesHost } from "./notes-host";
import {
  formatNotesTypographyTip,
  type NotesTypographyKind,
  type NotesTypographyState,
} from "./notes-typography";
import {
  NOTES_TYPOGRAPHY_OUTSIDE_IGNORE,
  NotesTypographySliderPanel,
} from "./notes-typography-slider";
import { NotesTypographyControls } from "./notes-typography-controls";
import { NotesThemePickerPanel } from "./notes-theme-picker";
import { notesProseThemeLabel, type NotesProseThemeId } from "./notes-prose-theme";

export type NotesSaveStatus = "saved" | "saving" | "dirty" | "error";

export interface NotesStatusBarProps {
  status: NotesSaveStatus;
  characters: number;
  words: number;
  lastSavedAt: number | null;
  editorMode: "rich" | "source";
  wordWrap: boolean;
  foldAllActive: boolean;
  foldAllDisabled?: boolean;
  outlineOpen: boolean;
  versionsOpen: boolean;
  typography: NotesTypographyState;
  markdownTheme: NotesProseThemeId;
  chromeMutedColor?: string;
  chromeAccentColor?: string;
  chromeBadgeFg?: string;
  chromeBadgeBorder?: string;
  chromeBadgeBg?: string;
  onTypographyChange: (kind: NotesTypographyKind, value: number) => void;
  onMarkdownThemeChange: (id: NotesProseThemeId) => void;
  onToggleEditorMode: () => void;
  onToggleWordWrap: () => void;
  onToggleFoldAll: () => void;
  onToggleOutline: () => void;
  onToggleVersions: () => void;
  onExportMarkdown: () => void;
}

function notesChromeShortcutSourceKey(actionId: string): string {
  return `entity-menu:${NOTES_APP_ID}:${NOTES_EDITOR_CHROME_MENU_ID}:${actionId}`;
}

function statusLabel(status: NotesSaveStatus): string {
  switch (status) {
    case "saving":
      return "保存中…";
    case "dirty":
      return "未保存";
    case "error":
      return "保存失败";
    default:
      return "已保存";
  }
}

function formatTime(ts: number | null): string {
  if (!ts) {
    return "";
  }
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.floor(n)));
}

function isTypographyRightAction(id: NotesEditorRightActionId): id is NotesTypographyKind {
  return (
    id === "fontSize" || id === "lineHeight" || id === "paragraphSpacing" || id === "pageWidth"
  );
}

function rightActionActive(
  id: NotesEditorRightActionId,
  props: NotesStatusBarProps,
  openKind: NotesTypographyKind | null,
  themePickerOpen: boolean,
): boolean {
  if (isTypographyRightAction(id)) {
    return openKind === id;
  }
  if (id === "markdownTheme") {
    return themePickerOpen || props.markdownTheme !== "inherit";
  }
  switch (id) {
    case "toggleSource":
      return props.editorMode === "source";
    case "toggleWordWrap":
      return props.wordWrap;
    case "toggleFoldAll":
      return props.foldAllActive;
    case "toggleOutline":
      return props.outlineOpen;
    case "toggleVersions":
      return props.versionsOpen;
    default:
      return false;
  }
}

function rightActionDisabled(id: NotesEditorRightActionId, props: NotesStatusBarProps): boolean {
  return id === "toggleFoldAll" && Boolean(props.foldAllDisabled);
}

function rightTipLabel(id: NotesEditorRightActionId, props: NotesStatusBarProps): string {
  if (isTypographyRightAction(id)) {
    return formatNotesTypographyTip(id, props.typography);
  }
  if (id === "markdownTheme") {
    return `主题 ${notesProseThemeLabel(props.markdownTheme)}`;
  }
  return resolveRightActionLabel(id, props);
}

function rightActionPress(
  id: NotesEditorRightActionId,
  props: NotesStatusBarProps,
  openTypography: (kind: NotesTypographyKind) => void,
  toggleThemePicker: () => void,
): () => void {
  switch (id) {
    case "fontSize":
      return () => openTypography("fontSize");
    case "lineHeight":
      return () => openTypography("lineHeight");
    case "paragraphSpacing":
      return () => openTypography("paragraphSpacing");
    case "pageWidth":
      return () => openTypography("pageWidth");
    case "markdownTheme":
      return toggleThemePicker;
    case "toggleSource":
      return props.onToggleEditorMode;
    case "toggleWordWrap":
      return props.onToggleWordWrap;
    case "toggleFoldAll":
      return props.onToggleFoldAll;
    case "toggleOutline":
      return props.onToggleOutline;
    case "toggleVersions":
      return props.onToggleVersions;
    case "exportMarkdown":
      return props.onExportMarkdown;
    default:
      return () => undefined;
  }
}

function StatusBadge(props: {
  label: string;
  testID: string;
  borderColor: string;
  backgroundColor: string;
  color: string;
}) {
  return (
    <View
      style={[
        styles.badge,
        { borderColor: props.borderColor, backgroundColor: props.backgroundColor },
      ]}
      testID={props.testID}
    >
      <Text style={[styles.badgeText, { color: props.color }]} numberOfLines={1}>
        {props.label}
      </Text>
    </View>
  );
}

export function NotesStatusBar(props: NotesStatusBarProps) {
  const { theme, rt } = useUnistyles();
  const isCompact = rt.breakpoint === "xs" || rt.breakpoint === "sm";
  const host = getNotesHost();
  const rightMenu = useNotesEditorChromeLayout(NOTES_EDITOR_CHROME_SURFACE.right);
  const [typographyKind, setTypographyKind] = useState<NotesTypographyKind | null>(null);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  const openTypography = (kind: NotesTypographyKind) => {
    setThemePickerOpen(false);
    setTypographyKind((prev) => (prev === kind ? null : kind));
  };

  const toggleThemePicker = () => {
    setTypographyKind(null);
    setThemePickerOpen((open) => !open);
  };

  useEffect(() => {
    const bind = host?.ui.bindEntityMenuShortcutRun;
    if (!bind) {
      return;
    }
    const disposers: Array<() => void> = [];
    for (const id of NOTES_EDITOR_RIGHT_ACTION_IDS) {
      const actionId = id;
      disposers.push(
        bind(notesChromeShortcutSourceKey(actionId), () => {
          rightActionPress(actionId, props, openTypography, toggleThemePicker)();
        }),
      );
    }
    return () => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [host, props]);

  const saveBadge =
    props.status === "saved" && props.lastSavedAt
      ? `${statusLabel(props.status)} ${formatTime(props.lastSavedAt)}`
      : statusLabel(props.status);
  const wordsBadge = `${formatCount(props.words)} 词`;
  const charsBadge = `${formatCount(props.characters)} 字`;
  const badgeBorder = props.chromeBadgeBorder ?? theme.colors.border;
  const badgeBg = props.chromeBadgeBg ?? theme.colors.surface2;
  const badgeFg = props.chromeBadgeFg ?? theme.colors.foregroundMuted;
  const mutedColor = props.chromeMutedColor ?? theme.colors.foregroundMuted;
  const accentColor = props.chromeAccentColor ?? theme.colors.accent;

  const rightActions: WorkspaceAppActionContribution[] = NOTES_EDITOR_RIGHT_ACTION_IDS.map((id) => {
    const label = resolveRightActionLabel(id, props);
    return {
      id,
      label,
      tipLabel: rightTipLabel(id, props),
      icon: NOTES_EDITOR_RIGHT_ACTION_ICONS[id],
      active: rightActionActive(id, props, typographyKind, themePickerOpen),
      disabled: rightActionDisabled(id, props),
      onPress: rightActionPress(id, props, openTypography, toggleThemePicker),
    };
  });

  const ActionBar = host?.ui.ActionBar as ComponentType<WorkspaceAppActionBarProps> | undefined;
  const chromeDomProps = { [NOTES_TYPOGRAPHY_OUTSIDE_IGNORE]: "1" } as Record<string, string>;

  return (
    <View
      // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-object-as-prop -- 主题边框色
      style={[styles.root, { borderTopColor: props.chromeBadgeBorder ?? theme.colors.border }]}
      testID="notes-status-bar"
    >
      <View style={styles.badges} testID="notes-status-badges">
        <StatusBadge
          label={saveBadge}
          testID="notes-save-status"
          borderColor={badgeBorder}
          backgroundColor={badgeBg}
          color={badgeFg}
        />
        <StatusBadge
          label={wordsBadge}
          testID="notes-words-badge"
          borderColor={badgeBorder}
          backgroundColor={badgeBg}
          color={badgeFg}
        />
        <StatusBadge
          label={charsBadge}
          testID="notes-chars-badge"
          borderColor={badgeBorder}
          backgroundColor={badgeBg}
          color={badgeFg}
        />
      </View>
      <Text style={styles.srOnly} testID="notes-word-stats">
        {`${props.words} 词 · ${props.characters} 字`}
      </Text>
      {ActionBar ? (
        <View style={styles.actionsHost} testID="notes-editor-chrome-right" {...chromeDomProps}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContentEnd}
            testID="notes-editor-chrome-right-scroll"
          >
            <ActionBar
              layout={rightMenu.layout}
              actions={rightActions}
              shortcutEntityMenu={{
                appId: NOTES_APP_ID,
                menuId: NOTES_EDITOR_CHROME_MENU_ID,
              }}
              distribute="end"
              iconSize={16}
              mutedColor={mutedColor}
              accentColor={accentColor}
              testID="notes-editor-chrome-right-actions"
              overflowMenu={{
                side: "top",
                align: "end",
                showEditLayout: true,
                editLayoutLabel: "编辑布局",
                onEditLayout: rightMenu.openEditLayout,
                testID: "notes-editor-chrome-right-overflow",
                renderHoverSidePanel: (id: string) => {
                  if (
                    id !== "fontSize" &&
                    id !== "lineHeight" &&
                    id !== "paragraphSpacing" &&
                    id !== "pageWidth"
                  ) {
                    return null;
                  }
                  return (
                    <NotesTypographyControls
                      kind={id}
                      typography={props.typography}
                      onChange={props.onTypographyChange}
                      testID={`notes-typography-overflow-side-${id}`}
                    />
                  );
                },
              }}
            />
          </ScrollView>
          {typographyKind ? (
            <NotesTypographySliderPanel
              kind={typographyKind}
              typography={props.typography}
              onChange={props.onTypographyChange}
              onClose={() => setTypographyKind(null)}
              placement={isCompact ? "below" : "above"}
              anchorTestIds={[
                `notes-editor-chrome-right-actions-${typographyKind}`,
                "notes-editor-chrome-right-overflow-trigger",
              ]}
            />
          ) : null}
          {themePickerOpen ? (
            <NotesThemePickerPanel
              selected={props.markdownTheme}
              onSelect={props.onMarkdownThemeChange}
              onClose={() => setThemePickerOpen(false)}
              placement={isCompact ? "below" : "above"}
              anchorTestIds={[
                "notes-editor-chrome-right-actions-markdownTheme",
                "notes-editor-chrome-right-overflow-trigger",
              ]}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    position: "relative",
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[3],
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[2],
    borderTopWidth: RNStyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: "transparent",
    overflow: "visible",
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: theme.spacing[1],
  },
  badge: {
    borderWidth: RNStyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: theme.fontSize.xs,
    lineHeight: Math.round(theme.fontSize.xs * 1.35),
    fontVariant: ["tabular-nums"],
  },
  actionsHost: {
    position: "relative",
    flex: 1,
    minWidth: 0,
    overflow: "visible",
  },
  scroll: {
    maxWidth: "100%",
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContentEnd: {
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingLeft: 4,
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
}));
