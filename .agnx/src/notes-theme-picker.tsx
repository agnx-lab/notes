// 场景：笔记底栏主题选择浮层 — 跟随全局 + Notes 专属 Markdown 包。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- 浮层选项行内样式 */
import { useRef } from "react";
import { createPortal } from "react-dom";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import {
  useNotesAnchoredPopoverStyle,
  useNotesPopoverOutsideDismiss,
  NOTES_TYPOGRAPHY_OUTSIDE_IGNORE,
} from "./notes-anchored-popover";
import { NOTES_PROSE_THEME_OPTIONS, type NotesProseThemeId } from "./notes-prose-theme";

export const NOTES_THEME_PANEL_WIDTH = 200;

export function NotesThemePickerPanel(props: {
  selected: NotesProseThemeId;
  onSelect: (id: NotesProseThemeId) => void;
  onClose: () => void;
  anchorTestIds: readonly string[];
  placement?: "above" | "below";
}) {
  const { theme } = useUnistyles();
  const panelRef = useRef<View>(null);
  const placement = props.placement ?? "above";
  const anchorStyle = useNotesAnchoredPopoverStyle({
    open: true,
    anchorTestIds: props.anchorTestIds,
    placement,
    panelWidth: NOTES_THEME_PANEL_WIDTH,
  });

  useNotesPopoverOutsideDismiss({
    enabled: true,
    onClose: props.onClose,
    panelRef,
  });

  if (!anchorStyle) {
    return null;
  }

  const chromeDomProps = { [NOTES_TYPOGRAPHY_OUTSIDE_IGNORE]: "1" } as Record<string, string>;

  const panel = (
    <View
      ref={panelRef}
      style={[
        styles.panel,
        {
          backgroundColor: theme.colors.popover,
          borderColor: theme.colors.border,
        },
        anchorStyle as object,
      ]}
      testID="notes-theme-picker-panel"
      {...chromeDomProps}
    >
      <Text style={[styles.title, { color: theme.colors.foregroundMuted }]}>文档主题</Text>
      {NOTES_PROSE_THEME_OPTIONS.map((option) => {
        const active = option.id === props.selected;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              props.onSelect(option.id);
              props.onClose();
            }}
            style={[
              styles.row,
              {
                backgroundColor: active ? "rgba(0,0,0,0.22)" : "transparent",
                borderColor: active ? theme.colors.accent : "transparent",
              },
            ]}
            testID={`notes-theme-option-${option.id}`}
          >
            <Text
              style={[
                styles.rowLabel,
                { color: active ? theme.colors.accent : theme.colors.foreground },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(panel, document.body);
  }
  return panel;
}

const styles = StyleSheet.create((theme) => ({
  panel: {
    width: NOTES_THEME_PANEL_WIDTH,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
    boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
    zIndex: 10050,
  },
  title: {
    fontSize: 11,
    fontWeight: theme.fontWeight.medium,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  row: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  rowLabel: {
    fontSize: 12,
  },
}));
