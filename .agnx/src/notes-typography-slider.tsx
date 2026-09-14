// 场景：笔记排版滑块浮层 — 锚定触发按钮；portal 到 body，避免底栏祖先破坏 fixed。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- 主题色内联 style */
import { useRef } from "react";
import { createPortal } from "react-dom";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
  useNotesAnchoredPopoverStyle,
  useNotesPopoverOutsideDismiss,
  NOTES_TYPOGRAPHY_OUTSIDE_IGNORE,
} from "./notes-anchored-popover";
import { NotesTypographyControls, NOTES_TYPOGRAPHY_PANEL_WIDTH } from "./notes-typography-controls";
import type { NotesTypographyKind, NotesTypographyState } from "./notes-typography";

export { NOTES_TYPOGRAPHY_OUTSIDE_IGNORE } from "./notes-anchored-popover";

export function NotesTypographySliderPanel(props: {
  kind: NotesTypographyKind;
  typography: NotesTypographyState;
  onChange: (kind: NotesTypographyKind, value: number) => void;
  onClose: () => void;
  /** 触发按钮 data-testid 候选（外露 → 三点 trigger） */
  anchorTestIds: readonly string[];
  placement?: "above" | "below";
}) {
  const panelRef = useRef<View>(null);
  const placement = props.placement ?? "above";
  const anchorStyle = useNotesAnchoredPopoverStyle({
    open: true,
    anchorTestIds: props.anchorTestIds,
    placement,
    panelWidth: NOTES_TYPOGRAPHY_PANEL_WIDTH,
  });

  useNotesPopoverOutsideDismiss({
    enabled: true,
    onClose: props.onClose,
    panelRef,
  });

  // 首帧可能尚未量到锚点；fallback 会马上补上，这里只挡完全未 open 的情况。
  if (!anchorStyle) {
    return null;
  }

  const chromeDomProps = { [NOTES_TYPOGRAPHY_OUTSIDE_IGNORE]: "1" } as Record<string, string>;

  const panel = (
    <View
      ref={panelRef}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- 锚定几何
      style={[styles.float, anchorStyle as object]}
      pointerEvents="box-none"
      testID="notes-typography-slider-layer"
      {...chromeDomProps}
    >
      <NotesTypographyControls
        kind={props.kind}
        typography={props.typography}
        onChange={props.onChange}
      />
    </View>
  );

  // fixed 坐标按视口算；挂在底栏/ScrollView 祖先下会被 transform 带偏。
  if (typeof document !== "undefined" && document.body) {
    return createPortal(panel, document.body);
  }
  return panel;
}

const styles = StyleSheet.create({
  float: {
    zIndex: 10050,
  },
});
