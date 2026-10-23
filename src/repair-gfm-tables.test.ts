// 场景：破损 GFM 表修复单测（分隔行列数漂移 + 单元格内 |）。
import { describe, expect, it } from "vitest";
import { repairGfmTables } from "./repair-gfm-tables";
import { normalizeMarkdownForPaste } from "./markdown-paste";

const BROKEN = `| 序     | 阶段                           | 目标                                                                              | 是否阻塞子应用化       |
| ------ | ------------------------------ | --------------------------------------------------------------------------------- | ---------------------- | ---------- | -------- | ------- | ---------------------------- | --- |
| **R0** | **T0 宿主止血**                | 单路径 WCV；删业务 webview；切 tab/blank/菜单/DevTools 手测过                     | **是（最高优先）**     |
| **R1** | **引擎与 pane 拆分**           | \`browser-pane.electron\` 拆成 起始页 / 工具栏 / engine adapter；产品层不再直操 IPC | 是                     |
| **R2** | **Host Services 合同**         | \`host.browserView.attach                                                          | setBounds              | setVisible | navigate | capture | clearData\`；能力表进 app-sdk | 是  |
| **R3** | **first-party Browser App 壳** | \`com.agnx.browser\`：UI + Profile/看板迁入 mini-apps；仍可 \`kind: "browser"\`       | 子应用化本体           |
| **R4** | **看板/Profile 产品**          | 原 T5–T9（起始页多任务、Grid/Overview、管理器）在 App 壳内做                      | 否（可与 R3 尾部重叠） |
| **R5** | **可选 kind 收敛**             | \`browser\` → \`mini-app\` 或保留 browser 作系统 kind 别名；Agent 工具统一            | 否                     |`;

describe("repairGfmTables", () => {
  it("repairs separator column drift and merges split cells", () => {
    const fixed = repairGfmTables(BROKEN);
    const lines = fixed.split("\n").filter((l) => l.trim());
    expect(lines[1]).toBe("| --- | --- | --- | --- |");
    const r2 = lines.find((l) => l.includes("R2"));
    expect(r2).toBeTruthy();
    // 内容里的 | 已转义为 \|，按未转义 | 计列
    const pipeCount = [...r2!].filter((ch, i) => ch === "|" && r2![i - 1] !== "\\").length;
    // 行首尾 + 3 个分隔 = 5 个未转义 |
    expect(pipeCount).toBe(5);
    expect(r2).toContain("setBounds");
    expect(r2).toContain("clearData");
    expect(r2).toMatch(/attach\\?\s*\\\|/);
  });
});

describe("normalizeMarkdownForPaste + repair", () => {
  it("produces parseable table markdown for broken paste", () => {
    const next = normalizeMarkdownForPaste(BROKEN);
    expect(next).toContain("| --- | --- | --- | --- |");
    expect(next.split("\n").filter((l) => l.includes("| **R")).length).toBe(6);
  });
});
