// 场景：Mermaid NodeView 与选中态浮层 chrome；SVG 栅格化 PNG 后写入系统图片剪贴板（禁止落到 SVG 文本）。
import type { NotesMermaidBlockThemeId } from "./notes-mermaid-theme";

export type NotesMermaidMode = "preview" | "source";

export interface NotesMermaidUiHandle {
  getMode: () => NotesMermaidMode;
  setMode: (mode: NotesMermaidMode) => void;
  rerender: () => void;
  getSvgElement: () => SVGSVGElement | null;
  getStatus: () => string;
  /** 单图主题：inherit 跟随全局。 */
  getBlockTheme: () => NotesMermaidBlockThemeId;
  setBlockTheme: (theme: NotesMermaidBlockThemeId) => void;
}

export const NOTES_MERMAID_UI_HANDLE_KEY = "__agnxNotesMermaidUi";

export function readNotesMermaidUiHandle(dom: Element | null): NotesMermaidUiHandle | null {
  if (!(dom instanceof HTMLElement)) {
    return null;
  }
  const handle = (dom as HTMLElement & { [NOTES_MERMAID_UI_HANDLE_KEY]?: NotesMermaidUiHandle })[
    NOTES_MERMAID_UI_HANDLE_KEY
  ];
  return handle ?? null;
}

function ensureSvgXmlns(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  return clone;
}

function readSvgSize(svg: SVGSVGElement): { width: number; height: number } {
  const attrW = Number.parseFloat(svg.getAttribute("width") || "");
  const attrH = Number.parseFloat(svg.getAttribute("height") || "");
  if (Number.isFinite(attrW) && attrW > 0 && Number.isFinite(attrH) && attrH > 0) {
    return { width: Math.ceil(attrW), height: Math.ceil(attrH) };
  }
  const viewBox = svg
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox && viewBox.length === 4 && viewBox[2]! > 0 && viewBox[3]! > 0) {
    return { width: Math.ceil(viewBox[2]!), height: Math.ceil(viewBox[3]!) };
  }
  const rect = svg.getBoundingClientRect();
  return {
    width: Math.max(1, Math.ceil(rect.width || 640)),
    height: Math.max(1, Math.ceil(rect.height || 360)),
  };
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "sync";
    const onLoad = () => {
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
      resolve(image);
    };
    const onError = () => {
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
      reject(new Error("svg image load failed"));
    };
    image.addEventListener("load", onLoad);
    image.addEventListener("error", onError);
    image.src = url;
  });
}

/** 将 SVG 栅格化为 PNG（dataURL + Blob）。 */
export async function mermaidSvgToPng(
  svg: SVGSVGElement,
): Promise<{ blob: Blob; dataUrl: string } | null> {
  if (typeof document === "undefined") {
    return null;
  }
  const clone = ensureSvgXmlns(svg);
  const { width, height } = readSvgSize(svg);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  // 白底，避免透明 PNG 在深色页看不清
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);

  const payload = new XMLSerializer().serializeToString(clone);
  const dataUrlSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(payload)}`;

  try {
    const image = await loadImageFromUrl(dataUrlSvg);
    const canvas = document.createElement("canvas");
    const scale = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/png");
    });
    if (!blob) {
      // toBlob 失败时用 dataURL 反解
      const response = await fetch(dataUrl);
      const fromData = await response.blob();
      return { blob: fromData, dataUrl };
    }
    return { blob, dataUrl };
  } catch {
    return null;
  }
}

export async function mermaidSvgToPngBlob(svg: SVGSVGElement): Promise<Blob | null> {
  const result = await mermaidSvgToPng(svg);
  return result?.blob ?? null;
}

async function writePngToSystemClipboard(png: { blob: Blob; dataUrl: string }): Promise<boolean> {
  // Electron：走主进程 nativeImage，保证是「真实图片」而非 SVG 文本
  try {
    const desktop = (
      typeof window !== "undefined"
        ? (
            window as Window & {
              agnxDesktop?: {
                android?: {
                  writeScreenshotToClipboard?: (
                    dataUrl: string,
                  ) => Promise<{ ok?: boolean } | unknown>;
                };
              };
            }
          ).agnxDesktop
        : undefined
    )?.android?.writeScreenshotToClipboard;
    if (typeof desktop === "function") {
      const result = await desktop(png.dataUrl);
      if (result && typeof result === "object" && "ok" in result && result.ok === true) {
        return true;
      }
    }
  } catch {
    // fall through
  }

  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return false;
  }

  const type = png.blob.type || "image/png";
  try {
    // Chromium 更稳：ClipboardItem 值用 Promise<Blob>
    await navigator.clipboard.write([
      new ClipboardItem({
        [type]: Promise.resolve(png.blob),
      } as Record<string, Promise<Blob>>),
    ]);
    return true;
  } catch {
    // ignore
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ [type]: png.blob })]);
    return true;
  } catch {
    return false;
  }
}

export async function downloadMermaidSvg(
  svg: SVGSVGElement,
  fileName = "mermaid.png",
): Promise<boolean> {
  const png = await mermaidSvgToPng(svg);
  if (!png) {
    return false;
  }
  const url = URL.createObjectURL(png.blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 只复制真实 PNG 图片；失败返回 false，绝不写入 SVG 源码文本。 */
export async function copyMermaidSvg(svg: SVGSVGElement): Promise<boolean> {
  const png = await mermaidSvgToPng(svg);
  if (!png) {
    return false;
  }
  return writePngToSystemClipboard(png);
}
