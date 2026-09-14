// 场景：Mermaid 主题 id 解析与标签。
import { describe, expect, it } from "vitest";
import {
  notesMermaidThemeLabel,
  parseNotesMermaidFenceLanguage,
  parseNotesMermaidThemeId,
  resolveMermaidInitializeTheme,
  resolveMermaidPreviewSurface,
  resolveMermaidThemeConfig,
  resolveNotesMermaidBlockTheme,
} from "./notes-mermaid-theme";

describe("notes-mermaid-theme", () => {
  it("parseNotesMermaidThemeId 校验合法值", () => {
    expect(parseNotesMermaidThemeId("dark")).toBe("dark");
    expect(parseNotesMermaidThemeId("forest")).toBe("forest");
    expect(parseNotesMermaidThemeId("blue")).toBe("blue");
    expect(parseNotesMermaidThemeId("nope")).toBe("default");
  });

  it("resolveMermaidThemeConfig 蓝色用 base + 变量", () => {
    const blue = resolveMermaidThemeConfig("blue");
    expect(blue.theme).toBe("base");
    expect(blue.themeVariables?.primaryColor).toBe("#dbeafe");
  });

  it("resolveMermaidInitializeTheme 非 auto 原样返回", () => {
    expect(resolveMermaidInitializeTheme("neutral")).toBe("neutral");
    expect(resolveMermaidInitializeTheme("default")).toBe("default");
    expect(resolveMermaidInitializeTheme("blue")).toBe("base");
  });

  it("notesMermaidThemeLabel", () => {
    expect(notesMermaidThemeLabel("default")).toBe("亮色");
    expect(notesMermaidThemeLabel("auto")).toBe("自动");
    expect(notesMermaidThemeLabel("blue")).toBe("蓝色");
  });

  it("parseNotesMermaidFenceLanguage 解析 theme= 覆盖", () => {
    expect(parseNotesMermaidFenceLanguage("mermaid")).toEqual({
      isMermaid: true,
      theme: null,
    });
    expect(parseNotesMermaidFenceLanguage("mermaid theme=dark")).toEqual({
      isMermaid: true,
      theme: "dark",
    });
    expect(parseNotesMermaidFenceLanguage("javascript")).toEqual({
      isMermaid: false,
      theme: null,
    });
  });

  it("resolveNotesMermaidBlockTheme inherit 回退全局", () => {
    expect(resolveNotesMermaidBlockTheme("inherit", "forest")).toBe("forest");
    expect(resolveNotesMermaidBlockTheme("dark", "forest")).toBe("dark");
    expect(resolveNotesMermaidBlockTheme(null, "neutral")).toBe("neutral");
  });

  it("resolveMermaidPreviewSurface 亮/暗主题配底", () => {
    expect(resolveMermaidPreviewSurface("default").scheme).toBe("light");
    expect(resolveMermaidPreviewSurface("blue").scheme).toBe("light");
    expect(resolveMermaidPreviewSurface("dark").scheme).toBe("dark");
    expect(resolveMermaidPreviewSurface("dark").background).toBe("#0f172a");
    expect(resolveMermaidPreviewSurface("default").background).toBe("#ffffff");
  });
});
