// 场景：笔记正文样式下拉 — 锚定按钮；portal 到 body，与排版滑块同一套 fixed 语义。
/* oxlint-disable eslint-plugin-react-perf(jsx-no-new-array-as-prop, jsx-no-new-function-as-prop, jsx-no-new-object-as-prop) -- 锚定几何 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { NotesTextStyleId } from "./editor-chrome-format";
import { useNotesAnchoredPopoverStyle } from "./notes-anchored-popover";
import { NotesTextStyleOptions, NOTES_TEXT_STYLE_PANEL_WIDTH } from "./notes-text-style-options";

/** 点外关闭时忽略触发按钮容器。 */
export const NOTES_TEXT_STYLE_OUTSIDE_IGNORE = "data-notes-text-style-chrome";

export function NotesTextStyleMenu(props: {
  current: NotesTextStyleId;
  onSelect: (id: NotesTextStyleId) => void;
  onClose: () => void;
  anchorTestIds: readonly string[];
  placement?: "above" | "below";
}) {
  const panelRef = useRef<View>(null);
  const anchorStyle = useNotesAnchoredPopoverStyle({
    open: true,
    anchorTestIds: props.anchorTestIds,
    placement: props.placement ?? "below",
    panelWidth: NOTES_TEXT_STYLE_PANEL_WIDTH,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const node = panelRef.current as unknown as { contains?: (n: Node) => boolean } | null;
      if (node?.contains?.(target)) {
        return;
      }
      if (target.closest(`[${NOTES_TEXT_STYLE_OUTSIDE_IGNORE}]`)) {
        return;
      }
      if (target.closest('[data-testid="workspace-app-action-overflow-hover-side-panel"]')) {
        return;
      }
      props.onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [props]);

  if (!anchorStyle) {
    return null;
  }

  const panel = (
    <View
      ref={panelRef}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- 锚定几何
      style={[styles.float, anchorStyle as object]}
      pointerEvents="box-none"
      testID="notes-text-style-menu"
    >
      <NotesTextStyleOptions
        current={props.current}
        onSelect={(id) => {
          props.onSelect(id);
          props.onClose();
        }}
      />
    </View>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(panel, document.body);
  }
  return panel;
}

const styles = StyleSheet.create({
  float: {
    zIndex: 1000,
  },
});
