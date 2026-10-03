/**
 * CMS Create Moment API Handler
 *
 * Writes a new moment file. The filename comes from the date plus an optional
 * slug hint, matching the convention the feed's pure helpers already use.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import { z } from 'zod';
import { serializeMoment } from '@/lib/moment-serialize';
import { MOMENTS_DIR } from '@/lib/paths';
import { isPathSafe } from '@/lib/validation';
import type { CreateMomentResponse } from '@/types';

/** Zod schema for the create moment request. */
const createMomentRequestSchema = z.object({
  /** Required and non-empty: a moment with no body has nothing to show. */
  body: z.string().trim().min(1, 'Body is required'),
  /** Optional explicit timestamp; defaults to now. */
  date: z.string().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  draft: z.boolean().optional().default(false),
});

/** Characters of body text kept as a filename hint. */
const SLUG_HINT_LENGTH = 24;

/**
 * Derive a filename hint from the opening words of a moment.
 *
 * Mirrors `momentSlugHint` in `src/lib/content/moments.ts`. Duplicated rather
 * than imported because the CMS is a separate TypeScript project with its own
 * tsconfig and path aliases; importing across that boundary would couple the
 * CMS build to the site's module resolution.
 *
 * @param body - Moment body
 * @returns A filename-safe hint, or an empty string when nothing usable is found
 */
export function momentFileNameHint(body: string, maxLength = SLUG_HINT_LENGTH): string {
  const firstLine = body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return '';

  const plain = firstLine
    .replace(/^#+\s*/, '')
    .replace(/[*_`~[\]]/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();

  const slug = plain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return '';

  if (slug.length <= maxLength) return slug;
  const truncated = slug.slice(0, maxLength);
  const lastSeparator = truncated.lastIndexOf('-');
  return (lastSeparator > 0 ? truncated.slice(0, lastSeparator) : truncated).replace(/-+$/, '');
}

/** Format a timestamp as the filename prefix. */
export function momentFileStamp(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * Parse the request's date, falling back to now.
 *
 * Accepts `YYYY-MM-DD HH:mm:ss` as the CMS writes it, plus a plain
 * `YYYY-MM-DD`. An unparseable value falls back rather than failing, since the
 * timestamp is a convenience and not worth rejecting a written moment over.
 */
function resolveDate(value: string | undefined): Date {
  if (value) {
    const local = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (local) {
      const [, y, mo, d, h = '0', mi = '0', s = '0'] = local;
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    }
  }
  return new Date();
}

/**
 * POST /api/cms/moments
 *
 * Request body:
 * {
 *   body: string,
 *   date?: string,
 *   tags?: string[],
 *   draft?: boolean
 * }
 */
export async function createMomentHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const parseResult = createMomentRequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      return c.json({ error: parseResult.error.errors.map((e) => e.message).join(', ') }, 400);
    }

    const { body, date, tags, draft } = parseResult.data;
    const when = resolveDate(date);
    const hint = momentFileNameHint(body);

    // Keep the date prefix even when two moments land in the same second: the
    // counter suffix is what stops the second write from silently overwriting
    // the first, which would lose a moment with no error shown.
    const stamp = momentFileStamp(when);
    let momentId = hint ? `${stamp}-${hint}.md` : `${stamp}.md`;
    let collision = 1;
    while (await fileExists(path.join(projectRoot, MOMENTS_DIR, momentId))) {
      momentId = hint ? `${stamp}-${hint}-${collision}.md` : `${stamp}-${collision}.md`;
      collision += 1;
    }

    if (!isPathSafe(momentId)) {
      return c.json({ error: 'Invalid file path' }, 400);
    }

    const filePath = path.join(projectRoot, MOMENTS_DIR, momentId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, serializeMoment({ body, date: when, draft, tags }), 'utf-8');

    const response: CreateMomentResponse = { success: true, momentId };
    return c.json(response, 201);
  } catch (error) {
    console.error('[CMS Create Moment API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}
