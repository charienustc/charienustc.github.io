/**
 * CMS Delete API Handler
 *
 * Deletes a blog post file. The frontend asks for confirmation before
 * calling this, but the removal itself is permanent — callers should be
 * on a git-clean tree if they want an undo path.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import { z } from 'zod';
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

    await fs.unlink(resolvedFile);

    const response: DeletePostResponse = {
      success: true,
      postId,
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
