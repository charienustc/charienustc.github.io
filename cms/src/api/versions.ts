import type { Context } from 'hono';
import { z } from 'zod';
import { listPostVersions, readPostVersion, restorePostVersion, VersionError } from '../lib/post-versions';

function versionError(c: Context, error: unknown) {
  if (error instanceof VersionError) return c.json({ error: error.message }, error.status);
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') return c.json({ error: 'Post or version not found' }, 404);
  if (error instanceof SyntaxError) return c.json({ error: 'Invalid JSON' }, 400);
  console.error('[CMS Versions API]', error);
  return c.json({ error: 'Internal server error' }, 500);
}

export async function listVersionsHandler(c: Context) {
  try {
    return c.json({ versions: await listPostVersions(c.get('projectRoot'), c.req.query('postId') ?? '') });
  } catch (error) {
    return versionError(c, error);
  }
}

export async function readVersionHandler(c: Context) {
  try {
    return c.json(await readPostVersion(c.get('projectRoot'), c.req.query('postId') ?? '', c.req.query('version') ?? ''));
  } catch (error) {
    return versionError(c, error);
  }
}

const restoreSchema = z.object({ postId: z.string().min(1), version: z.string().min(1) });

export async function restoreVersionHandler(c: Context) {
  try {
    const data = restoreSchema.safeParse(await c.req.json());
    if (!data.success) return c.json({ error: 'postId and version are required' }, 400);
    await restorePostVersion(c.get('projectRoot'), data.data.postId, data.data.version);
    return c.json({ success: true, postId: data.data.postId });
  } catch (error) {
    return versionError(c, error);
  }
}
