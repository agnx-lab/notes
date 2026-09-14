// 场景：复现多 mermaid fence 粘贴后 codeBlock 数量是否正确。
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { NotesCodeBlock } from "./notes-code-block";
import { JSDOM } from "jsdom";

const SAMPLE = `## 2. 时序图 sequence
\`\`\`mermaid
sequenceDiagram
    participant Client as 客户端
    participant Server as 业务服务
    participant DeepSeekAPI as DeepSeek接口
    Client->>Server: 发送对话请求（带extra_body关闭思考）
    Server->>DeepSeekAPI: POST /chat/completions
    DeepSeekAPI-->>Server: 仅返回content，无reasoning_content
    Server-->>Client: 格式化最终回答
\`\`\`

## 3. 架构图
\`\`\`mermaid
graph TB
    subgraph 前端层
        A[Web智能体页面]
    end
    subgraph 服务层
        B[Agent Runtime]
        C[沙箱管理模块]
    end
    subgraph 存储层
        D[(文件持久化目录)]
        E[(用户权限数据库)]
    end
    A --> B
    B --> C
    C --> D
    C --> E
\`\`\`

## 4. 甘特图 gantt
\`\`\`mermaid
gantt
    title 智能体开发排期
    dateFormat YYYY-MM-DD
    需求设计       :done, des1, 2026-07-01, 3d
    Runtime开发     :active, dev1, after des1, 5d
    沙箱文件权限开发 :dev2, after dev1, 4d
    API对接调试     :test1, after dev2, 3d
\`\`\`

## 5. 饼图 pie
\`\`\`mermaid
pie title 智能体资源消耗占比
    "脚本沙箱运行" : 55
    "大模型推理" : 30
    "文件IO读写" : 10
    "其他后台服务" : 5
\`\`\`

## 6. 状态图
\`\`\`mermaid
stateDiagram-v2
    [*] --> 空闲状态
    空闲状态 --> 任务加载 : 用户下发任务
    任务加载 --> 沙箱运行
    沙箱运行 --> 结果持久化
    结果持久化 --> 释放沙箱
    释放沙箱 --> 空闲状态
\`\`\`

## 7. ER图
\`\`\`mermaid
erDiagram
    USER ||--o{ SCRIPT : "拥有"
    USER {
        string userId PK
        string username
        string permission
    }
    SCRIPT {
        string scriptId PK
        string userId FK
        text content
        date createTime
    }
\`\`\`

## 8. 思维导图 mindmap
\`\`\`mermaid
mindmap
  root((智能体系统))
    运行时Runtime
      生命周期钩子
    沙箱模块
      文件权限映射
\`\`\`

## 9. 类图
\`\`\`mermaid
classDiagram
    class AgentRuntime{
        +init()
        +runTask()
        +loadPlugin()
    }
    class SandBox{
        -string userDir
        +mountDir()
        +release()
    }
    AgentRuntime --> SandBox : 依赖创建
\`\`\`

## 10. gitGraph
\`\`\`mermaid
gitGraph
    commit "初始化项目"
    branch dev
    checkout dev
    commit "开发Runtime基础"
    commit "新增沙箱模块"
    checkout main
    merge dev
    commit "版本v1.0发布"
\`\`\`
`;

function installDom(): HTMLElement {
  const dom = new JSDOM("<!doctype html><html><body><div id='e'></div></body></html>", {
    pretendToBeVisual: true,
  });
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    DocumentFragment: window.DocumentFragment,
    Node: window.Node,
    Element: window.Element,
    innerHeight: 800,
    innerWidth: 1200,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number,
  });
  return window.document.getElementById("e")!;
}

function listCodeBlocks(editor: Editor) {
  const rows: { lang: string; head: string; len: number }[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "codeBlock") {
      rows.push({
        lang: String(node.attrs.language || ""),
        head: node.textContent.slice(0, 28).replace(/\n/g, " "),
        len: node.textContent.length,
      });
    }
  });
  return rows;
}

describe("multi mermaid fence paste", () => {
  it("insertContent(html from markdown parser) keeps each fence", () => {
    const el = installDom();
    const editor = new Editor({
      element: el,
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        NotesCodeBlock,
        Markdown.configure({ html: true, breaks: true, linkify: true }),
      ],
      content: "",
    });
    const parser = (
      editor.storage as {
        markdown?: { parser?: { parse: (c: string, o?: { inline?: boolean }) => string } };
      }
    ).markdown?.parser;
    expect(parser).toBeTruthy();
    const html = parser!.parse(SAMPLE, { inline: false });
    expect((html.match(/<pre>/g) || []).length).toBe(9);
    const ok = editor
      .chain()
      .focus()
      .insertContent(html, { parseOptions: { preserveWhitespace: "full" } })
      .run();
    expect(ok).toBe(true);
    const blocks = listCodeBlocks(editor);
    expect(blocks.length).toBe(9);
    expect(blocks.every((b) => b.lang === "mermaid")).toBe(true);
    expect(blocks[0]?.head.startsWith("sequenceDiagram")).toBe(true);
    expect(blocks[1]?.head.startsWith("graph TB")).toBe(true);
    expect(blocks[2]?.head.startsWith("gantt")).toBe(true);
    // 不应把后续 HTML 吞进某一个 codeBlock
    expect(blocks.some((b) => b.head.includes("</code>") || b.head.includes("<h2"))).toBe(false);

    const mdOut = (
      editor.storage as { markdown?: { getMarkdown?: () => string } }
    ).markdown?.getMarkdown?.();
    expect(mdOut).toBeTruthy();
    expect((mdOut!.match(/```mermaid/g) || []).length).toBe(9);
    expect(/<\/?code|<\/?pre|<h2/.test(mdOut!)).toBe(false);

    editor.destroy();
  });

  it("cursor inside codeBlock + insertContent(html) flattens to text (repro)", () => {
    const el = installDom();
    const editor = new Editor({
      element: el,
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        NotesCodeBlock,
        Markdown.configure({ html: true, breaks: true, linkify: true }),
      ],
      content: "```mermaid\nsequenceDiagram\n  A->>B: hi\n```",
    });
    // 选进代码块内部
    editor.commands.setTextSelection(2);
    expect(editor.isActive("codeBlock")).toBe(true);
    const parser = (
      editor.storage as {
        markdown?: { parser?: { parse: (c: string, o?: { inline?: boolean }) => string } };
      }
    ).markdown?.parser;
    const html = parser!.parse("## X\n\n```mermaid\ngraph TB\n  A-->B\n```\n", { inline: false });
    editor
      .chain()
      .focus()
      .insertContent(html, { parseOptions: { preserveWhitespace: "full" } })
      .run();
    const blocks = listCodeBlocks(editor);
    // 若只剩 1 块且文本含 HTML，即粘贴进代码块被拍扁
    const soup = blocks.some(
      (b) =>
        b.len > 80 && (b.head.includes("<") || (editor.getText().includes("</code>") ?? false)),
    );
    const text = editor.getText();
    console.log("blocks", blocks.length, "soup?", soup, "textHasHtml", /<\/code>|<h2/.test(text));
    editor.destroy();
  });
});
