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
 *
 * The mechanics live in `deleteWithRetention`, shared with the moments handler.
 */

import type { Context } from 'hono';
import { z } from 'zod';
import { deleteWithRetention } from '@/lib/delete-with-retention';
import { CONTENT_DIR } from '@/lib/paths';
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
 *   postId: string,
 *   retainedPath?: string
 * }
 */
export async function deleteHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const parseResult = deletePostRequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      return c.json({ error: parseResult.error.errors.map((e) => e.message).join(', ') }, 400);
    }

    const { postId } = parseResult.data;
    const outcome = await deleteWithRetention({
      projectRoot,
      contentDir: CONTENT_DIR,
      id: postId,
      now: new Date(),
    });

    if (!outcome.ok) {
      // The id is echoed back rather than the generic word "id", so the error
      // reads the same as it did before the shared helper was introduced.
      return c.json({ error: outcome.error.replace(/\bid\b/g, 'postId') }, outcome.status);
    }

    const response: DeletePostResponse = {
      success: true,
      postId,
      retainedPath: outcome.retainedPath,
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
