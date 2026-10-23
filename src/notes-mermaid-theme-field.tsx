// 场景：Cmd+I 详情卡 — Mermaid 全局主题下拉（host.ui.Select field 风）。
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { Text } from "react-native";
import type { WorkspaceAppSelectProps } from "@agnx-lab/app-sdk";
import { getNotesHost } from "./notes-host";
import {
  getCachedNotesMermaidTheme,
  NOTES_MERMAID_THEME_OPTIONS,
  saveNotesMermaidTheme,
  subscribeNotesMermaidTheme,
  type NotesMermaidThemeId,
} from "./notes-mermaid-theme";

export function NotesMermaidThemeDetailField() {
  const [selected, setSelected] = useState<NotesMermaidThemeId>(getCachedNotesMermaidTheme);

  useEffect(() => subscribeNotesMermaidTheme(() => setSelected(getCachedNotesMermaidTheme())), []);

  const host = getNotesHost();
  const Select = host?.ui?.Select as ComponentType<WorkspaceAppSelectProps> | undefined;

  const options = useMemo(
    () => NOTES_MERMAID_THEME_OPTIONS.map((option) => ({ id: option.id, label: option.label })),
    [],
  );

  const handleSelect = useCallback((id: string) => {
    const next = id as NotesMermaidThemeId;
    setSelected(next);
    const boundHost = getNotesHost();
    if (!boundHost) {
      return;
    }
    void saveNotesMermaidTheme(boundHost, next);
  }, []);

  if (!Select) {
    return createElement(
      Text,
      { style: { fontSize: 12 }, testID: "notes-mermaid-theme-field" },
      "（需重启 Electron 以加载 host.ui.Select）",
    );
  }

  return createElement(Select, {
    value: selected,
    options,
    onSelect: handleSelect,
    testID: "notes-mermaid-theme-trigger",
    accessibilityLabel: "Mermaid 主题",
  });
}
