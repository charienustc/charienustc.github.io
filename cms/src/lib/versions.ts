/**
 * Content Version Paths
 *
 * Shared helpers for retaining previous revisions of edited content files
 * (blog posts and moments) under `backups/versions/`. Extracted from
 * `moment-versions.ts` so both content kinds use one containment-checked
 * naming convention; moments keep their own re-export for compatibility.
 */

import path from 'node:path';

import { MOMENT_VERSIONS_DIR } from './paths';

/**
 * Build the timestamp segment for a versioned filename.
 *
 * Local time to the millisecond. Two edits inside the same second must not
 * collide, or the earlier revision would be destroyed by the very mechanism
 * meant to preserve it.
 *
 * @param date - Moment the edit happened
 * @returns A sortable `YYYYMMDD-HHmmssSSS` stamp
 */
export function versionTimestamp(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    pad(date.getMilliseconds(), 3),
  ].join('');
}

/**
 * Resolve where a content file's previous revision should be kept.
 *
 * The version file preserves the content id's directory structure under the
 * versions root and appends the timestamp: `sub/a.md` edited at the given
 * moment lands at `<versionsRoot>/sub/a.md.<stamp>.md`.
 *
 * Returns null when the id would place the file outside the versions root.
 *
 * @param projectRoot - Absolute path to the blog repository
 * @param id - Filename relative to the content directory
 * @param date - Moment the edit happened
 * @returns The absolute destination path, or null when it is not contained
 */
export function contentVersionPath(projectRoot: string, id: string, date: Date): string | null {
  const versionsRoot = path.resolve(projectRoot, MOMENT_VERSIONS_DIR);

  // Backslashes arrive when the client sends a Windows-style id; normalising
  // first means the containment check below sees the real segment structure.
  const normalised = path.normalize(id.replace(/\\/g, '/'));
  const destination = path.resolve(versionsRoot, `${normalised}.${versionTimestamp(date)}.md`);

  const relative = path.relative(versionsRoot, destination);
  // `relative === ''` would mean the destination IS the root, a directory, not
  // a valid file target.
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return destination;
}
