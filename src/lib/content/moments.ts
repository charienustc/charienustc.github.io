/**
 * Moments Content Helpers
 *
 * Pure functions for the moments ("碎碎念") short-form feed. Kept free of Astro
 * and filesystem access so the sorting, grouping, and naming rules can be unit
 * tested directly.
 *
 * Moments deliberately have no title: the body *is* the content. That is what
 * separates a moment from a post, and it is also why moments cannot live in the
 * `blog` collection, whose schema requires a title.
 */

/** Frontmatter shape of a moment, as authored by hand or through the CMS. */
export interface MomentFrontmatter {
  /** Publication time, newest-first in the feed */
  date: Date;
  /** Hidden in a production build, same convention as posts */
  draft?: boolean;
  /** Optional free-form tags rendered as chips */
  tags?: string[];
}

/** A minimal record of one moment, independent of the content collection. */
export interface MomentRecord {
  id: string;
  data: MomentFrontmatter;
}

/**
 * Build the filename for a new moment.
 *
 * The date prefix is what makes a plain directory listing sort chronologically,
 * which matters because nothing else in the file orders it. The trailing slug
 * is only there so the file is recognisable to a human browsing the directory —
 * it carries no routing meaning, since moments have no per-item URL.
 *
 * @param date - Moment the moment was written
 * @param slug - Optional human-readable hint appended after the timestamp
 * @returns A filename like `2026-10-03-141500-hello.md`
 */
export function momentFileName(date: Date, slug?: string): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  // Dashes between the date parts, not just before the time: `2026-10-03-141500`
  // is far easier to scan in a directory listing than `20261003-141500`, and it
  // still sorts identically because the widths are fixed.
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

  return slug ? `${stamp}-${slug}.md` : `${stamp}.md`;
}

/**
 * Derive a filename hint from the opening words of a moment.
 *
 * Best-effort by design: Chinese text has no word boundaries, so this keeps the
 * leading characters rather than pretending to extract a "title". Returns an
 * empty string when nothing usable is found, and callers fall back to a
 * timestamp-only filename.
 *
 * @param body - The moment's markdown body
 * @param maxLength - Maximum characters to keep
 * @returns A slug containing only lowercase ASCII alphanumerics and hyphens
 */
export function momentSlugHint(body: string, maxLength = 24): string {
  const firstLine = body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return '';

  // Strip markdown syntax that would produce noise in a filename.
  const plain = firstLine
    .replace(/^#+\s*/, '')
    .replace(/[*_`~[\]]/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();

  const slug = plain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Truncate on a hyphen boundary, not mid-word: a slice can leave a dangling
  // separator, which would produce `...-mome-` and then `...-mome` once trimmed,
  // wasting the last character of the budget.
  if (slug.length <= maxLength) return slug;
  const truncated = slug.slice(0, maxLength);
  const lastSeparator = truncated.lastIndexOf('-');
  return (lastSeparator > 0 ? truncated.slice(0, lastSeparator) : truncated).replace(/-+$/, '');
}

/**
 * Filter and order moments for display.
 *
 * Mirrors the post convention: drafts are visible in development so they can be
 * previewed, and hidden from a production build. Sorting is newest-first, with
 * the id used as a tiebreaker so two moments written in the same second still
 * come out in a stable, reproducible order.
 *
 * @param moments - Candidate moments
 * @param isProduction - Whether to drop drafts
 * @returns A new array, newest first
 */
export function selectVisibleMoments<T extends MomentRecord>(moments: T[], isProduction: boolean): T[] {
  return moments
    .filter((moment) => (isProduction ? moment.data.draft !== true : true))
    .toSorted((a, b) => {
      const delta = b.data.date.getTime() - a.data.date.getTime();
      return delta !== 0 ? delta : b.id.localeCompare(a.id);
    });
}

/**
 * Group moments by calendar year, newest year first.
 *
 * The year comes from each moment's own date, so a moment is grouped by when it
 * was written rather than by when the site was built.
 *
 * @param moments - Moments in any order
 * @returns Year groups, descending by year, each newest-first
 */
export function groupMomentsByYear<T extends MomentRecord>(moments: T[]): Array<{ year: number; moments: T[] }> {
  const byYear = new Map<number, T[]>();
  for (const moment of moments) {
    const year = moment.data.date.getFullYear();
    const bucket = byYear.get(year);
    if (bucket) bucket.push(moment);
    else byYear.set(year, [moment]);
  }

  return [...byYear.entries()].sort(([a], [b]) => b - a).map(([year, items]) => ({ year, moments: items }));
}

/**
 * Count the moments that would be published.
 *
 * @param moments - Candidate moments
 * @param isProduction - Whether drafts are excluded
 * @returns Number of moments that survive the draft filter
 */
export function countVisibleMoments(moments: MomentRecord[], isProduction: boolean): number {
  return selectVisibleMoments(moments, isProduction).length;
}
