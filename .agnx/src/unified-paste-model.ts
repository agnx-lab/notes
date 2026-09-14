// 场景：统一粘贴纯函数 — 剪贴板快照、HTML/MD 抽图、路径改写判定。
import {
  collectImageFilesFromDataTransfer,
  decodeHtmlEntities,
  isAppsDataFilesPath,
  looksLikeImageFileName,
  normalizeImageSrcKey,
  normalizeLocalImagePath,
} from "./note-image-model";
import { looksLikeMarkdown } from "./markdown-paste";

export interface NotesClipboardImageBytes {
  bytesBase64: string;
  mimeType: string;
  fileName?: string;
}

export interface NotesClipboardSnapshot {
  textPlain: string;
  textHtml: string;
  imageFiles: File[];
  /** text/uri-list 等额外图片路径/URL，补 files/html 漏网 */
  imageSrcHints: string[];
  /** 宿主主进程剪贴板位图（Electron），DataTransfer 常缺失 */
  clipboardImages: NotesClipboardImageBytes[];
  /** 诊断用 formats */
  debugFormats?: string[];
}

export interface NotesImageRewrite {
  /** 原 src（html/md 中的引用） */
  from: string;
  /** markdown / title 用托管路径 */
  managedUri: string;
  /** 富文本展示用 */
  displaySrc: string;
  alt?: string;
}

const MAX_INLINE_IMAGES = 24;

function pushUniqueSrc(found: string[], raw: string | null | undefined): void {
  const decoded = decodeHtmlEntities((raw ?? "").trim());
  if (!decoded || decoded.startsWith("cid:") || decoded.startsWith("about:")) {
    return;
  }
  // 协议相对
  const src = decoded.startsWith("//") ? `https:${decoded}` : decoded;
  if (!src) {
    return;
  }
  const key = normalizeImageSrcKey(src);
  if (found.some((item) => normalizeImageSrcKey(item) === key || item === src)) {
    return;
  }
  found.push(src);
}

/** 从 text/uri-list 抽 file/http 图片地址。 */
export function extractUriListImageSrcs(uriList: string): string[] {
  if (!uriList) {
    return [];
  }
  const found: string[] = [];
  for (const line of uriList.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    if (/^https?:\/\//i.test(trimmed) || /^file:/i.test(trimmed)) {
      // 仅收图片扩展名，或 file://（剪贴板临时图常无扩展名）
      if (
        /^file:/i.test(trimmed) ||
        looksLikeImageFileName(trimmed) ||
        /\.(png|jpe?g|gif|webp|bmp|avif|svg|tiff?)(?:$|\?)/i.test(trimmed)
      ) {
        pushUniqueSrc(found, trimmed);
      }
    } else {
      const local = normalizeLocalImagePath(trimmed);
      if (local && looksLikeImageFileName(local)) {
        pushUniqueSrc(found, local);
      }
    }
    if (found.length >= MAX_INLINE_IMAGES) {
      break;
    }
  }
  return found;
}

export function snapshotClipboardData(
  data: DataTransfer | null | undefined,
): NotesClipboardSnapshot {
  const uriList = data?.getData("text/uri-list") ?? "";
  return {
    textPlain: data?.getData("text/plain") ?? "",
    textHtml: data?.getData("text/html") ?? "",
    imageFiles: collectImageFilesFromDataTransfer(data),
    imageSrcHints: extractUriListImageSrcs(uriList),
    clipboardImages: [],
    debugFormats: [],
  };
}

/** 合并两段文本，优先含图；纯文本时优先保留更多换行。 */
export function preferRicherText(a: string, b: string): string {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  if (!left) return b ?? "";
  if (!right) return a ?? "";
  const leftHasImg = hasHtmlImages(left) || /!\[[^\]]*]\(/.test(left);
  const rightHasImg = hasHtmlImages(right) || /!\[[^\]]*]\(/.test(right);
  if (rightHasImg && !leftHasImg) return b;
  if (leftHasImg && !rightHasImg) return a;
  if (!leftHasImg && !rightHasImg) {
    const leftBreaks = countExplicitLineBreaks(left);
    const rightBreaks = countExplicitLineBreaks(right);
    if (rightBreaks !== leftBreaks) {
      const lengthDelta = Math.abs(left.length - right.length);
      const longer = Math.max(left.length, right.length);
      // 长度接近时，换行更多的一侧更像真实正文（备忘录 HTML 常更长但丢 \\n）
      if (longer === 0 || lengthDelta / longer <= 0.35) {
        return rightBreaks > leftBreaks ? b : a;
      }
    }
  }
  return right.length > left.length ? b : a;
}

export function mergeClipboardSnapshots(
  base: NotesClipboardSnapshot,
  extra: Partial<NotesClipboardSnapshot>,
): NotesClipboardSnapshot {
  const imageFiles = [...base.imageFiles];
  for (const file of extra.imageFiles ?? []) {
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    if (
      !imageFiles.some(
        (item) => `${item.name}:${item.size}:${item.type}:${item.lastModified}` === key,
      )
    ) {
      imageFiles.push(file);
    }
  }
  const imageSrcHints = [...base.imageSrcHints];
  for (const src of extra.imageSrcHints ?? []) {
    if (!imageSrcHints.includes(src)) imageSrcHints.push(src);
  }
  const clipboardImages = [...base.clipboardImages];
  for (const img of extra.clipboardImages ?? []) {
    if (!img.bytesBase64) continue;
    if (!clipboardImages.some((item) => item.bytesBase64 === img.bytesBase64)) {
      clipboardImages.push(img);
    }
  }
  return {
    textPlain: preferRicherText(base.textPlain, extra.textPlain ?? ""),
    textHtml: preferRicherText(base.textHtml, extra.textHtml ?? ""),
    imageFiles,
    imageSrcHints,
    clipboardImages,
    debugFormats: [...(base.debugFormats ?? []), ...(extra.debugFormats ?? [])],
  };
}

export function hasMeaningfulText(text: string): boolean {
  return text.replace(/\u00a0/g, " ").trim().length > 0;
}

/** 统一剪贴板换行：\\r\\n / \\r → \\n。 */
export function normalizeClipboardNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function countExplicitLineBreaks(text: string): number {
  return (normalizeClipboardNewlines(text).match(/\n/g) ?? []).length;
}

/**
 * 把 HTML 粗略还原成带换行的纯文本，用来判断 Electron/备忘录 RTF→HTML 是否丢行。
 */
export function approximatePlainFromHtml(html: string): string {
  if (!html) {
    return "";
  }
  let next = normalizeClipboardNewlines(html)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|h[1-6]|li|tr|blockquote|pre)\s*>/gi, "\n")
    .replace(/<\s*(p|div|h[1-6]|li|tr|blockquote|pre)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  next = decodeHtmlEntities(next).replace(/\u00a0/g, " ");
  return next.replace(/\n{3,}/g, "\n\n").trim();
}

function countNonEmptyLines(text: string): number {
  return normalizeClipboardNewlines(text)
    .split("\n")
    .filter((line) => line.replace(/\u00a0/g, " ").trim().length > 0).length;
}

/**
 * HTML 相对纯文本明显丢换行时，改用纯文本作正文。
 * 备忘录/微信等常：text/plain 有 \\n，text/html 被压成单段。
 * 列表/表格等结构 HTML 仍信 HTML。
 */
export function shouldPreferPlainTextBody(plain: string, html: string): boolean {
  if (!hasMeaningfulText(plain)) {
    return false;
  }
  if (!html.trim()) {
    return true;
  }
  if (looksLikeStructuredHtml(html)) {
    return false;
  }
  const plainNorm = normalizeClipboardNewlines(plain).trim();
  const plainLines = countNonEmptyLines(plainNorm);
  if (plainLines < 2) {
    return false;
  }
  const fromHtml = approximatePlainFromHtml(html);
  const htmlLines = countNonEmptyLines(fromHtml);
  // 典型：纯文本多行，HTML 只剩一整段
  if (htmlLines <= 1) {
    return true;
  }
  const plainBreaks = countExplicitLineBreaks(plainNorm);
  const htmlBreaks = countExplicitLineBreaks(fromHtml);
  return plainLines > htmlLines && plainBreaks >= htmlBreaks * 2;
}

export function hasHtmlImages(html: string): boolean {
  if (!html) {
    return false;
  }
  return (
    /<img\b/i.test(html) ||
    /background-image\s*:\s*url\(/i.test(html) ||
    /file:\/\//i.test(html) ||
    /data:image\//i.test(html) ||
    /v:imagedata\b/i.test(html)
  );
}

export function hasMarkdownImages(markdown: string): boolean {
  return /!\[[^\]]*]\(\s*[^)\s]+/.test(markdown);
}

/** 粗判 HTML 是否带结构（列表/表格/标题），用于决定是否接管粘贴。 */
export function looksLikeStructuredHtml(html: string): boolean {
  const sample = html.slice(0, 20_000).toLowerCase();
  if (!sample.trim()) {
    return false;
  }
  return (
    /<(ul|ol|li|table|thead|tbody|tr|td|th|h[1-6]|pre|blockquote|hr)\b/.test(sample) ||
    /<\/(ul|ol|table|h[1-6]|pre|blockquote)>/.test(sample)
  );
}

/**
 * 是否应由统一粘贴管线接管（否则交给 TipTap/CM 默认）。
 * - 有图片文件
 * - HTML 含图或图文结构 + 图
 * - Markdown 文本（含表格列表等）
 * - Markdown/HTML 含图片引用
 */
export function shouldHandleUnifiedPaste(snapshot: NotesClipboardSnapshot): boolean {
  if (snapshot.imageFiles.length > 0) {
    return true;
  }
  if ((snapshot.clipboardImages?.length ?? 0) > 0) {
    return true;
  }
  if (snapshot.imageSrcHints.length > 0) {
    return true;
  }
  if (snapshot.textHtml) {
    if (hasHtmlImages(snapshot.textHtml)) {
      return true;
    }
    // 纯结构 HTML 仍交给 TipTap 默认，避免误伤 Word 样式清洗；图文才接管。
  }
  if (hasMeaningfulText(snapshot.textPlain)) {
    if (looksLikeMarkdown(snapshot.textPlain) || hasMarkdownImages(snapshot.textPlain)) {
      return true;
    }
  }
  return false;
}

/** 从 srcset 取第一个 URL。 */
export function firstSrcFromSrcset(srcset: string): string | null {
  const part = srcset.split(",")[0]?.trim() ?? "";
  if (!part) {
    return null;
  }
  const url = part.split(/\s+/)[0]?.trim() ?? "";
  return url || null;
}

function extractAttrValue(tag: string, attr: string): string | null {
  const quoted = new RegExp(`\\b${attr}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag);
  if (quoted) {
    return quoted[2] ?? null;
  }
  const unquoted = new RegExp(`\\b${attr}\\s*=\\s*([^\\s>]+)`, "i").exec(tag);
  return unquoted?.[1] ?? null;
}

/** 从 HTML 提取图片 URL（src / data-src / srcset / file 路径，保序去重）。 */
export function extractHtmlImageSrcs(html: string): string[] {
  if (!html) {
    return [];
  }
  const found: string[] = [];

  // 整段 img 标签，兼容换行与无引号属性
  const imgTagRe = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgTagRe.exec(html)) != null) {
    const tag = match[0] ?? "";
    pushUniqueSrc(found, extractAttrValue(tag, "src"));
    pushUniqueSrc(found, extractAttrValue(tag, "data-src"));
    pushUniqueSrc(found, extractAttrValue(tag, "data-original"));
    pushUniqueSrc(found, extractAttrValue(tag, "data-lazy-src"));
    pushUniqueSrc(found, firstSrcFromSrcset(extractAttrValue(tag, "srcset") || ""));
    if (found.length >= MAX_INLINE_IMAGES) {
      return found;
    }
  }

  // Word VML
  const vmlRe = /<v:imagedata\b[^>]*>/gi;
  while ((match = vmlRe.exec(html)) != null) {
    pushUniqueSrc(found, extractAttrValue(match[0] ?? "", "src"));
    if (found.length >= MAX_INLINE_IMAGES) {
      return found;
    }
  }

  // background-image: url(...)
  const bgRe = /background-image\s*:\s*url\((["']?)(.*?)\1\)/gi;
  while ((match = bgRe.exec(html)) != null) {
    pushUniqueSrc(found, match[2]);
    if (found.length >= MAX_INLINE_IMAGES) {
      return found;
    }
  }
  // 裸 file:// 出现在 HTML 中
  const fileRe = /file:\/\/[^\s"'<>]+/gi;
  while ((match = fileRe.exec(html)) != null) {
    pushUniqueSrc(found, match[0]);
    if (found.length >= MAX_INLINE_IMAGES) {
      return found;
    }
  }

  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      for (const img of Array.from(doc.querySelectorAll("img"))) {
        pushUniqueSrc(found, img.getAttribute("src"));
        pushUniqueSrc(found, img.getAttribute("data-src"));
        pushUniqueSrc(found, img.getAttribute("data-original"));
        pushUniqueSrc(found, firstSrcFromSrcset(img.getAttribute("srcset") || ""));
        if (found.length >= MAX_INLINE_IMAGES) {
          break;
        }
      }
    } catch {
      // ignore
    }
  }
  return found.slice(0, MAX_INLINE_IMAGES);
}

/** 提取 markdown 图片 URL。 */
export function extractMarkdownImageSrcs(markdown: string): string[] {
  const found: string[] = [];
  const re = /!\[[^\]]*]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) != null) {
    pushUniqueSrc(found, match[1]);
    if (found.length >= MAX_INLINE_IMAGES) {
      break;
    }
  }
  return found;
}

export function parseDataImageUrl(
  dataUrl: string,
): { mimeType: string; bytesBase64: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+)(;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(
    dataUrl.trim(),
  );
  if (!match) {
    return null;
  }
  const mimeType = match[1]!.toLowerCase();
  const isBase64 = Boolean(match[3]);
  const payload = match[4] ?? "";
  if (!isBase64) {
    // 非 base64 data URL：转 base64
    try {
      const decoded = decodeURIComponent(payload);
      const bytes = new TextEncoder().encode(decoded);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCodePoint(bytes[i]!);
      }
      return { mimeType, bytesBase64: btoa(binary) };
    } catch {
      return null;
    }
  }
  return { mimeType, bytesBase64: payload.replace(/\s+/g, "") };
}

function findRewrite(
  byKey: Map<string, NotesImageRewrite>,
  src: string,
): NotesImageRewrite | undefined {
  const direct = byKey.get(src);
  if (direct) {
    return direct;
  }
  return byKey.get(normalizeImageSrcKey(src));
}

function buildRewriteLookup(
  rewrites: readonly NotesImageRewrite[],
): Map<string, NotesImageRewrite> {
  const byKey = new Map<string, NotesImageRewrite>();
  for (const item of rewrites) {
    byKey.set(item.from, item);
    byKey.set(normalizeImageSrcKey(item.from), item);
    const local = normalizeLocalImagePath(item.from);
    if (local) {
      byKey.set(local, item);
      byKey.set(normalizeImageSrcKey(local), item);
    }
  }
  return byKey;
}

function applyRewriteToImgTag(tag: string, rewrite: NotesImageRewrite): string {
  const quoteMatch = /\bsrc\s*=\s*(["'])/i.exec(tag);
  const quote = quoteMatch?.[1] ?? '"';
  let next = tag;
  if (/\bsrc\s*=\s*(["']).*?\1/i.test(next)) {
    next = next.replace(/\bsrc\s*=\s*(["']).*?\1/i, `src=${quote}${rewrite.displaySrc}${quote}`);
  } else if (/\bsrc\s*=\s*[^\s>]+/i.test(next)) {
    next = next.replace(/\bsrc\s*=\s*[^\s>]+/i, `src=${quote}${rewrite.displaySrc}${quote}`);
  } else {
    next = next.replace(/<img\b/i, `<img src=${quote}${rewrite.displaySrc}${quote}`);
  }

  if (/\btitle\s*=\s*(["']).*?\1/i.test(next)) {
    next = next.replace(
      /\btitle\s*=\s*(["']).*?\1/i,
      `title=${quote}${rewrite.managedUri}${quote}`,
    );
  } else if (/\btitle\s*=\s*[^\s>]+/i.test(next)) {
    next = next.replace(/\btitle\s*=\s*[^\s>]+/i, `title=${quote}${rewrite.managedUri}${quote}`);
  } else {
    next = next.replace(/<img\b/i, `<img title=${quote}${rewrite.managedUri}${quote}`);
  }

  if (rewrite.alt && !/\balt\s*=/i.test(next)) {
    next = next.replace(/<img\b/i, `<img alt=${quote}${rewrite.alt}${quote}`);
  }
  if (!/\bclass\s*=\s*(["']).*?agnx-notes-image/i.test(next)) {
    if (/\bclass\s*=\s*(["'])(.*?)\1/i.test(next)) {
      next = next.replace(/\bclass\s*=\s*(["'])(.*?)\1/i, (_m, q, cls) => {
        const merged = `${cls} agnx-notes-image`.trim();
        return `class=${q}${merged}${q}`;
      });
    } else {
      next = next.replace(/<img\b/i, `<img class=${quote}agnx-notes-image${quote}`);
    }
  }
  return next;
}

/**
 * 改写 HTML 中的 img：src→display，title→managed，补 class。
 * 优先 DOMParser，失败再走标签正则；匹配键做实体/路径归一。
 */
export function rewriteHtmlImages(html: string, rewrites: readonly NotesImageRewrite[]): string {
  if (!html || rewrites.length === 0) {
    return html;
  }
  const byKey = buildRewriteLookup(rewrites);

  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      let changed = false;
      for (const img of Array.from(doc.querySelectorAll("img"))) {
        const src = img.getAttribute("src") || "";
        const rewrite =
          findRewrite(byKey, src) ||
          findRewrite(byKey, img.getAttribute("data-src") || "") ||
          findRewrite(byKey, img.getAttribute("data-original") || "");
        if (!rewrite) {
          continue;
        }
        img.setAttribute("src", rewrite.displaySrc);
        img.setAttribute("title", rewrite.managedUri);
        if (rewrite.alt && !img.getAttribute("alt")) {
          img.setAttribute("alt", rewrite.alt);
        }
        const cls = img.getAttribute("class") || "";
        if (!cls.includes("agnx-notes-image")) {
          img.setAttribute("class", `${cls} agnx-notes-image`.trim());
        }
        changed = true;
      }
      if (changed) {
        return doc.body.innerHTML;
      }
    } catch {
      // fall through
    }
  }

  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src =
      extractAttrValue(tag, "src") ||
      extractAttrValue(tag, "data-src") ||
      extractAttrValue(tag, "data-original") ||
      "";
    const rewrite = findRewrite(byKey, src);
    if (!rewrite) {
      return tag;
    }
    return applyRewriteToImgTag(tag, rewrite);
  });
}

/**
 * 去掉仍无法展示的本地/临时图（import 失败后的 file://、空 src），避免“只剩文字却看似成功”。
 * 保留 http(s) 与已改写的 blob/data/托管路径。
 */
export function stripUnusableHtmlImages(html: string): string {
  if (!html) {
    return html;
  }
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = (extractAttrValue(tag, "src") || "").trim();
    if (!src) {
      return "";
    }
    // 已托管路径可经 resolveObjectUrl 显示，不要剥掉
    if (isAppsDataFilesPath(src)) {
      return tag;
    }
    if (/^file:/i.test(src) || normalizeLocalImagePath(src)) {
      // 未改写成功的本机临时路径在渲染进程通常不可见
      return "";
    }
    if (/^webkit-fake-url:/i.test(src)) {
      return "";
    }
    // blob: 可能是本页刚 resolve 的展示地址，保留
    return tag;
  });
}

/** 把 markdown 图片 URL 换成托管路径。 */
export function rewriteMarkdownImages(
  markdown: string,
  rewrites: readonly NotesImageRewrite[],
): string {
  if (!markdown || rewrites.length === 0) {
    return markdown;
  }
  const byKey = buildRewriteLookup(rewrites);
  return markdown.replace(
    /!\[([^\]]*)]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g,
    (full, alt: string, src: string) => {
      const rewrite = findRewrite(byKey, src.trim());
      if (!rewrite) {
        return full;
      }
      const nextAlt = alt || rewrite.alt || "";
      return `![${nextAlt}](${rewrite.managedUri})`;
    },
  );
}

export function buildTrailingImagesMarkdown(rewrites: readonly NotesImageRewrite[]): string {
  return rewrites.map((item) => `![${item.alt || "image"}](${item.managedUri})`).join("\n\n");
}

/**
 * 是否已真正托管（apps/data 或 blob/data 展示址）。
 * keep-remote 的 https 不算：不能据此丢掉宿主位图。
 */
export function isHostedPasteImageRewrite(item: NotesImageRewrite): boolean {
  const managed = (item.managedUri || "").trim();
  const display = (item.displaySrc || "").trim();
  if (isAppsDataFilesPath(managed) || isAppsDataFilesPath(display)) {
    return true;
  }
  if (display.startsWith("blob:") || display.startsWith("data:image/")) {
    return true;
  }
  if (managed.startsWith("blob:") || managed.startsWith("data:image/")) {
    return true;
  }
  return false;
}

export function appendMarkdownBlocks(base: string, extra: string): string {
  const left = base.replace(/\s+$/g, "");
  const right = extra.replace(/^\s+/g, "");
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return `${left}\n\n${right}`;
}
