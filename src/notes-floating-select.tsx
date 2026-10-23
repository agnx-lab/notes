// 场景：Notes 浮层下拉 — 必须 portal 到 body + fixed 锚定，禁止嵌进 chrome/详情行。
//
// 【硬约束 · 反复踩坑】
// 1. 任何下拉/菜单/浮层：createPortal(document.body) + position:fixed 锚定触发器矩形。
// 2. 禁止把菜单当作触发条、胶囊、DetailSheet 行、ActionBar 的 DOM/布局子节点。
//    嵌进去会：撑开父宽、菜单跟父同宽、点外关闭乱、遮挡错误。
// 3. 新写选择器先复用本组件或 notes-anchored-popover；不要再手写「父级里 absolute/块级菜单」。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- 浮层选项行内样式 */
import { useRef } from "react";
import { createPortal } from "react-dom";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import {
  NOTES_TYPOGRAPHY_OUTSIDE_IGNORE,
  useNotesAnchoredPopoverStyle,
  useNotesPopoverOutsideDismiss,
  type NotesPopoverPlacement,
} from "./notes-anchored-popover";

export const NOTES_FLOATING_SELECT_WIDTH = 148;

export interface NotesFloatingSelectOption {
  id: string;
  label: string;
}

export function NotesFloatingSelectMenu(props: {
  open: boolean;
  options: ReadonlyArray<NotesFloatingSelectOption>;
  value: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  anchorTestIds: readonly string[];
  placement?: NotesPopoverPlacement;
  /** 默认 148；勿跟触发条同宽。 */
  panelWidth?: number;
  testID?: string;
  optionTestIdPrefix?: string;
  title?: string;
}) {
  const { theme } = useUnistyles();
  const panelRef = useRef<View>(null);
  const panelWidth = props.panelWidth ?? NOTES_FLOATING_SELECT_WIDTH;
  const placement = props.placement ?? "below";
  const anchorStyle = useNotesAnchoredPopoverStyle({
    open: props.open,
    anchorTestIds: props.anchorTestIds,
    placement,
    panelWidth,
    align: "start",
  });

  useNotesPopoverOutsideDismiss({
    enabled: props.open,
    onClose: props.onClose,
    panelRef,
  });

  if (!props.open || !anchorStyle || typeof document === "undefined" || !document.body) {
    return null;
  }

  const chromeDomProps = { [NOTES_TYPOGRAPHY_OUTSIDE_IGNORE]: "1" } as Record<string, string>;
  const prefix = props.optionTestIdPrefix ?? "notes-floating-select";

  const panel = (
    <View
      ref={panelRef}
      style={[
        styles.panel,
        {
          width: panelWidth,
          backgroundColor: theme.colors.popover,
          borderColor: theme.colors.border,
        },
        anchorStyle as object,
      ]}
      testID={props.testID ?? "notes-floating-select-menu"}
      {...chromeDomProps}
    >
      {props.title ? (
        <Text style={[styles.title, { color: theme.colors.foregroundMuted }]}>{props.title}</Text>
      ) : null}
      {props.options.map((option) => {
        const active = option.id === props.value;
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
              },
            ]}
            testID={`${prefix}-${option.id}`}
          >
            <Text
              style={[
                styles.rowText,
                { color: active ? theme.colors.accent : theme.colors.foreground },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return createPortal(panel, document.body);
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 2,
    // RN web 上与 anchored style 的 fixed 叠加；阴影避免「嵌进父级」错觉
    boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
  },
  title: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  row: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  rowText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
