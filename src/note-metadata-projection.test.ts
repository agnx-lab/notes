// 场景：笔记元数据投影 — 从 markdown/HTML 抽媒体对齐与表格 id/对齐/列宽。
import { describe, expect, it } from "vitest";
import {
  getNoteMetadataProjection,
  noteMetadataProjectionToDetailRows,
} from "./note-metadata-projection";

describe("getNoteMetadataProjection", () => {
  it("投影 id/title/updatedAt 与 HTML 表格/图片 attrs", () => {
    const projection = getNoteMetadataProjection({
      id: "note_1",
      title: "示例",
      updatedAt: 1_700_000_000_000,
      body: [
        `<img class="agnx-notes-image" src="blob:x" title="notes/a.png" data-align="center" />`,
        `<table class="agnx-notes-table" data-table-id="tbl_abc" data-align="right"><tr>`,
        `<th data-colwidth="120" style="width: 120px">A</th>`,
        `<th data-colwidth="80" style="width: 80px">B</th>`,
        `</tr><tr><td>1</td><td>2</td></tr></table>`,
      ].join("\n"),
    });

    expect(projection.id).toBe("note_1");
    expect(projection.title).toBe("示例");
    expect(projection.updatedAt).toBe(1_700_000_000_000);
    expect(projection.media).toEqual([{ kind: "image", align: "center", path: "notes/a.png" }]);
    expect(projection.tables).toEqual([
      { tableId: "tbl_abc", align: "right", colWidths: [120, 80] },
    ]);
  });

  it("detail rows 可读", () => {
    const rows = noteMetadataProjectionToDetailRows(
      getNoteMetadataProjection({
        id: "n",
        title: "T",
        updatedAt: Date.now(),
        body: "",
      }),
    );
    expect(rows.some((row) => row.label === "ID" && row.value === "n")).toBe(true);
    expect(rows.some((row) => row.label === "媒体" && row.value === "（无）")).toBe(true);
    expect(rows.some((row) => row.label === "表格" && row.value === "（无）")).toBe(true);
  });
});
