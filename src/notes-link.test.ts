// 场景：链接安全与打开合同单测。
import { describe, expect, it, vi, afterEach } from "vitest";
import { bindNotesHostApi } from "./notes-host";
import {
  formatNotesLinkHrefForDisplay,
  humanizeMarkdownLinkTargets,
  isNotesLinkHrefAllowed,
  normalizeMarkdownLinkTargets,
  openNotesLinkHref,
} from "./notes-link";

describe("isNotesLinkHrefAllowed", () => {
  it("allows http(s), relative, mailto", () => {
    expect(isNotesLinkHrefAllowed("https://example.com")).toBe(true);
    expect(isNotesLinkHrefAllowed("http://example.com")).toBe(true);
    expect(isNotesLinkHrefAllowed("../foo.md")).toBe(true);
    expect(isNotesLinkHrefAllowed("./a/b")).toBe(true);
    expect(isNotesLinkHrefAllowed("/abs/path")).toBe(true);
    expect(isNotesLinkHrefAllowed("#anchor")).toBe(true);
    expect(isNotesLinkHrefAllowed("mailto:a@b.c")).toBe(true);
    expect(isNotesLinkHrefAllowed("docs/guide.md")).toBe(true);
  });

  it("blocks dangerous protocols", () => {
    expect(isNotesLinkHrefAllowed("javascript:alert(1)")).toBe(false);
    expect(isNotesLinkHrefAllowed("data:text/html,x")).toBe(false);
    expect(isNotesLinkHrefAllowed("vbscript:x")).toBe(false);
    expect(isNotesLinkHrefAllowed("file:///etc/passwd")).toBe(false);
    expect(isNotesLinkHrefAllowed("")).toBe(false);
    expect(isNotesLinkHrefAllowed(null)).toBe(false);
  });
});

describe("openNotesLinkHref", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    bindNotesHostApi(null);
  });

  it("无 host 时回退 window.open", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    bindNotesHostApi(null);
    expect(openNotesLinkHref("https://example.com/x")).toBe(true);
    expect(open).toHaveBeenCalledWith("https://example.com/x", "_blank", "noopener,noreferrer");
  });

  it("有 openBrowserTab 时开工作区 Browser Tab，不 window.open", () => {
    const open = vi.fn();
    const openBrowserTab = vi.fn(() => ({ browserId: "b1", opened: true }));
    vi.stubGlobal("window", { open });
    bindNotesHostApi({ openBrowserTab } as never);
    expect(openNotesLinkHref("https://example.com/y")).toBe(true);
    expect(openBrowserTab).toHaveBeenCalledWith({ initialUrl: "https://example.com/y" });
    expect(open).not.toHaveBeenCalled();
  });

  it("refuses javascript:", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    expect(openNotesLinkHref("javascript:alert(1)")).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});

describe("formatNotesLinkHrefForDisplay", () => {
  it("decodes percent-encoded Chinese for hover chip", () => {
    expect(
      formatNotesLinkHrefForDisplay("data-model/Tab%E6%95%B0%E6%8D%AE%E6%A8%A1%E5%9E%8B_x.md"),
    ).toContain("Tab数据模型");
  });
});

describe("link edit input uses decoded Chinese", () => {
  it("decodeURIComponent matches display helper", () => {
    const encoded = "constitutions/%E5%B7%A5%E4%BD%9C%E5%8C%BA%E6%A0%87%E7%AD%BE_workspace-tab.md";
    expect(decodeURIComponent(encoded)).toContain("工作区标签");
    expect(formatNotesLinkHrefForDisplay(encoded, 200)).toBe(decodeURIComponent(encoded));
  });
});

describe("normalizeMarkdownLinkTargets", () => {
  it("wraps spaced targets so markdown-it keeps the link", () => {
    expect(normalizeMarkdownLinkTargets("[a](path/with space/文件.md)")).toBe(
      "[a](<path/with space/文件.md>)",
    );
  });
});

describe("humanizeMarkdownLinkTargets", () => {
  it("decodes percent-encoded Chinese in link targets", () => {
    const encoded = encodeURIComponent("工作区标签.md");
    const input = `[说明](docs/${encoded})`;
    expect(humanizeMarkdownLinkTargets(input)).toBe("[说明](docs/工作区标签.md)");
  });

  it("keeps angle brackets when decoded path has spaces", () => {
    const encoded = encodeURIComponent("a b/文件.md");
    expect(humanizeMarkdownLinkTargets(`[t](<${encoded}>)`)).toBe("[t](<a b/文件.md>)");
  });
});
