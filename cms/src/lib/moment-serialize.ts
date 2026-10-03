/**
 * Moment Serialization
 *
 * Builds the frontmatter and filename for a new moment, and reads them back.
 * Free of filesystem and HTTP access so the escaping and naming rules can be
 * unit tested directly.
 *
 * Moments are intentionally shape-poor compared with posts: a date, an optional
 * draft flag, optional tags, and a body. There is no title, and adding one here
 * would defeat the point of the feature.
 */

/** Frontmatter fields a moment can carry, as the API accepts them. */
export interface MomentInput {
  /** Body markdown, written verbatim below the frontmatter */
  body: string;
  /** Publication time; defaults to "now" at the call site, not here */
  date: Date;
  /**
   * Last-edit time. Written only when the moment has actually been edited, so
   * a freshly created moment carries no `updated` field at all rather than one
   * duplicating its own `date`.
   */
  updated?: Date;
  /** Hidden from a production build, same convention as posts */
  draft?: boolean;
  /** Optional tags rendered as chips in the feed */
  tags?: string[];
}

/**
 * Quote a scalar for YAML frontmatter.
 *
 * Always quotes: moment tags are free-form user input, and an unquoted value
 * containing `:`, `#`, or a leading `[`/`{` would either change the parsed type
 * or break the document outright. Single quotes are used because the frontmatter
 * is re-serialized on every edit, and a single-quoted string is the one style
 * that survives a round trip without accumulating escapes.
 *
 * @param value - Raw scalar
 * @returns A safely quoted YAML scalar
 */
export function quoteYamlScalar(value: string): string {
  // A single quote is escaped by doubling it, the only escape YAML needs here.
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Format a date the way the content collection expects.
 *
 * Local time, not UTC, and without a timezone suffix: the collection parses a
 * naive string in the site's configured timezone, so emitting a `Z`-suffixed ISO
 * string would shift the moment by the offset.
 *
 * @param date - Moment timestamp
 * @returns `YYYY-MM-DD HH:mm:ss`
 */
export function formatMomentDate(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ');
}

/**
 * Serialize a moment into a complete markdown file.
 *
 * @param input - Moment fields
 * @returns File contents, ending in a newline
 */
export function serializeMoment(input: MomentInput): string {
  const lines: string[] = ['---', `date: ${formatMomentDate(input.date)}`];

  if (input.updated) lines.push(`updated: ${formatMomentDate(input.updated)}`);

  // Only ever written as `true`. A `draft: false` line would be noise that the
  // content collection treats identically to an absent field.
  if (input.draft) lines.push('draft: true');

  if (input.tags && input.tags.length > 0) {
    lines.push('tags:');
    for (const tag of input.tags) lines.push(`  - ${quoteYamlScalar(tag)}`);
  }

  lines.push('---', '', input.body.trim(), '');

  return lines.join('\n');
}

/**
 * Parse the frontmatter of an existing moment file.
 *
 * Only the fields the CMS actually uses are extracted. Deliberately shallow:
 * pulling in a YAML parser here would mean the CMS accepts frontmatter shapes
 * the content collection will later reject, turning a bad edit into a build
 * failure instead of an API error.
 *
 * @param raw - Full file contents
 * @returns The date line and tag list as written, or null when unparseable
 */
export function parseMomentFrontmatter(raw: string): { date: string; updated?: string; draft: boolean; tags: string[] } | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const block = match[1] ?? '';
  const dateLine = block.match(/^date:\s*(.+)$/m);
  if (!dateLine) return null;

  // `updated` must survive an edit round trip, or saving a moment a second time
  // would silently erase the fact that it had ever been edited.
  const updatedLine = block.match(/^updated:\s*(.+)$/m);

  const tags: string[] = [];
  const tagBlock = block.match(/^tags:\s*\n((?:\s*-\s*.+\n?)*)/m);
  if (tagBlock) {
    for (const line of (tagBlock[1] ?? '').split('\n')) {
      const value = line.match(/^\s*-\s*(.+)$/);
      if (!value) continue;
      // Undo the single-quote escaping applied on write.
      const raw = (value[1] ?? '').trim();
      tags.push(raw.startsWith("'") && raw.endsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw);
    }
  }

  return {
    date: unquoteScalar((dateLine[1] ?? '').trim()),
    updated: updatedLine ? unquoteScalar((updatedLine[1] ?? '').trim()) : undefined,
    draft: /^draft:\s*true\s*$/m.test(block),
    tags,
  };
}

/**
 * Strip the quoting applied by `quoteYamlScalar`, if any.
 *
 * @param value - A YAML scalar as written
 * @returns The underlying value
 */
export function unquoteScalar(value: string): string {
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Strip the frontmatter block, returning just the body.
 *
 * @param raw - Full file contents
 * @returns The body, trimmed
 */
export function extractMomentBody(raw: string): string {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return (match ? raw.slice(match[0].length) : raw).trim();
}
