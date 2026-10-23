// 场景：Notes 链接 — Markdown 解析/点击拦截/危险协议；打开走工作区 Browser Tab。
import { Extension, getAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { getNotesHost } from "./notes-host";

const BLOCKED = /^(javascript|data|vbscript|file|about):/i;

/** 相对路径、锚点、mailto、http(s) 允许；危险协议拒绝。 */
export function isNotesLinkHrefAllowed(href: string | null | undefined): boolean {
  if (!href || !href.trim()) {
    return false;
  }
  const raw = href.trim();
  if (BLOCKED.test(raw)) {
    return false;
  }
  if (raw.startsWith("#") || raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) {
    return true;
  }
  if (/^mailto:/i.test(raw) || /^tel:/i.test(raw)) {
    return true;
  }
  if (/^https?:\/\//i.test(raw)) {
    return true;
  }
  // 无协议相对段：notes/foo.md、path/to
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return true;
  }
  return false;
}

export function openNotesLinkHref(href: string): boolean {
  if (!isNotesLinkHrefAllowed(href)) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  const raw = href.trim();
  // 优先工作区 Browser Tab；避免 window.open 弹出系统/内嵌小窗
  const host = getNotesHost();
  if (typeof host?.openBrowserTab === "function" && /^https?:\/\//i.test(raw)) {
    const result = host.openBrowserTab({ initialUrl: raw });
    return Boolean(result?.browserId);
  }
  try {
    window.open(raw, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}

/** 悬停条展示：%E4%B8%AD → 中文。 */
export function formatNotesLinkHrefForDisplay(href: string, maxLen = 40): string {
  let decoded = href;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    decoded = href;
  }
  return decoded.length > maxLen ? `${decoded.slice(0, maxLen)}...` : decoded;
}

/** 链接目标含空格时包 `<>`，避免 markdown-it 丢链。 */
export function normalizeMarkdownLinkTargets(markdown: string): string {
  return markdown.replace(/\[([^\]]*)\]\(([^)\n]+)\)/g, (full, text: string, target: string) => {
    const raw = target.trim();
    if (!raw || raw.startsWith("<")) {
      return full;
    }
    if (/\s/.test(raw)) {
      return `[${text}](<${raw}>)`;
    }
    return full;
  });
}

/**
 * TipTap/markdown-it 序列化常把中文路径写成 %E4%B8%AD；
 * 写回源码/存储时还原为可读中文（空格仍用 <> 包裹）。
 */
export function humanizeMarkdownLinkTargets(markdown: string): string {
  return markdown.replace(
    /\[([^\]]*)\]\((?:<([^>\n]+)>|([^)\n]+))\)/g,
    (full, text: string, angleTarget: string | undefined, bareTarget: string | undefined) => {
      const raw = (angleTarget ?? bareTarget ?? "").trim();
      if (!raw || !/%[0-9A-Fa-f]{2}/.test(raw)) {
        return full;
      }
      let decoded = raw;
      try {
        decoded = decodeURIComponent(raw);
      } catch {
        return full;
      }
      if (/\s/.test(decoded) || angleTarget != null) {
        return `[${text}](<${decoded}>)`;
      }
      return `[${text}](${decoded})`;
    },
  );
}

function findAnchorFromEvent(event: MouseEvent): HTMLAnchorElement | null {
  const target = event.target as HTMLElement | null;
  return (target?.closest?.("a") as HTMLAnchorElement | null) ?? null;
}

/** 左键点链接：只拦截默认导航，不自动打开；打开交给路径条「在浏览器打开」按钮。 */
export function createNotesLinkClickPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey("agnxNotesLinkClick"),
    props: {
      handleClick: (view: EditorView, _pos: number, event: MouseEvent) => {
        if (event.button !== 0) {
          return false;
        }
        const anchor = findAnchorFromEvent(event);
        if (!anchor) {
          return false;
        }
        const attrs = getAttributes(view.state, "link");
        const href = (anchor.getAttribute("href") || attrs.href || "").trim();
        if (!href || !isNotesLinkHrefAllowed(href)) {
          return false;
        }
        event.preventDefault();
        // 不调用 openNotesLinkHref：避免一点击就弹窗/开 Tab
        return true;
      },
    },
  });
}

export function createNotesLinkClickExtension() {
  return Extension.create({
    name: "agnxNotesLinkClick",
    addProseMirrorPlugins() {
      return [createNotesLinkClickPlugin()];
    },
  });
}
