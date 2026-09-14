// 场景：块菜单 — 对齐 Plane BlockMenu：点 #drag-handle 弹出（删除/复制/转段落/标题）。
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet as RNStyleSheet } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

export function NotesBlockMenu(props: { editor: Editor | null }) {
  const editor = props.editor;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const handle = target?.closest?.("#drag-handle");
      if (handle) {
        event.preventDefault();
        const rect = handle.getBoundingClientRect();
        setPos({ top: rect.top, left: Math.max(8, rect.left - 180) });
        setOpen(true);
        return;
      }
      if (target?.closest?.("[data-testid=notes-block-menu]")) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [editor]);

  if (!editor || !open) {
    return null;
  }

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  const duplicateBlock = () => {
    const { selection } = editor.state;
    if (!(selection instanceof NodeSelection)) {
      return;
    }
    const node = selection.node;
    const insertPos = selection.to;
    editor.view.dispatch(editor.state.tr.insert(insertPos, node.copy(node.content)));
  };

  const deleteBlock = () => {
    const { selection } = editor.state;
    if (selection instanceof NodeSelection) {
      editor.chain().focus().deleteSelection().run();
      return;
    }
    editor.chain().focus().clearNodes().run();
  };

  const items: { id: string; label: string; action: () => void }[] = [
    {
      id: "p",
      label: "正文",
      action: () => editor.chain().focus().setParagraph().run(),
    },
    {
      id: "h1",
      label: "标题 1",
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: "h2",
      label: "标题 2",
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "h3",
      label: "标题 3",
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      id: "dup",
      label: "复制块",
      action: duplicateBlock,
    },
    {
      id: "del",
      label: "删除块",
      action: deleteBlock,
    },
  ];

  return (
    <View
      pointerEvents="box-none"
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop, react-perf/jsx-no-new-array-as-prop -- floating pos
      style={[styles.layer, { top: pos.top, left: pos.left }]}
      testID="notes-block-menu"
    >
      <View style={styles.menu}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- menu action
            onPress={() => run(item.action)}
            style={styles.item}
            accessibilityRole="button"
          >
            <Text style={item.id === "del" ? styles.itemDanger : styles.itemLabel}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  layer: {
    position: "absolute",
    zIndex: 60,
  },
  menu: {
    minWidth: 160,
    borderRadius: theme.borderRadius.md,
    borderWidth: RNStyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.input,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  itemLabel: {
    fontSize: 13,
    color: theme.colors.foreground,
  },
  itemDanger: {
    fontSize: 13,
    color: theme.colors.statusDanger ?? "#f87171",
  },
}));
