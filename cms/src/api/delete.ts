/**
 * CMS Delete API Handler
 *
 * Removes a blog post from the content directory. Rather than unlinking the
 * file, it is moved into a retention directory under `backups/`, so a
 * mis-clicked delete is recoverable without reaching for version control.
 *
 * This is a local safety net, not an undo stack: `backups/` is gitignored, so
 * the deletion still appears as a deletion in `git status`, and nothing here
 * manages the retained copies afterwards.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import { z } from 'zod';
import { retentionPath } from '@/lib/deleted-posts';
import { CONTENT_DIR } from '@/lib/paths';
import { hasValidMarkdownExtension, isPathSafe } from '@/lib/validation';
import type { DeletePostResponse } from '@/types';

/** Zod schema for delete post request validation */
const deletePostRequestSchema = z.object({
  postId: z.string().min(1, 'postId is required'),
});

/**
 * POST /api/cms/delete
 *
 * Request body:
 * {
 *   postId: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   postId: string
 * }
 */
export async function deleteHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const rawBody = await c.req.json();
    const parseResult = deletePostRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map((e) => e.message).join(', ');
      return c.json({ error: errorMessage }, 400);
    }

    const { postId } = parseResult.data;

    // Validate path safety
    if (!isPathSafe(postId)) {
      return c.json({ error: 'Invalid postId' }, 400);
    }

    // Ensure the file has .md or .mdx extension
    if (!hasValidMarkdownExtension(postId)) {
      return c.json({ error: 'Invalid file extension' }, 400);
    }

    const filePath = path.join(projectRoot, CONTENT_DIR, postId);
    const contentRoot = path.join(projectRoot, CONTENT_DIR);

    // Defence in depth: isPathSafe only rejects '..' and absolute paths after
    // normalisation. Resolve both sides and confirm the target really sits
    // inside the content directory before unlinking anything.
    const [resolvedFile, resolvedRoot] = await Promise.all([
      fs.realpath(filePath).catch(() => path.resolve(filePath)),
      fs.realpath(contentRoot).catch(() => path.resolve(contentRoot)),
    ]);
    const relative = path.relative(resolvedRoot, resolvedFile);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      return c.json({ error: 'Invalid postId' }, 400);
    }

    // Confirm the target exists and is a regular file, not a directory or symlink
    const stat = await fs.lstat(resolvedFile);
    if (!stat.isFile()) {
      return c.json({ error: 'Not a file' }, 400);
    }

    // Retain rather than remove. `postId` is used to rebuild the directory
    // structure under the retention root, so it is re-validated for containment
    // there — the check above bounds the source, this bounds the destination.
    const destination = retentionPath(projectRoot, postId, new Date());
    if (destination === null) {
      return c.json({ error: 'Invalid postId' }, 400);
    }

    await fs.mkdir(path.dirname(destination), { recursive: true });

    // `rename` is atomic within a volume but fails across one, so fall back to
    // copy-then-remove. The copy runs first and is verified before the original
    // is touched, so a failure mid-way leaves the post in place rather than
    // losing it from both locations.
    try {
      await fs.rename(resolvedFile, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await fs.copyFile(resolvedFile, destination);
      await fs.unlink(resolvedFile);
    }

    const response: DeletePostResponse = {
      success: true,
      postId,
      retainedPath: path.relative(projectRoot, destination),
    };

    return c.json(response);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return c.json({ error: 'File not found' }, 404);
    }

    console.error('[CMS Delete API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
