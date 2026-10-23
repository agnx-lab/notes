// 场景：笔记顶栏宽屏并排、过窄叠放断点。
import { describe, expect, it } from "vitest";
import {
  NOTES_EDITOR_CHROME_STACK_BELOW,
  resolveNotesEditorChromeLayout,
} from "./editor-chrome-layout";

describe("resolveNotesEditorChromeLayout", () => {
  it("keeps a single row when wide enough", () => {
    expect(resolveNotesEditorChromeLayout(NOTES_EDITOR_CHROME_STACK_BELOW)).toBe("row");
    expect(resolveNotesEditorChromeLayout(900)).toBe("row");
  });

  it("stacks when the pane is narrow (mobile)", () => {
    expect(resolveNotesEditorChromeLayout(NOTES_EDITOR_CHROME_STACK_BELOW - 1)).toBe("stack");
    expect(resolveNotesEditorChromeLayout(360)).toBe("stack");
  });

  it("defaults to row before measurements are ready", () => {
    expect(resolveNotesEditorChromeLayout(0)).toBe("row");
    expect(resolveNotesEditorChromeLayout(Number.NaN)).toBe("row");
  });
});
