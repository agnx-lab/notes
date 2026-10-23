// 场景：统一粘贴编排 — 图文混贴：抽图落盘（host.files）+ 重组 HTML/Markdown 一次插入。
import type { Editor } from "@tiptap/core";
import {
  importClipboardImageBytes,
  importImageFiles,
  importImageSource,
  toDisplayAndManaged,
} from "./insert-image";
import { looksLikeMarkdown, normalizeMarkdownForPaste } from "./markdown-paste";
import { prepareBlockMarkdownPaste } from "./block-markdown-paste";
import { normalizeImageSrcKey } from "./note-image-model";
import { getNotesHost } from "./notes-host";
import {
  appendMarkdownBlocks,
  buildTrailingImagesMarkdown,
  extractHtmlImageSrcs,
  extractMarkdownImageSrcs,
  extractUriListImageSrcs,
  hasHtmlImages,
  hasMeaningfulText,
  isHostedPasteImageRewrite,
  mergeClipboardSnapshots,
  normalizeClipboardNewlines,
  rewriteHtmlImages,
  rewriteMarkdownImages,
  shouldHandleUnifiedPaste,
  shouldPreferPlainTextBody,
  snapshotClipboardData,
  stripUnusableHtmlImages,
  type NotesClipboardSnapshot,
  type NotesImageRewrite,
} from "./unified-paste-model";

export { shouldHandleUnifiedPaste, snapshotClipboardData };

/** 用宿主主进程剪贴板补齐渲染进程 DataTransfer 丢失的图/HTML。 */
export async function enrichClipboardSnapshot(
  browserSnapshot: NotesClipboardSnapshot,
): Promise<NotesClipboardSnapshot> {
  const host = getNotesHost();
  if (!host?.clipboard?.readPastePayload) {
    return browserSnapshot;
  }
  try {
    const payload = await host.clipboard.readPastePayload();
    // 浏览器已有 File 图时，宿主位图几乎必是同一张的另一编码 → 丢弃避免重复。
    // 无 File 时保留宿主图（含主进程从 HTML file:// 读出的多张备忘录图）。
    const hostImages =
      browserSnapshot.imageFiles.length > 0
        ? []
        : (payload.images ?? [])
            .filter((item) => item?.bytesBase64)
            .slice(0, 8)
            .map((item) => ({
              bytesBase64: item.bytesBase64,
              mimeType: item.mimeType || "image/png",
              fileName: item.fileName,
            }));
    const hostPart: NotesClipboardSnapshot = {
      textPlain: payload.textPlain ?? "",
      textHtml: payload.textHtml ?? "",
      imageFiles: [],
      imageSrcHints: extractUriListImageSrcs(payload.uriList ?? ""),
      clipboardImages: hostImages,
      debugFormats: payload.formats ?? [],
    };
    const merged = mergeClipboardSnapshots(browserSnapshot, hostPart);
    console.info("[agnx.notes] paste enrich", {
      plain: merged.textPlain.length,
      html: merged.textHtml.length,
      files: merged.imageFiles.length,
      hints: merged.imageSrcHints.length,
      hostImages: merged.clipboardImages.length,
      htmlHasImg: hasHtmlImages(merged.textHtml),
      formats: merged.debugFormats?.slice(0, 12),
      htmlHead: merged.textHtml.slice(0, 160).replace(/\s+/g, " "),
    });
    return merged;
  } catch (error) {
    console.warn("[agnx.notes] paste enrich failed", error);
    return browserSnapshot;
  }
}

async function buildRewritesForSrcs(srcs: readonly string[]): Promise<NotesImageRewrite[]> {
  const rewrites: NotesImageRewrite[] = [];
  for (let index = 0; index < srcs.length; index += 1) {
    const from = srcs[index]!;
    try {
      const file = await importImageSource(from, index);
      if (!file) {
        // http(s) 落盘失败时仍保留原 URL，至少富文本能显示，避免混贴只剩字
        if (/^https?:\/\//i.test(from)) {
          console.warn(
            "[agnx.notes] paste image src import failed; keep remote url",
            from.slice(0, 120),
          );
          rewrites.push({
            from,
            managedUri: from,
            displaySrc: from,
            alt: "image",
          });
        } else {
          console.warn("[agnx.notes] paste image src import failed", from.slice(0, 120));
        }
        continue;
      }
      const mapped = await toDisplayAndManaged(file);
      rewrites.push({
        from,
        managedUri: mapped.managedUri,
        displaySrc: mapped.displaySrc,
        alt: mapped.alt,
      });
    } catch (error) {
      if (/^https?:\/\//i.test(from)) {
        rewrites.push({
          from,
          managedUri: from,
          displaySrc: from,
          alt: "image",
        });
      }
      console.warn("[agnx.notes] paste image src error", from.slice(0, 120), error);
    }
  }
  return rewrites;
}

async function buildRewritesForFiles(files: readonly File[]): Promise<NotesImageRewrite[]> {
  if (files.length === 0) {
    return [];
  }
  try {
    const imported = await importImageFiles(files);
    const rewrites: NotesImageRewrite[] = [];
    for (const file of imported) {
      const mapped = await toDisplayAndManaged(file);
      rewrites.push({
        from: file.uri,
        managedUri: mapped.managedUri,
        displaySrc: mapped.displaySrc,
        alt: mapped.alt,
      });
    }
    if (imported.length === 0 && files.length > 0) {
      console.warn("[agnx.notes] paste image files import empty", files.length);
    }
    return rewrites;
  } catch (error) {
    console.warn("[agnx.notes] paste image files error", error);
    return [];
  }
}

function parseMarkdownToHtml(editor: Editor, markdown: string): string | null {
  const parser = (
    editor.storage as {
      markdown?: {
        parser?: { parse: (content: string, options?: { inline?: boolean }) => string };
      };
    }
  ).markdown?.parser;
  if (!parser) {
    return null;
  }
  const text = normalizeMarkdownForPaste(markdown);
  const multiline = text.includes("\n");
  const forceBlock =
    multiline || /(?:^|\n)\s*\|.+\|\s*\n\s*\|?\s*:?-{3,}/.test(text) || /(?:^|\n)\s*```/.test(text);
  const html = parser.parse(text, {
    inline: !forceBlock && text.length < 160,
  });
  return html.trim() ? html : null;
}

function insertHtml(editor: Editor, html: string): boolean {
  try {
    return editor
      .chain()
      .focus()
      .insertContent(html, {
        parseOptions: { preserveWhitespace: "full" },
      })
      .run();
  } catch (error) {
    console.warn("[agnx.notes] insertHtml failed", error);
    return false;
  }
}

/** 纯文本 → 粘贴 HTML：保留空段与行内换行（\\n → br，空行 → 新段落）。 */
function plainTextToPasteHtml(plain: string): string {
  const normalized = normalizeClipboardNewlines(plain).replace(/\u00a0/g, " ");
  if (!normalized.trim()) {
    return "";
  }
  return normalized
    .split(/\n{2,}/)
    .map((para) => {
      const body = para.replace(/^\n+|\n+$/g, "");
      if (!body) {
        return "";
      }
      return `<p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function insertImagesOnly(editor: Editor, rewrites: readonly NotesImageRewrite[]): boolean {
  let ok = false;
  for (const item of rewrites) {
    const inserted = editor
      .chain()
      .focus()
      .setImage({
        src: item.displaySrc,
        alt: item.alt || "image",
        title: item.managedUri,
      })
      .run();
    ok = ok || inserted;
  }
  return ok;
}

function trailingImagesHtml(rewrites: readonly NotesImageRewrite[]): string {
  return rewrites
    .map(
      (item) =>
        `<p><img class="agnx-notes-image" src="${escapeAttr(item.displaySrc)}" title="${escapeAttr(item.managedUri)}" alt="${escapeAttr(item.alt || "image")}" /></p>`,
    )
    .join("");
}

function uniqueSrcs(srcs: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const src of srcs) {
    const cleaned = src.trim();
    if (!cleaned) {
      continue;
    }
    const key = normalizeImageSrcKey(cleaned) || cleaned;
    if (seen.has(key) || seen.has(cleaned)) {
      continue;
    }
    seen.add(key);
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

function isRewriteEmbedded(html: string, item: NotesImageRewrite): boolean {
  return (
    html.includes(item.displaySrc) ||
    html.includes(item.managedUri) ||
    html.includes(escapeAttr(item.displaySrc)) ||
    html.includes(escapeAttr(item.managedUri))
  );
}

/**
 * 富文本统一粘贴：
 * 1) 收集所有图片来源（files + HTML + Markdown + uri-list）并托管
 * 2) 优先 HTML 图文；否则 Markdown；否则 纯文本+图；否则 仅图
 * 3) 改写失败的图改为文末追加，避免“正文在、图丢了”
 */
async function buildRewritesForClipboardImages(
  images: NotesClipboardSnapshot["clipboardImages"],
): Promise<NotesImageRewrite[]> {
  if (!images?.length) {
    return [];
  }
  try {
    // 宿主/主进程读出的图（含 HTML file://）；允许多张，按 bytes 去重在 merge 侧
    const imported = await importClipboardImageBytes(images.slice(0, 8));
    const rewrites: NotesImageRewrite[] = [];
    for (const file of imported) {
      const mapped = await toDisplayAndManaged(file);
      rewrites.push({
        from: file.uri,
        managedUri: mapped.managedUri,
        displaySrc: mapped.displaySrc,
        alt: mapped.alt,
      });
    }
    if (imported.length === 0) {
      console.warn("[agnx.notes] paste clipboardImages import empty", images.length);
    }
    return rewrites;
  } catch (error) {
    console.warn("[agnx.notes] paste clipboardImages error", error);
    return [];
  }
}

function dedupeRewrites(rewrites: readonly NotesImageRewrite[]): NotesImageRewrite[] {
  const out: NotesImageRewrite[] = [];
  const seen = new Set<string>();
  for (const item of rewrites) {
    const key = item.managedUri || item.displaySrc || item.from;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function collectPasteImageRewrites(snapshot: NotesClipboardSnapshot): Promise<{
  fileRewrites: NotesImageRewrite[];
  inlineRewrites: NotesImageRewrite[];
  allImageRewrites: NotesImageRewrite[];
  htmlSrcs: string[];
  mdSrcs: string[];
}> {
  const htmlSrcs = snapshot.textHtml ? extractHtmlImageSrcs(snapshot.textHtml) : [];
  const mdSrcs = hasMeaningfulText(snapshot.textPlain)
    ? extractMarkdownImageSrcs(snapshot.textPlain)
    : [];
  const hintSrcs = snapshot.imageSrcHints ?? [];

  // 浏览器 File 优先；有 File 就不再读宿主位图（enrich 已裁，这里双保险）
  const fileRewrites = await buildRewritesForFiles(snapshot.imageFiles);
  const hostImageRewrites =
    fileRewrites.length > 0
      ? []
      : await buildRewritesForClipboardImages(snapshot.clipboardImages ?? []);

  // 混贴：HTML/MD 内嵌图仍要 import；纯位图粘贴时 htmlSrcs 通常为空
  const inlineRewrites = await buildRewritesForSrcs(
    uniqueSrcs([...htmlSrcs, ...mdSrcs, ...hintSrcs]),
  );

  // 仅当内嵌图已真正托管成功时，才丢宿主位图（防重复）。
  // keep-remote https「伪成功」不得挤掉备忘录经主进程读出的真 PNG。
  const trailingBitmaps = inlineRewrites.some(isHostedPasteImageRewrite) ? [] : hostImageRewrites;
  const combinedFiles = dedupeRewrites([...fileRewrites, ...trailingBitmaps]);
  const allImageRewrites = dedupeRewrites([...inlineRewrites, ...combinedFiles]);

  console.info("[agnx.notes] paste import result", {
    htmlSrcs: htmlSrcs.length,
    mdSrcs: mdSrcs.length,
    files: fileRewrites.length,
    host: hostImageRewrites.length,
    inline: inlineRewrites.length,
    all: allImageRewrites.length,
  });

  return {
    fileRewrites: combinedFiles,
    inlineRewrites,
    allImageRewrites,
    htmlSrcs,
    mdSrcs,
  };
}

function stripAllHtmlImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, "");
}

function tryInsertHtmlWithImages(
  editor: Editor,
  html: string,
  inlineRewrites: readonly NotesImageRewrite[],
  fileRewrites: readonly NotesImageRewrite[],
): boolean {
  let next = rewriteHtmlImages(html, inlineRewrites);
  next = stripUnusableHtmlImages(next);
  const missingInline = inlineRewrites.filter((item) => !isRewriteEmbedded(next, item));
  const trailing = dedupeRewrites([...missingInline, ...fileRewrites]);
  if (trailing.length > 0) {
    next = `${next}${trailingImagesHtml(trailing)}`;
  }
  if (!next.replace(/<[^>]+>/g, "").trim() && trailing.length === 0 && !/<img\b/i.test(next)) {
    return false;
  }
  return insertHtml(editor, next);
}

function tryInsertMarkdownWithImages(
  editor: Editor,
  plain: string,
  inlineRewrites: readonly NotesImageRewrite[],
  fileRewrites: readonly NotesImageRewrite[],
): boolean {
  let markdown = rewriteMarkdownImages(normalizeMarkdownForPaste(plain), inlineRewrites);
  const mdEmbedded = new Set(extractMarkdownImageSrcs(markdown));
  const extraFromHtml = inlineRewrites.filter(
    (item) => !mdEmbedded.has(item.managedUri) && !mdEmbedded.has(item.from),
  );
  if (extraFromHtml.length > 0) {
    markdown = appendMarkdownBlocks(markdown, buildTrailingImagesMarkdown(extraFromHtml));
  }
  if (fileRewrites.length > 0) {
    markdown = appendMarkdownBlocks(markdown, buildTrailingImagesMarkdown(fileRewrites));
  }
  const html = parseMarkdownToHtml(editor, markdown);
  return Boolean(html && insertHtml(editor, html));
}

function tryInsertPlainWithImages(
  editor: Editor,
  plain: string,
  rewrites: readonly NotesImageRewrite[],
): boolean {
  const unique = dedupeRewrites(rewrites);
  const body = plainTextToPasteHtml(plain);
  const textHtml = `${body}${trailingImagesHtml(unique)}`;
  if (body && insertHtml(editor, textHtml)) {
    return true;
  }
  if (body) {
    insertHtml(editor, body);
  }
  return insertImagesOnly(editor, unique);
}

/** 混贴稳妥路径：正文（去原图）+ 托管图各插一次，不依赖脆弱的 inline rewrite。 */
function tryInsertMixedBodyAndImages(
  editor: Editor,
  snapshot: NotesClipboardSnapshot,
  images: readonly NotesImageRewrite[],
): boolean {
  const unique = dedupeRewrites(images);
  if (unique.length === 0) {
    return false;
  }
  const plainUseful = hasMeaningfulText(snapshot.textPlain);
  const html = (snapshot.textHtml || "").trim();
  const preferPlain = shouldPreferPlainTextBody(snapshot.textPlain, html);

  // HTML 若相对纯文本丢了回车（备忘录/Electron 常见），改走纯文本正文
  if (html && !preferPlain) {
    const body = stripAllHtmlImages(html).trim();
    if (body) {
      const next = `${body}${trailingImagesHtml(unique)}`;
      if (insertHtml(editor, next)) {
        return true;
      }
    }
  }

  if (plainUseful) {
    if (
      looksLikeMarkdown(snapshot.textPlain) ||
      extractMarkdownImageSrcs(snapshot.textPlain).length > 0
    ) {
      return tryInsertMarkdownWithImages(editor, snapshot.textPlain, unique, []);
    }
    return tryInsertPlainWithImages(editor, snapshot.textPlain, unique);
  }

  return insertImagesOnly(editor, unique);
}

function tryInsertMarkdownOnly(editor: Editor, plain: string): boolean {
  const html = parseMarkdownToHtml(editor, normalizeMarkdownForPaste(plain));
  return Boolean(html && insertHtml(editor, html));
}

function tryInsertCleanedHtmlFallback(editor: Editor, html: string): boolean {
  const cleaned = stripUnusableHtmlImages(html);
  if (!cleaned.trim()) {
    return false;
  }
  if (!insertHtml(editor, cleaned)) {
    return false;
  }
  console.warn("[agnx.notes] paste images all failed; inserted text-only html");
  return true;
}

function insertTextOnlyRichPaste(
  editor: Editor,
  snapshot: NotesClipboardSnapshot,
  plain: string,
): boolean {
  const plainUseful = hasMeaningfulText(plain);
  const htmlUseful = Boolean((snapshot.textHtml || "").trim());
  const plainIsMarkdown = plainUseful && looksLikeMarkdown(plain);
  const plainHasFences = plainUseful && /(?:^|\n)\s*```/.test(plain);

  if (plainIsMarkdown && editor.isActive("codeBlock") && plainHasFences) {
    prepareBlockMarkdownPaste(editor);
  }

  if (plainIsMarkdown && tryInsertMarkdownOnly(editor, plain)) {
    return true;
  }
  // 带围栏的 MD：解析失败也不吃 clipboard HTML（否则 <pre>/<h2> 会进文档当文本）
  if (plainHasFences) {
    return false;
  }
  const preferPlain = shouldPreferPlainTextBody(plain, snapshot.textHtml || "");
  if (htmlUseful && !preferPlain && tryInsertCleanedHtmlFallback(editor, snapshot.textHtml)) {
    return true;
  }
  if (plainUseful) {
    const body = plainTextToPasteHtml(plain);
    return Boolean(body && insertHtml(editor, body));
  }
  return false;
}

function insertCollectedRichPaste(
  editor: Editor,
  snapshot: NotesClipboardSnapshot,
  payload: {
    fileRewrites: NotesImageRewrite[];
    inlineRewrites: NotesImageRewrite[];
    allImageRewrites: NotesImageRewrite[];
    htmlSrcs: string[];
    mdSrcs: string[];
  },
): boolean {
  const plain = snapshot.textPlain;
  const plainUseful = hasMeaningfulText(plain);
  const plainIsMarkdown = plainUseful && (looksLikeMarkdown(plain) || payload.mdSrcs.length > 0);
  const htmlUseful = Boolean((snapshot.textHtml || "").trim());
  const hasAnyImage = payload.allImageRewrites.length > 0;
  const hasText = plainUseful || htmlUseful;

  // 1) 有图：优先「正文 + 图一次」，避免 HTML rewrite 假成功只剩字、或同图重复
  if (hasAnyImage) {
    if (hasText && tryInsertMixedBodyAndImages(editor, snapshot, payload.allImageRewrites)) {
      return true;
    }
    // 尝试保留 inline 位置的 HTML rewrite（仅当混贴路径失败）
    if (
      htmlUseful &&
      (hasHtmlImages(snapshot.textHtml) || payload.htmlSrcs.length > 0) &&
      tryInsertHtmlWithImages(
        editor,
        snapshot.textHtml,
        payload.inlineRewrites,
        payload.fileRewrites,
      )
    ) {
      return true;
    }
    if (
      plainIsMarkdown &&
      tryInsertMarkdownWithImages(editor, plain, payload.inlineRewrites, payload.fileRewrites)
    ) {
      return true;
    }
    return insertImagesOnly(editor, dedupeRewrites(payload.allImageRewrites));
  }

  // 2) 无图：纯文本/Markdown/HTML
  return insertTextOnlyRichPaste(editor, snapshot, plain);
}

export async function runUnifiedRichPaste(
  editor: Editor,
  snapshot: NotesClipboardSnapshot,
): Promise<boolean> {
  if (editor.isDestroyed || !editor.isEditable) {
    return false;
  }
  const payload = await collectPasteImageRewrites(snapshot);
  return insertCollectedRichPaste(editor, snapshot, payload);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, "&#39;");
}

/**
 * 源码面统一粘贴：产出要插入的 markdown 字符串。
 */
export async function runUnifiedSourcePaste(
  snapshot: NotesClipboardSnapshot,
): Promise<string | null> {
  const fileOnly = await buildRewritesForFiles(snapshot.imageFiles);
  const hostOnly =
    fileOnly.length > 0
      ? []
      : await buildRewritesForClipboardImages(snapshot.clipboardImages ?? []);
  const htmlSrcs = snapshot.textHtml ? extractHtmlImageSrcs(snapshot.textHtml) : [];
  const mdSrcs = hasMeaningfulText(snapshot.textPlain)
    ? extractMarkdownImageSrcs(snapshot.textPlain)
    : [];
  const hintSrcs = snapshot.imageSrcHints ?? [];
  const inlineRewrites = await buildRewritesForSrcs(
    uniqueSrcs([...htmlSrcs, ...mdSrcs, ...hintSrcs]),
  );
  // 内嵌图成功则丢宿主缩略图；统一去重
  const fileRewrites = dedupeRewrites([
    ...fileOnly,
    ...(inlineRewrites.some(isHostedPasteImageRewrite) ? [] : hostOnly),
  ]);

  if (hasMeaningfulText(snapshot.textPlain)) {
    let markdown = snapshot.textPlain;
    const shouldMd =
      looksLikeMarkdown(markdown) ||
      mdSrcs.length > 0 ||
      fileRewrites.length > 0 ||
      inlineRewrites.length > 0;
    if (shouldMd) {
      markdown = normalizeMarkdownForPaste(markdown);
      markdown = rewriteMarkdownImages(markdown, inlineRewrites);
      if (inlineRewrites.length > 0) {
        // 来自 HTML 的图若 md 中没有对应语法，追加
        const embedded = new Set(extractMarkdownImageSrcs(markdown));
        const extras = inlineRewrites.filter(
          (item) => !embedded.has(item.managedUri) && !embedded.has(item.from),
        );
        if (extras.length > 0) {
          markdown = appendMarkdownBlocks(markdown, buildTrailingImagesMarkdown(extras));
        }
      }
      if (fileRewrites.length > 0) {
        markdown = appendMarkdownBlocks(markdown, buildTrailingImagesMarkdown(fileRewrites));
      }
      return markdown;
    }
    // 普通纯文本 + 图
    if (inlineRewrites.length > 0 || fileRewrites.length > 0) {
      return appendMarkdownBlocks(
        markdown,
        buildTrailingImagesMarkdown([...inlineRewrites, ...fileRewrites]),
      );
    }
    return markdown;
  }

  if (inlineRewrites.length > 0 || fileRewrites.length > 0) {
    return buildTrailingImagesMarkdown([...inlineRewrites, ...fileRewrites]);
  }

  return null;
}

/** 兼容：从 ClipboardEvent 直接跑富文本统一粘贴。 */
export async function handleUnifiedRichPasteEvent(
  editor: Editor,
  event: ClipboardEvent,
): Promise<boolean> {
  const snapshot = snapshotClipboardData(event.clipboardData);
  if (!shouldHandleUnifiedPaste(snapshot)) {
    return false;
  }
  return runUnifiedRichPaste(editor, snapshot);
}
