// 场景：源码 textarea DOM 滚动冒烟 — 长文时 scrollHeight > clientHeight。
import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

describe("notes source textarea scroll smoke", () => {
  let dom: JSDOM | undefined;

  afterEach(() => {
    dom?.window.close();
    dom = undefined;
  });

  it("long markdown makes textarea vertically scrollable", () => {
    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      pretendToBeVisual: true,
    });
    const { document } = dom.window;

    const style = document.createElement("style");
    style.textContent = `
      .agnx-notes-source {
        display: flex; height: 200px; width: 400px;
      }
      .agnx-notes-source-input {
        flex: 1; height: 100%; overflow-y: auto; white-space: pre-wrap;
        font-size: 15px; line-height: 1.7; border: 0; resize: none;
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.className = "agnx-notes-source";
    const ta = document.createElement("textarea");
    ta.className = "agnx-notes-source-input";
    ta.value = Array.from({ length: 80 }, (_, i) => `line ${i + 1} — markdown body`).join("\n");
    root.appendChild(ta);
    document.body.appendChild(root);

    // jsdom 不布局；用显式尺寸模拟宿主约束下的可滚条件
    Object.defineProperty(ta, "clientHeight", { value: 200, configurable: true });
    Object.defineProperty(ta, "scrollHeight", {
      value: Math.max(200, ta.value.split("\n").length * 26),
      configurable: true,
    });

    expect(ta.scrollHeight).toBeGreaterThan(ta.clientHeight);
    expect(getComputedStyle(ta).overflowY).toBe("auto");
  });
});

function getComputedStyle(el: Element) {
  // jsdom：从 style 标签粗解析 overflow-y
  const sheet = el.ownerDocument.querySelector("style")?.textContent ?? "";
  const match = sheet.match(/\.agnx-notes-source-input\s*\{([^}]*)\}/);
  const block = match?.[1] ?? "";
  const oy = block.match(/overflow-y:\s*([a-z]+)/)?.[1] ?? "";
  return { overflowY: oy };
}
