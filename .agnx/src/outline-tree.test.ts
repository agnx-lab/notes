// 场景：大纲树嵌套单测。
import { describe, expect, it } from "vitest";
import { buildOutlineTree } from "./outline-tree";
import type { NoteOutlineHeading } from "./note-model";

describe("buildOutlineTree", () => {
  it("nests by heading level", () => {
    const headings: NoteOutlineHeading[] = [
      { level: 1, text: "Root", line: 0, occurrence: 0 },
      { level: 2, text: "A", line: 1, occurrence: 0 },
      { level: 3, text: "A1", line: 2, occurrence: 0 },
      { level: 2, text: "B", line: 3, occurrence: 0 },
    ];
    const tree = buildOutlineTree(headings);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.children).toHaveLength(2);
    expect(tree[0]!.children[0]!.heading.text).toBe("A");
    expect(tree[0]!.children[0]!.children[0]!.heading.text).toBe("A1");
    expect(tree[0]!.children[0]!.children[0]!.depth).toBe(2);
    expect(tree[0]!.children[1]!.heading.text).toBe("B");
  });
});
