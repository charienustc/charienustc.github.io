/**
 * Deleted-Post Retention Paths
 *
 * Computes where a deleted post is moved to. Kept free of filesystem access so
 * the naming and containment rules can be tested directly, without creating
 * files on disk.
 *
 * The layout preserves the post's own directory structure and appends a
 * timestamp, so deleting the same path twice keeps both copies rather than
 * letting the second overwrite the first:
 *
 *   src/content/blog/life/poem.md
 *     -> backups/deleted/life/poem.md.20261003-150037123.deleted
 *
 * The `.deleted` suffix matters for two reasons: it keeps the original `.md`
 * visible so a restore tool can tell what the file was, while making it
 * unmistakable on disk that this is not a live post.
 */

import path from 'node:path';

import { DELETED_POST_SUFFIX, DELETED_POSTS_DIR } from './paths';

/**
 * Build the timestamp segment used in a retained filename.
 *
 * Local time, to the millisecond: two deletions in the same second must not
 * collide, or one would overwrite the other and the point of retaining both
 * would be lost.
 *
 * @param date - Moment the deletion happened
 * @returns A sortable `YYYYMMDD-HHmmssSSS` stamp
 */
export function deletionTimestamp(date: Date): string {
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
 * Resolve where a post should be retained, given the project root.
 *
 * Returns null when the post path would escape the retention directory. That is
 * the load-bearing check: this function turns a value derived from a request
 * into a write destination, so a postId containing traversal segments must not
 * be able to place a file outside `backups/deleted/`.
 *
 * @param projectRoot - Absolute path to the blog repository
 * @param postId - Post path relative to the content directory, e.g. `life/poem.md`
 * @param date - Moment the deletion happened
 * @returns The absolute destination path, or null when it is not contained
 */
export function retentionPath(projectRoot: string, postId: string, date: Date): string | null {
  const retentionRoot = path.resolve(projectRoot, DELETED_POSTS_DIR);

  // Normalise the post id as a relative path so the joined result can be
  // compared against the root. Backslashes arrive when the client sends a
  // Windows-style id, and path.join would otherwise treat them as literal
  // characters in a single segment on POSIX.
  const normalised = path.normalize(postId.replace(/\\/g, '/'));
  const destination = path.resolve(retentionRoot, `${normalised}.${deletionTimestamp(date)}${DELETED_POST_SUFFIX}`);

  const relative = path.relative(retentionRoot, destination);
  // `relative === ''` would mean the destination IS the root, which is a
  // directory and not a valid file target.
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return destination;
}
