// 场景：笔记图片路径判定与 markdown 序列化纯函数（托管路径 vs blob/data）。

export function isEphemeralImageSrc(src: string | null | undefined): boolean {
  const value = (src ?? "").trim();
  return value.startsWith("blob:") || value.startsWith("data:");
}

export function isHttpImageSrc(src: string | null | undefined): boolean {
  const value = (src ?? "").trim().toLowerCase();
  return value.startsWith("http://") || value.startsWith("https://");
}

/** 可作为稳定引用写入 markdown 的路径（本机托管路径 / http(s)）。 */
export function isStableImageSrc(src: string | null | undefined): boolean {
  const value = (src ?? "").trim();
  if (!value || isEphemeralImageSrc(value)) {
    return false;
  }
  return true;
}

/**
 * 从 image 节点 attrs 取应落盘到 markdown 的稳定 URI。
 * 优先 title（插入时写入托管路径），否则非临时 src。
 */
export function resolveImageManagedUri(attrs: {
  src?: string | null;
  title?: string | null;
}): string | null {
  const title = (attrs.title ?? "").trim();
  if (title && isStableImageSrc(title)) {
    return title;
  }
  const src = (attrs.src ?? "").trim();
  if (src && isStableImageSrc(src)) {
    return src;
  }
  return null;
}

export function escapeMarkdownImageAlt(alt: string): string {
  return alt.replace(/[[\]]/g, "\\$&");
}

export function escapeMarkdownImageSrc(src: string): string {
  return src.replace(/[()]/g, "\\$&");
}

export function escapeNotesImageHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildImageMarkdown(alt: string, managedUri: string): string {
  return `![${escapeMarkdownImageAlt(alt || "")}](${escapeMarkdownImageSrc(managedUri)})`;
}

export function extensionFromImageMime(mimeType: string | null | undefined): string {
  const normalized = (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  switch (normalized) {
    case "image/png":
      return ".png";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/bmp":
      return ".bmp";
    case "image/avif":
      return ".avif";
    case "image/svg+xml":
      return ".svg";
    case "image/tiff":
      return ".tiff";
    default:
      return ".png";
  }
}

export function fileNameForPastedImage(mimeType: string | null | undefined, index = 0): string {
  const ext = extensionFromImageMime(mimeType);
  const stamp = Date.now().toString(36);
  return `paste-image-${stamp}-${index}${ext}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return bytesToBase64(bytes);
}

const IMAGE_FILE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|avif|svg|tiff?|heic|heif)$/i;

export function looksLikeImageFileName(name: string | null | undefined): boolean {
  return IMAGE_FILE_EXT_RE.test(name ?? "");
}

export function isImageFileLike(file: File | null | undefined): boolean {
  if (!file) {
    return false;
  }
  const type = (file.type || "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (type.startsWith("image/")) {
    return true;
  }
  // 某些系统粘贴图片 type 为空 / octet-stream，只靠扩展名
  if ((!type || type === "application/octet-stream") && looksLikeImageFileName(file.name)) {
    return true;
  }
  // 剪贴板截图偶发无名无 type，但 size>0 且 kind 已由收集端筛过
  if (!type && !file.name && file.size > 0) {
    return true;
  }
  return false;
}

/** 解码 HTML 属性里常见实体，避免 &amp; 导致 import/rewrite 对不上。 */
export function decodeHtmlEntities(value: string): string {
  const raw = value ?? "";
  if (!raw || !/[&][#A-Za-z0-9]+;/.test(raw)) {
    return raw;
  }
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(
        `<!doctype html><body><textarea>${raw}</textarea>`,
        "text/html",
      );
      const text = doc.querySelector("textarea")?.value;
      if (typeof text === "string") {
        return text;
      }
    } catch {
      // fall through
    }
  }
  return raw
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = Number.parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

/** 统一图片 src 匹配键：去空白、解实体、补协议相对路径。 */
export function normalizeImageSrcKey(src: string | null | undefined): string {
  let value = decodeHtmlEntities((src ?? "").trim());
  if (!value) {
    return "";
  }
  if (value.startsWith("//")) {
    value = `https:${value}`;
  }
  // file URL 统一成 path，减少 file:/// vs / 不一致
  const local = normalizeLocalImagePath(value);
  if (local) {
    return local;
  }
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      url.hash = "";
      return url.toString();
    }
  } catch {
    // ignore
  }
  return value;
}

export function guessMimeFromFileName(name: string | null | undefined): string {
  const lower = (name ?? "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  return "image/png";
}

/**
 * file:// 或绝对路径 → 本地文件系统路径；否则 null。
 * 例：file:///Users/a/x.png → /Users/a/x.png
 */
export function normalizeLocalImagePath(src: string | null | undefined): string | null {
  const raw = (src ?? "").trim();
  if (!raw) {
    return null;
  }
  if (/^file:/i.test(raw)) {
    try {
      // 用 URL 解析，兼容 file://localhost/Users/... 与 file:///Users/...
      const url = new URL(raw);
      let pathname = decodeURIComponent(url.pathname || "");
      // Windows: /C:/Users → C:/Users
      if (/^\/[A-Za-z]:\//.test(pathname)) {
        pathname = pathname.slice(1);
      }
      return pathname || null;
    } catch {
      const stripped = raw.replace(/^file:\/\//i, "");
      if (stripped.startsWith("localhost/")) {
        return `/${stripped.slice("localhost/".length)}`;
      }
      return stripped.startsWith("/") ? stripped : `/${stripped}`;
    }
  }
  if (raw.startsWith("/") || /^[A-Za-z]:[\\/]/.test(raw)) {
    return raw;
  }
  return null;
}

/** 是否已是 apps/data/<appId>/files 下托管路径。 */
export function isAppsDataFilesPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return /\/apps\/data\/[^/]+\/files\//i.test(normalized);
}

/** 从剪贴板 / DataTransfer 收集图片 File（files + items，兼容空 MIME）。 */
export function collectImageFilesFromDataTransfer(data: DataTransfer | null | undefined): File[] {
  if (!data) {
    return [];
  }
  const out: File[] = [];
  const seen = new Set<string>();
  const push = (file: File | null | undefined) => {
    if (!isImageFileLike(file) || !file) {
      return;
    }
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(file);
  };

  for (const file of Array.from(data.files ?? [])) {
    push(file);
  }
  for (const item of Array.from(data.items ?? [])) {
    // 不限制 kind===file：部分环境 image/* 的 kind 异常
    if (item.type.startsWith("image/") || item.kind === "file") {
      const file = item.getAsFile();
      if (file) {
        push(file);
      }
    }
  }
  return out;
}
