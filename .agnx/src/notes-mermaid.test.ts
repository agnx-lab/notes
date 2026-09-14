// 场景：slash 菜单含 Mermaid；模板常量可用；粗检 looksLikeMermaidSource。
import { describe, expect, it } from "vitest";
import { filterSlashCommands, SLASH_COMMANDS } from "./slash-commands";
import { NOTES_MERMAID_TEMPLATE, looksLikeMermaidSource } from "./notes-mermaid-template";

describe("slash mermaid", () => {
  it("目录含 mermaid 项", () => {
    const item = SLASH_COMMANDS.find((row) => row.id === "mermaid");
    expect(item?.title).toContain("Mermaid");
    expect(filterSlashCommands("mermaid").some((row) => row.id === "mermaid")).toBe(true);
  });

  it("模板为 flowchart", () => {
    expect(NOTES_MERMAID_TEMPLATE).toContain("flowchart");
    expect(NOTES_MERMAID_TEMPLATE).toContain("开始");
  });

  it("looksLikeMermaidSource 识别常见图类型", () => {
    expect(looksLikeMermaidSource("flowchart TD\n  A-->B")).toBe(true);
    expect(looksLikeMermaidSource("sequenceDiagram\n  A->>B: hi")).toBe(true);
    expect(looksLikeMermaidSource("console.log(1)")).toBe(false);
  });
});
