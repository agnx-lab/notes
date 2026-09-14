// 场景：笔记领域模型与纯函数（大纲 / 字数 / 版本），供 store 与编辑器共用。
export interface NoteVersion {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

export interface DemoNote {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  versions: NoteVersion[];
}

export interface NoteOutlineHeading {
  level: 1 | 2 | 3;
  text: string;
  /** 0-based 行号（markdown 源） */
  line: number;
  /** 同 level+text 在大纲中的第几次出现（0-based） */
  occurrence: number;
}

export const MAX_NOTE_VERSIONS = 30;
export const AUTOSAVE_DEBOUNCE_MS = 700;
export const VERSION_MIN_INTERVAL_MS = 60_000;

export function createNoteId(prefix = "note"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createVersionId(): string {
  return createNoteId("ver");
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  const cjk = trimmed.match(/[\u4e00-\u9fff]/g)?.join("").length ?? 0;
  const latin = trimmed
    .replace(/[\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + latin;
}

export function countChars(text: string): number {
  return [...text.replace(/\s+/g, "")].length;
}

/** 从 markdown 抽 H1–H3 大纲。 */
export function extractOutline(markdown: string): NoteOutlineHeading[] {
  const lines = markdown.split(/\r?\n/);
  const out: NoteOutlineHeading[] = [];
  const occurrenceByKey = new Map<string, number>();
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(lines[i] ?? "");
    if (!match) {
      continue;
    }
    const level = match[1]!.length as 1 | 2 | 3;
    const text = match[2]!.trim();
    if (!text) {
      continue;
    }
    const key = `${level}:${text}`;
    const occurrence = occurrenceByKey.get(key) ?? 0;
    occurrenceByKey.set(key, occurrence + 1);
    out.push({ level, text, line: i, occurrence });
  }
  return out;
}

/** 从 markdown 抽首个一级标题文本，用作笔记标题。 */
export function extractTitleFromMarkdown(markdown: string): string {
  const firstH1 = extractOutline(markdown).find((heading) => heading.level === 1);
  const text = firstH1?.text.trim();
  return text || "未命名笔记";
}

export function noteToMarkdownDocument(note: Pick<DemoNote, "title" | "body">): string {
  const body = note.body.trim();
  if (body) {
    const hasH1 = extractOutline(body).some((heading) => heading.level === 1);
    if (hasH1) {
      return body.endsWith("\n") ? body : `${body}\n`;
    }
    const title = note.title.trim() || "未命名笔记";
    return `# ${title}\n\n${body}\n`;
  }
  const title = note.title.trim() || "未命名笔记";
  return `# ${title}\n`;
}

export function shouldSnapshotVersion(params: {
  previous: Pick<DemoNote, "title" | "body" | "versions" | "updatedAt">;
  nextTitle: string;
  nextBody: string;
  now?: number;
}): boolean {
  const now = params.now ?? Date.now();
  if (params.previous.title === params.nextTitle && params.previous.body === params.nextBody) {
    return false;
  }
  const latest = params.previous.versions[0];
  if (
    latest &&
    latest.title === params.previous.title &&
    latest.body === params.previous.body &&
    now - latest.createdAt < VERSION_MIN_INTERVAL_MS
  ) {
    return false;
  }
  // 有实质内容才快照
  return Boolean(params.previous.title.trim() || params.previous.body.trim());
}

export function pushVersion(note: DemoNote, now = Date.now()): DemoNote["versions"] {
  const version: NoteVersion = {
    id: createVersionId(),
    title: note.title,
    body: note.body,
    createdAt: now,
  };
  return [version, ...note.versions].slice(0, MAX_NOTE_VERSIONS);
}

/** 恢复前是否需要把当前稿再存一条：内容已等于目标、或已在版本列表里 → 不存。 */
export function shouldSnapshotBeforeRestore(params: {
  current: Pick<DemoNote, "title" | "body" | "versions">;
  target: Pick<NoteVersion, "title" | "body">;
}): boolean {
  if (params.current.title === params.target.title && params.current.body === params.target.body) {
    return false;
  }
  if (!params.current.title.trim() && !params.current.body.trim()) {
    return false;
  }
  return !params.current.versions.some(
    (item) => item.title === params.current.title && item.body === params.current.body,
  );
}
