// 场景：修复「列数不一致 / 单元格内 | 被拆列」导致 markdown-it 整表不认的 GFM 表。
/**
 * 把连续 `|` 行块重写为列数一致的 GFM 表。
 * 典型坏例：分隔行多出幽灵列；单元格内 `a | b` 被拆成多列。
 */
export function repairGfmTables(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!isTableRowLine(line)) {
      out.push(line);
      i += 1;
      continue;
    }
    const blockStart = i;
    const block: string[] = [];
    while (i < lines.length && isTableRowLine(lines[i] ?? "")) {
      block.push(lines[i] ?? "");
      i += 1;
    }
    if (block.length < 2) {
      out.push(...block);
      continue;
    }
    const repaired = repairTableBlock(block);
    if (repaired) {
      if (out.length > 0 && (out[out.length - 1] ?? "").trim() !== "") {
        out.push("");
      }
      out.push(...repaired);
    } else {
      out.push(...lines.slice(blockStart, i));
    }
  }
  return out.join("\n");
}

function isTableRowLine(line: string): boolean {
  const t = line.trim();
  return t.includes("|") && (t.startsWith("|") || t.endsWith("|") || countUnescapedPipes(t) >= 2);
}

function countUnescapedPipes(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "|" && text[i - 1] !== "\\") {
      count += 1;
    }
  }
  return count;
}

function isSeparatorRow(cells: string[]): boolean {
  if (cells.length === 0) {
    return false;
  }
  return cells.every((cell) => {
    const n = cell.trim().replace(/[─–—﹣－]/g, "-");
    return /^:?-{2,}:?$/.test(n);
  });
}

/** 按未转义 `|` 分列。 */
export function splitRowCells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) {
    t = t.slice(1);
  }
  if (t.endsWith("|") && !t.endsWith("\\|")) {
    t = t.slice(0, -1);
  }
  const cells: string[] = [];
  let buf = "";
  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i]!;
    if (ch === "\\" && t[i + 1] === "|") {
      buf += "|";
      i += 1;
      continue;
    }
    if (ch === "|") {
      cells.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  cells.push(buf.trim());
  return cells;
}

function escapeCellPipes(cell: string): string {
  return cell.replace(/\|/g, "\\|");
}

function formatRow(cells: string[]): string {
  return `| ${cells.map((c) => escapeCellPipes(c.trim())).join(" | ")} |`;
}

function normalizeCellCount(cells: string[], columns: number): string[] {
  if (columns <= 0) {
    return cells;
  }
  if (cells.length === columns) {
    return cells.map((c) => c.trim());
  }
  if (cells.length < columns) {
    const next = cells.map((c) => c.trim());
    while (next.length < columns) {
      next.push("");
    }
    return next;
  }
  if (columns === 1) {
    return [cells.join(" | ").trim()];
  }
  const head = cells.slice(0, columns - 1).map((c) => c.trim());
  const mid = cells.slice(columns - 1, -1).map((c) => c.trim());
  const last = (cells[cells.length - 1] ?? "").trim();
  const merged = [head[columns - 2], ...mid].filter((part) => part.length > 0).join(" | ");
  head[columns - 2] = merged;
  return [...head, last];
}

function repairTableBlock(block: string[]): string[] | null {
  const rows = block.map(splitRowCells);
  if (rows.length < 2 || !rows[0] || rows[0].length < 2) {
    return null;
  }

  let header = rows[0]!;
  let bodyStart = 1;
  if (rows[1] && isSeparatorRow(rows[1])) {
    bodyStart = 2;
  }

  const columns = header.length;
  header = normalizeCellCount(header, columns);

  const out: string[] = [formatRow(header)];
  out.push(formatRow(Array.from({ length: columns }, () => "---")));

  for (let r = bodyStart; r < rows.length; r += 1) {
    const raw = rows[r];
    if (!raw) {
      continue;
    }
    if (isSeparatorRow(raw)) {
      continue;
    }
    out.push(formatRow(normalizeCellCount(raw, columns)));
  }
  return out;
}
