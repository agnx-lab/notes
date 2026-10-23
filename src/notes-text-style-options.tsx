// 场景：笔记正文样式选项列表 — 浮层与溢出 hover 二级面板共用。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- 主题色 */
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { NOTES_TEXT_STYLE_OPTIONS, type NotesTextStyleId } from "./editor-chrome-format";

export const NOTES_TEXT_STYLE_PANEL_WIDTH = 148;

export function NotesTextStyleOptions(props: {
  current: NotesTextStyleId;
  onSelect: (id: NotesTextStyleId) => void;
}) {
  const { theme } = useUnistyles();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: theme.colors.popover, borderColor: theme.colors.border },
      ]}
      testID="notes-text-style-options"
    >
      {NOTES_TEXT_STYLE_OPTIONS.map((option) => {
        const active = option.id === props.current;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            onPress={() => props.onSelect(option.id)}
            style={[styles.item, active ? { backgroundColor: theme.colors.border } : null]}
            testID={`notes-text-style-option-${option.id}`}
          >
            <Text
              style={[
                styles.itemLabel,
                { color: active ? theme.colors.accent : theme.colors.foreground },
                option.id === "h1" ? styles.h1 : null,
                option.id === "h2" ? styles.h2 : null,
                option.id === "h3" ? styles.h3 : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  panel: {
    width: NOTES_TEXT_STYLE_PANEL_WIDTH,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
  },
  item: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
  },
  h1: {
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
  },
  h2: {
    fontSize: 15,
    fontWeight: theme.fontWeight.semibold,
  },
  h3: {
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
  },
}));
