// 场景：笔记大纲侧栏 — 树形缩进 + 节点折叠 + 点击跳转。
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View, type ViewStyle } from "react-native";
import { StyleSheet as RNStyleSheet } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { NoteOutlineHeading, NoteVersion } from "./note-model";
import { buildOutlineTree, type OutlineTreeNode } from "./outline-tree";

export type { OutlineTreeNode };
export { buildOutlineTree };

export interface NotesOutlinePanelProps {
  headings: NoteOutlineHeading[];
  onJump?: (heading: NoteOutlineHeading) => void;
}

function nodeKey(heading: NoteOutlineHeading): string {
  return `${heading.line}:${heading.level}:${heading.text}:${heading.occurrence}`;
}

function rowStyle(depth: number): ViewStyle {
  return {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
    paddingRight: 4,
    paddingLeft: 8 + depth * 14,
    gap: 2,
  };
}

function OutlineTreeRows(props: {
  nodes: OutlineTreeNode[];
  collapsed: Record<string, boolean>;
  onToggle: (key: string) => void;
  onJump?: (heading: NoteOutlineHeading) => void;
}) {
  const rows: ReactNode[] = [];
  const walk = (nodes: OutlineTreeNode[]) => {
    for (const node of nodes) {
      const key = nodeKey(node.heading);
      const hasChildren = node.children.length > 0;
      const isCollapsed = Boolean(props.collapsed[key]);
      rows.push(
        <View key={key} style={rowStyle(node.depth)}>
          {hasChildren ? (
            <Pressable
              // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- fold key
              onPress={() => props.onToggle(key)}
              style={styles.foldBtn}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.foldIcon}>{isCollapsed ? "▸" : "▾"}</Text>
            </Pressable>
          ) : (
            <Text style={styles.foldLeaf}>·</Text>
          )}
          <Pressable
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- jump
            onPress={() => props.onJump?.(node.heading)}
            style={styles.rowPress}
            accessibilityRole="button"
          >
            <Text style={node.depth === 0 ? styles.rowTextRoot : styles.rowText} numberOfLines={2}>
              {node.heading.text}
            </Text>
          </Pressable>
        </View>,
      );
      if (hasChildren && !isCollapsed) {
        walk(node.children);
      }
    }
  };
  walk(props.nodes);
  return <View>{rows}</View>;
}

export function NotesOutlinePanel(props: NotesOutlinePanelProps) {
  const tree = useMemo(() => buildOutlineTree(props.headings), [props.headings]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const handleToggle = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <View style={styles.panel} testID="notes-outline-panel">
      <Text style={styles.heading}>大纲</Text>
      {props.headings.length === 0 ? (
        <Text style={styles.empty}>暂无标题。用 `#` / `##` / `###` 或 `/` 写入。</Text>
      ) : (
        <ScrollView style={styles.scroll}>
          <OutlineTreeRows
            nodes={tree}
            collapsed={collapsed}
            onToggle={handleToggle}
            onJump={props.onJump}
          />
        </ScrollView>
      )}
    </View>
  );
}

export interface NotesVersionsPanelProps {
  versions: NoteVersion[];
  onRestore: (versionId: string) => void;
}

function VersionRow(props: { version: NoteVersion; onRestore: (versionId: string) => void }) {
  const time = new Date(props.version.createdAt);
  const label = `${time.toLocaleDateString()} ${time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })}`;
  const preview = props.version.body.trim()
    ? `${props.version.title} · ${props.version.body.trim().slice(0, 60)}`
    : props.version.title;
  return (
    <Pressable
      // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- binds version id
      onPress={() => props.onRestore(props.version.id)}
      style={styles.versionRow}
      accessibilityRole="button"
    >
      <Text style={styles.versionTime}>{label}</Text>
      <Text style={styles.versionPreview} numberOfLines={2}>
        {preview}
      </Text>
    </Pressable>
  );
}

export function NotesVersionsPanel(props: NotesVersionsPanelProps) {
  return (
    <View style={styles.panel} testID="notes-versions-panel">
      <Text style={styles.heading}>本地版本</Text>
      {props.versions.length === 0 ? (
        <Text style={styles.empty}>尚无快照。编辑并保存一段时间后会出现。</Text>
      ) : (
        <ScrollView style={styles.scroll}>
          {props.versions.map((version) => (
            <VersionRow key={version.id} version={version} onRestore={props.onRestore} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  panel: {
    width: 240,
    borderLeftWidth: RNStyleSheet.hairlineWidth,
    borderLeftColor: theme.colors.border,
    paddingHorizontal: theme.spacing[2],
    paddingTop: theme.spacing[4],
    backgroundColor: "transparent",
  },
  heading: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing[2],
    paddingHorizontal: theme.spacing[1],
  },
  empty: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
    paddingHorizontal: theme.spacing[1],
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  foldBtn: {
    width: 16,
    paddingTop: 1,
  },
  foldIcon: {
    fontSize: 12,
    color: theme.colors.foregroundMuted,
  },
  foldLeaf: {
    width: 16,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    color: theme.colors.foregroundMuted,
    opacity: 0.45,
  },
  rowPress: {
    flex: 1,
    minWidth: 0,
  },
  rowTextRoot: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.foreground,
  },
  rowText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  versionRow: {
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[1],
    borderBottomWidth: RNStyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    gap: 2,
  },
  versionTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundMuted,
  },
  versionPreview: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
}));
