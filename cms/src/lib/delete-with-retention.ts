/**
 * Delete With Retention
 *
 * Shared body of the post and moment delete handlers. Both collections delete
 * the same way — validate, then move into `backups/deleted/` rather than unlink
 * — so the logic lives here once instead of being copied per collection.
 *
 * The ordering below is deliberate and load-bearing: the source is bounded
 * first, then the destination, and only then is anything moved. `retentionPath`
 * independently re-checks containment because it turns a request-supplied id
 * into a write destination; without that, "can delete a file" would escalate to
 * "can write anywhere".
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { retentionPath } from '@/lib/deleted-posts';
import { hasValidMarkdownExtension, isPathSafe } from '@/lib/validation';

/** Outcome of a delete attempt, mapped to a response by the caller. */
export type DeleteOutcome = { ok: true; retainedPath: string } | { ok: false; status: 400 | 404; error: string };

/**
 * Validate an id and move the file into the retention directory.
 *
 * @param options.projectRoot - Absolute path to the blog repository
 * @param options.contentDir - Directory the id is relative to
 * @param options.id - File id relative to `contentDir`
 * @param options.now - Deletion timestamp, injected for testability
 * @returns Where the file went, or the reason it was refused
 */
export async function deleteWithRetention(options: {
  projectRoot: string;
  contentDir: string;
  id: string;
  now: Date;
}): Promise<DeleteOutcome> {
  const { projectRoot, contentDir, id, now } = options;

  if (!isPathSafe(id)) return { ok: false, status: 400, error: 'Invalid id' };
  if (!hasValidMarkdownExtension(id)) return { ok: false, status: 400, error: 'Invalid file extension' };

  const filePath = path.join(projectRoot, contentDir, id);
  const contentRoot = path.join(projectRoot, contentDir);

  // Defence in depth: isPathSafe only rejects '..' and absolute paths after
  // normalisation. Resolve both sides and confirm the target really sits inside
  // the content directory before moving anything.
  const [resolvedFile, resolvedRoot] = await Promise.all([
    fs.realpath(filePath).catch(() => path.resolve(filePath)),
    fs.realpath(contentRoot).catch(() => path.resolve(contentRoot)),
  ]);
  const relative = path.relative(resolvedRoot, resolvedFile);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { ok: false, status: 400, error: 'Invalid id' };
  }

  // Confirm the target exists and is a regular file, not a directory or symlink.
  const stat = await fs.lstat(resolvedFile);
  if (!stat.isFile()) return { ok: false, status: 400, error: 'Not a file' };

  const destination = retentionPath(projectRoot, id, now);
  if (destination === null) return { ok: false, status: 400, error: 'Invalid id' };

  await fs.mkdir(path.dirname(destination), { recursive: true });

  // `rename` is atomic within a volume but fails across one, so fall back to
  // copy-then-remove. The copy runs first and completes before the original is
  // touched, so a failure mid-way leaves the file in place rather than losing it
  // from both locations.
  try {
    await fs.rename(resolvedFile, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    await fs.copyFile(resolvedFile, destination);
    await fs.unlink(resolvedFile);
  }

  return { ok: true, retainedPath: path.relative(projectRoot, destination) };
}
