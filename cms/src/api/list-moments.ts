/**
 * CMS List Moments API Handler
 *
 * Lists the moments ("碎碎念") feed for the dashboard's moments tab. Kept
 * separate from the post list handler because the two collections share almost
 * no fields: a moment has no title, slug, categories, or sticky flag.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import { extractMomentBody, parseMomentFrontmatter } from '@/lib/moment-serialize';
import { MOMENTS_DIR } from '@/lib/paths';
import type { ListMomentsResponse, MomentListItem } from '@/types';

/** Characters of body text shown as a list preview. */
const PREVIEW_LENGTH = 80;

/** Read every `.md` file under a directory, recursively. */
async function getAllMarkdownFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const filesByEntry = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return getAllMarkdownFiles(fullPath, baseDir);
      if (entry.isFile() && entry.name.endsWith('.md')) {
        return [path.relative(baseDir, fullPath)];
      }
      return [];
    }),
  );

  return filesByEntry.flat();
}

/**
 * Parse one moment file into a list item.
 *
 * Returns null when the file has no usable frontmatter, so a malformed file is
 * skipped rather than crashing the whole listing.
 */
async function parseMomentFile(relPath: string, contentDir: string): Promise<MomentListItem | null> {
  const raw = await fs.readFile(path.join(contentDir, relPath), 'utf-8');
  const frontmatter = parseMomentFrontmatter(raw);
  if (!frontmatter) return null;

  const body = extractMomentBody(raw);
  const normalisedId = relPath.split(path.sep).join('/');
  const collapsed = body.replace(/\s+/g, ' ').trim();
  const preview = collapsed.length > PREVIEW_LENGTH ? `${collapsed.slice(0, PREVIEW_LENGTH)}…` : collapsed;

  return {
    id: normalisedId,
    date: frontmatter.date,
    updated: frontmatter.updated,
    draft: frontmatter.draft,
    tags: frontmatter.tags,
    preview,
    length: body.length,
  };
}

/**
 * GET /api/cms/moments
 *
 * Returns every moment, newest first.
 */
export async function listMomentsHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const contentDir = path.join(projectRoot, MOMENTS_DIR);

    // A missing directory is an empty feed, not an error: the feature works
    // before the first moment exists.
    const files = await getAllMarkdownFiles(contentDir).catch(() => [] as string[]);
    const parsed = await Promise.all(files.map((file) => parseMomentFile(file, contentDir)));
    const moments: MomentListItem[] = parsed.filter((moment): moment is MomentListItem => moment !== null);

    // Newest first, with the id as a stable tiebreaker for same-second writes.
    // `toSorted` is unavailable at the CMS's lib target, so copy first.
    const sorted = [...moments].sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));

    const response: ListMomentsResponse = {
      moments: sorted,
      total: sorted.length,
      draft: sorted.filter((moment) => moment.draft).length,
      published: sorted.filter((moment) => !moment.draft).length,
      tags: [...new Set(sorted.flatMap((moment) => moment.tags))].sort(),
    };

    return c.json(response);
  } catch (error) {
    console.error('[CMS List Moments API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
