// 场景：笔记排版滑块内容 — 浮层与溢出菜单 hover 二级面板共用。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- 主题色内联 */
import { useCallback } from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import {
  formatNotesTypographyValue,
  NOTES_TYPOGRAPHY_RANGE,
  readNotesTypographyValue,
  type NotesTypographyKind,
  type NotesTypographyState,
} from "./notes-typography";

export const NOTES_TYPOGRAPHY_PANEL_WIDTH = 200;

export function NotesTypographyControls(props: {
  kind: NotesTypographyKind;
  typography: NotesTypographyState;
  onChange: (kind: NotesTypographyKind, value: number) => void;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  const range = NOTES_TYPOGRAPHY_RANGE[props.kind];
  const value = readNotesTypographyValue(props.typography, props.kind);

  const handleChange = useCallback(
    (event: { target: { value: string } }) => {
      props.onChange(props.kind, Number(event.target.value));
    },
    [props],
  );

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.colors.popover,
          borderColor: theme.colors.border,
        },
      ]}
      testID={props.testID ?? `notes-typography-slider-${props.kind}`}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.foreground }]}>{range.label}</Text>
        <Text style={[styles.value, { color: theme.colors.foregroundMuted }]}>
          {formatNotesTypographyValue(props.kind, props.typography)}
        </Text>
      </View>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={handleChange}
        aria-label={range.label}
        style={{
          width: "100%",
          height: 16,
          margin: 0,
          accentColor: theme.colors.accent,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  panel: {
    width: NOTES_TYPOGRAPHY_PANEL_WIDTH,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing[2],
  },
  title: {
    fontSize: 11,
    fontWeight: theme.fontWeight.medium,
  },
  value: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
}));
