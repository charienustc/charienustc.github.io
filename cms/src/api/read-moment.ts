/**
 * CMS Read Moment API Handler
 *
 * Returns one moment's fields for the composer's edit mode.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import { deleteWithRetention } from '@/lib/delete-with-retention';
import { extractMomentBody, parseMomentFrontmatter } from '@/lib/moment-serialize';
import { MOMENTS_DIR } from '@/lib/paths';
import { hasValidMarkdownExtension, isPathSafe } from '@/lib/validation';
import type { ReadMomentResponse } from '@/types';

/**
 * GET /api/cms/moments/read?momentId=...
 *
 * Query parameters:
 * - momentId: string
 */
export async function readMomentHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const momentId = c.req.query('momentId');
    if (!momentId) return c.json({ error: 'momentId is required' }, 400);
    if (!isPathSafe(momentId) || !hasValidMarkdownExtension(momentId)) {
      return c.json({ error: 'Invalid momentId' }, 400);
    }

    const contentRoot = path.join(projectRoot, MOMENTS_DIR);
    const filePath = path.join(contentRoot, momentId);

    // Same containment check the delete path uses: the id arrives from the
    // client, so it must not be able to read outside the moments directory.
    const [resolvedFile, resolvedRoot] = await Promise.all([
      fs.realpath(filePath).catch(() => path.resolve(filePath)),
      fs.realpath(contentRoot).catch(() => path.resolve(contentRoot)),
    ]);
    const relative = path.relative(resolvedRoot, resolvedFile);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      return c.json({ error: 'Invalid momentId' }, 400);
    }

    const raw = await fs.readFile(resolvedFile, 'utf-8');
    const frontmatter = parseMomentFrontmatter(raw);
    if (!frontmatter) {
      return c.json({ error: 'Moment has no parsable frontmatter' }, 422);
    }

    const response: ReadMomentResponse = {
      id: momentId,
      body: extractMomentBody(raw),
      date: frontmatter.date,
      tags: frontmatter.tags,
    };

    return c.json(response);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return c.json({ error: 'Moment not found' }, 404);
    }
    console.error('[CMS Read Moment API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

/**
 * POST /api/cms/moments/delete
 *
 * Retains the moment in `backups/deleted/` rather than unlinking it, matching
 * the post delete behaviour.
 */
export async function deleteMomentHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const body = (await c.req.json()) as { momentId?: string };
    const momentId = body.momentId;
    if (typeof momentId !== 'string' || momentId.length === 0) {
      return c.json({ error: 'momentId is required' }, 400);
    }

    const outcome = await deleteWithRetention({
      projectRoot,
      contentDir: MOMENTS_DIR,
      id: momentId,
      now: new Date(),
    });

    if (!outcome.ok) {
      return c.json({ error: outcome.error.replace(/\bid\b/g, 'momentId') }, outcome.status);
    }

    return c.json({ success: true, momentId, retainedPath: outcome.retainedPath });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return c.json({ error: 'Moment not found' }, 404);
    }
    console.error('[CMS Delete Moment API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
