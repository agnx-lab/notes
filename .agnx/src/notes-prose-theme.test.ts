// 场景：Notes Markdown 主题 id 解析、专属包 token 与标签。
import { describe, expect, it } from "vitest";
import {
  notesMarkdownThemeLabel,
  parseNotesMarkdownThemeId,
  resolveNotesChromeColors,
  resolveNotesMarkdownTokens,
} from "./notes-prose-theme";

describe("notes-markdown-theme", () => {
  it("parseNotesMarkdownThemeId 校验合法值并兼容 auto→inherit", () => {
    expect(parseNotesMarkdownThemeId("inherit")).toBe("inherit");
    expect(parseNotesMarkdownThemeId("auto")).toBe("inherit");
    expect(parseNotesMarkdownThemeId("github")).toBe("github");
    expect(parseNotesMarkdownThemeId("nope")).toBe("inherit");
  });

  it("专属包带面板底，跟随全局为透明；亮色包可读", () => {
    expect(resolveNotesMarkdownTokens("inherit").panelBg).toBe("transparent");
    expect(resolveNotesMarkdownTokens("notion").panelBg).toBe("#ffffff");
    expect(resolveNotesMarkdownTokens("paper").panelBg).toBe("#fbfaf7");
    expect(resolveNotesMarkdownTokens("sepia").fg).toBe("#2f241c");
    expect(resolveNotesMarkdownTokens("sepia").panelBg).toBe("#ebe4d6");
    expect(resolveNotesMarkdownTokens("github").panelBg).toBe("#0d1117");
    expect(resolveNotesMarkdownTokens("notion").fg).toBe("#37352f");
  });

  it("notesMarkdownThemeLabel", () => {
    expect(notesMarkdownThemeLabel("inherit")).toBe("跟随全局");
    expect(notesMarkdownThemeLabel("paper")).toBe("纸白");
    expect(notesMarkdownThemeLabel("sepia")).toBe("羊皮纸");
    expect(notesMarkdownThemeLabel("notion")).toBe("Notion");
  });

  it("亮色专属包 chrome 用深色 muted，避免白底看不见按钮", () => {
    const shell = {
      foregroundMuted: "#c8c8c8",
      accent: "#3b82f6",
      border: "#333",
      surface2: "#222",
    };
    const notion = resolveNotesChromeColors("notion", shell);
    expect(notion.mutedColor).toBe("#787774");
    expect(notion.accentColor).toBe("#337ea9");
    const inherit = resolveNotesChromeColors("inherit", shell);
    expect(inherit.mutedColor).toBe("#c8c8c8");
  });
});
