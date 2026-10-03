/**
 * CMS Update Moment API Handler
 *
 * Rewrites an existing moment in place. Before overwriting, the previous
 * revision is copied into `backups/versions/` so an edit is recoverable — not
 * because editing is dangerous, but because it is the one operation that
 * destroys text the user can no longer see.
 *
 * The write is a full rewrite rather than a field-level patch: the composer
 * always submits the complete body, so there is no partial-update state to get
 * wrong.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import { z } from 'zod';
import { parseMomentFrontmatter, serializeMoment } from '@/lib/moment-serialize';
import { momentVersionPath } from '@/lib/moment-versions';
import { MOMENTS_DIR } from '@/lib/paths';
import { hasValidMarkdownExtension, isPathSafe } from '@/lib/validation';
import type { UpdateMomentResponse } from '@/types';

const updateMomentRequestSchema = z.object({
  momentId: z.string({ required_error: 'momentId is required' }).min(1, 'momentId is required'),
  body: z.string({ required_error: 'Body is required' }).trim().min(1, 'Body is required'),
  tags: z.array(z.string().trim().min(1)).optional(),
  draft: z.boolean().optional().default(false),
});

/**
 * POST /api/cms/moments/update
 *
 * Request body:
 * {
 *   momentId: string,
 *   body: string,
 *   tags?: string[],
 *   draft?: boolean
 * }
 */
export async function updateMomentHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const parseResult = updateMomentRequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      return c.json({ error: parseResult.error.errors.map((e) => e.message).join(', ') }, 400);
    }

    const { momentId, body, tags, draft } = parseResult.data;

    if (!isPathSafe(momentId) || !hasValidMarkdownExtension(momentId)) {
      return c.json({ error: 'Invalid momentId' }, 400);
    }

    const contentRoot = path.join(projectRoot, MOMENTS_DIR);
    const filePath = path.join(contentRoot, momentId);

    // This id comes from the client and the operation WRITES, so containment is
    // load-bearing: without it a traversal id would let a caller create or
    // overwrite a file anywhere on disk.
    const [resolvedFile, resolvedRoot] = await Promise.all([
      fs.realpath(filePath).catch(() => path.resolve(filePath)),
      fs.realpath(contentRoot).catch(() => path.resolve(contentRoot)),
    ]);
    const relative = path.relative(resolvedRoot, resolvedFile);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      return c.json({ error: 'Invalid momentId' }, 400);
    }

    const previous = await fs.readFile(resolvedFile, 'utf-8');
    const frontmatter = parseMomentFrontmatter(previous);
    if (!frontmatter) {
      return c.json({ error: 'Moment has no parsable frontmatter' }, 422);
    }

    // Keep the original publication date: it answers "when was this written",
    // and editing does not change that. `date` also drives feed ordering, so
    // touching it would silently reorder the feed on every edit.
    const date = new Date(frontmatter.date.replace(' ', 'T'));

    // Preserve the first-edit time on later edits, so `updated` keeps meaning
    // "when this was last changed" rather than resetting each save.
    const now = new Date();

    // Retain the previous revision before it is lost. The version path is built
    // from the same request-supplied id, so it re-checks containment itself.
    const versionPath = momentVersionPath(projectRoot, momentId, now);
    if (versionPath === null) {
      return c.json({ error: 'Invalid momentId' }, 400);
    }
    await fs.mkdir(path.dirname(versionPath), { recursive: true });
    await fs.writeFile(versionPath, previous, 'utf-8');

    await fs.writeFile(resolvedFile, serializeMoment({ body, date, updated: now, draft, tags }), 'utf-8');

    const response: UpdateMomentResponse = {
      success: true,
      momentId,
      versionPath: path.relative(projectRoot, versionPath),
    };

    return c.json(response);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return c.json({ error: 'Moment not found' }, 404);
    }
    console.error('[CMS Update Moment API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
