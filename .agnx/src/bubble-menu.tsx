// 场景：选区 Bubble — 含 Plane 风格内联链接编辑（输入 URL / 清除），不用 window.prompt。
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet as RNStyleSheet } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { Editor } from "@tiptap/core";
import { isNotesLinkHrefAllowed } from "./notes-link";

export interface NotesBubbleMenuProps {
  editor: Editor | null;
}

interface BubbleAction {
  id: string;
  label: string;
  isActive: () => boolean;
  run: () => void;
}

function BubbleButton(props: { action: BubbleAction }) {
  return (
    <Pressable
      // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- bubble action
      onPress={() => props.action.run()}
      style={props.action.isActive() ? styles.btnActive : styles.btn}
      accessibilityRole="button"
    >
      <Text style={styles.btnLabel}>{props.action.label}</Text>
    </Pressable>
  );
}

export function NotesBubbleMenu(props: NotesBubbleMenuProps) {
  const { theme } = useUnistyles();
  const editor = props.editor;
  const [visible, setVisible] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [, setTick] = useState(0);
  const menuRef = useRef<View>(null);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const refresh = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || !editor.isEditable || !editor.view.hasFocus()) {
        setVisible(false);
        setLinkOpen(false);
        return;
      }
      try {
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        const host = editor.view.dom.getBoundingClientRect();
        const top = Math.max(4, Math.min(start.top, end.top) - host.top - 44);
        const left = Math.max(4, (start.left + end.left) / 2 - host.left - 120);
        setVisible(true);
        setTick((n) => n + 1);
        requestAnimationFrame(() => {
          const node = menuRef.current as unknown as { style?: Record<string, string> } | null;
          if (node?.style) {
            node.style.top = `${top}px`;
            node.style.left = `${left}px`;
          }
        });
      } catch {
        setVisible(false);
        setLinkOpen(false);
      }
    };
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    const onBlur = () => {
      setVisible(false);
      setLinkOpen(false);
    };
    editor.on("blur", onBlur);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
      editor.off("blur", onBlur);
    };
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) {
      return;
    }
    const href = linkDraft.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!isNotesLinkHrefAllowed(href)) {
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  }, [editor, linkDraft]);

  if (!editor || !visible) {
    return null;
  }

  const actions: BubbleAction[] = [
    {
      id: "bold",
      label: "B",
      isActive: () => editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      id: "italic",
      label: "I",
      isActive: () => editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      id: "strike",
      label: "S",
      isActive: () => editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      id: "code",
      label: "</>",
      isActive: () => editor.isActive("code"),
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      id: "h1",
      label: "H1",
      isActive: () => editor.isActive("heading", { level: 1 }),
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: "h2",
      label: "H2",
      isActive: () => editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "link",
      label: "链接",
      isActive: () => editor.isActive("link") || linkOpen,
      run: () => {
        const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
        let decoded = prev;
        try {
          decoded = decodeURIComponent(prev);
        } catch {
          decoded = prev;
        }
        setLinkDraft(decoded || "https://");
        setLinkOpen((open) => !open);
      },
    },
  ];

  return (
    <View pointerEvents="box-none" style={styles.layer} testID="notes-bubble-menu">
      <View ref={menuRef} style={styles.menu}>
        <View style={styles.row}>
          {actions.map((action) => (
            <BubbleButton key={action.id} action={action} />
          ))}
        </View>
        {linkOpen ? (
          <View style={styles.linkRow} testID="notes-bubble-link-editor">
            <TextInput
              value={linkDraft}
              onChangeText={setLinkDraft}
              placeholder="https:// 或相对路径"
              placeholderTextColor={theme.colors.foregroundMuted}
              style={styles.linkInput}
              autoCapitalize="none"
              autoCorrect={false}
              // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- submit link
              onSubmitEditing={applyLink}
            />
            <Pressable
              style={styles.linkBtn}
              // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- apply link
              onPress={applyLink}
              accessibilityRole="button"
            >
              <Text style={styles.btnLabel}>应用</Text>
            </Pressable>
            <Pressable
              style={styles.linkBtn}
              // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- clear link
              onPress={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setLinkOpen(false);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.btnLabel}>清除</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  layer: {
    ...RNStyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  menu: {
    position: "absolute",
    gap: 4,
    padding: 4,
    borderRadius: theme.borderRadius.md,
    borderWidth: RNStyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.input,
    maxWidth: 360,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 2,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  linkInput: {
    flex: 1,
    minWidth: 140,
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    borderWidth: RNStyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.background,
  },
  linkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "rgba(125, 211, 252, 0.18)",
  },
  btn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  btnActive: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "rgba(125, 211, 252, 0.22)",
  },
  btnLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
}));
