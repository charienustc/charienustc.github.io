/**
 * Moment Version Paths
 *
 * Computes where the previous revision of an edited moment is kept.
 *
 * Editing is expected, unlike deletion, so versions accumulate far faster and
 * live in their own directory (`backups/versions/`) rather than sharing the
 * deleted-post bin. Keeping them apart means the deleted bin still reads as
 * "these were removed by mistake" instead of mixing in every routine edit.
 *
 * Like `deleted-posts.ts`, this turns a request-supplied id into a write
 * destination, so containment is re-checked here rather than trusted from the
 * caller.
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
 * Resolve where a moment's previous revision should be kept.
 *
 * Returns null when the id would place the file outside the versions directory.
 *
 * @param projectRoot - Absolute path to the blog repository
 * @param momentId - Filename relative to the moments directory
 * @param date - Moment the edit happened
 * @returns The absolute destination path, or null when it is not contained
 */
export function momentVersionPath(projectRoot: string, momentId: string, date: Date): string | null {
  const versionsRoot = path.resolve(projectRoot, MOMENT_VERSIONS_DIR);

  // Backslashes arrive when the client sends a Windows-style id; normalising
  // first means the containment check below sees the real segment structure.
  const normalised = path.normalize(momentId.replace(/\\/g, '/'));
  const destination = path.resolve(versionsRoot, `${normalised}.${versionTimestamp(date)}.md`);

  const relative = path.relative(versionsRoot, destination);
  // `relative === ''` would mean the destination IS the root, a directory, not
  // a valid file target.
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return destination;
}
