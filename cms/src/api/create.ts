/**
 * CMS Create API Handler
 *
 * Creates a new blog post file with initial frontmatter.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import { z } from 'zod';
import { getCategoryMap } from '@/lib/category';
import { addCategoryMappings } from '@/lib/config';
import { generateFrontmatter } from '@/lib/create-frontmatter';
import { CONTENT_DIR } from '@/lib/paths';
import { generateSlug } from '@/lib/slug';
import { isPathSafe } from '@/lib/validation';
import type { CreatePostResponse } from '@/types';

/** Zod schema for create post request validation */
const createPostRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().optional().default(true),
  categoryMappings: z.record(z.string(), z.string()).optional(),
});

/**
 * Generates the file path based on categories
 * e.g., ['笔记', '前端'] + 'React Hooks' => 'note/front-end/react-hooks.md'
 */
function generateFilePath(title: string, categories?: string[], customMappings?: Record<string, string>): string {
  const slug = generateSlug(title);
  const categoryMap = getCategoryMap();

  if (!categories || categories.length === 0) {
    return `${slug}.md`;
  }

  // Convert category names to slugs using categoryMap + custom mappings
  const pathSegments = categories.map((cat) => {
    // Check custom mappings first (for new categories)
    if (customMappings?.[cat]) {
      return customMappings[cat];
    }
    // Then check existing categoryMap
    const mappedSlug = categoryMap[cat];
    if (mappedSlug) {
      return mappedSlug;
    }
    // Fallback: generate slug from category name
    return generateSlug(cat);
  });

  return `${pathSegments.join('/')}/${slug}.md`;
}

/**
 * POST /api/cms/create
 *
 * Request body:
 * {
 *   title: string,
 *   categories?: string[],
 *   tags?: string[],
 *   draft?: boolean
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   postId: string
 * }
 */
export async function createHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const rawBody = await c.req.json();
    const parseResult = createPostRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map((e) => e.message).join(', ');
      return c.json({ error: errorMessage }, 400);
    }

    const { title, categories, tags, draft, categoryMappings: customMappings } = parseResult.data;

    // Generate file path (pass custom mappings for path generation)
    const postId = generateFilePath(title, categories, customMappings);

    // Validate path safety
    if (!isPathSafe(postId)) {
      return c.json({ error: 'Invalid file path' }, 400);
    }

    const filePath = path.join(projectRoot, CONTENT_DIR, postId);

    // Check if file already exists
    try {
      await fs.access(filePath);
      return c.json({ error: `File already exists: ${postId}` }, 409);
    } catch {
      // File doesn't exist, good to proceed
    }

    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });

    // Add new category mappings if provided
    if (customMappings && Object.keys(customMappings).length > 0) {
      await addCategoryMappings(projectRoot, customMappings);
    }

    // Generate frontmatter and write file. The link mirrors the migration's
    // path-derived value (file path without extension, e.g. `note/my-post`).
    const link = postId.replace(/\.(md|mdx)$/i, '');
    const content = generateFrontmatter({ title, link, categories, tags, draft });
    await fs.writeFile(filePath, content, 'utf-8');

    const response: CreatePostResponse = {
      success: true,
      postId,
    };

    return c.json(response, 201);
  } catch (error) {
    console.error('[CMS Create API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
