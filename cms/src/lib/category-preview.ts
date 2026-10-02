/**
 * Category Path Preview
 *
 * Mirrors the decision the server makes for a new post's category, so the Create
 * dialog can tell the user *before* they submit whether a name they typed will
 * reuse an existing category or silently create a new one.
 *
 * This exists because that decision is invisible otherwise: `create.ts` falls
 * back to a pinyin slug and appends the name to `config/site.yaml`, so a typo
 * like `week` instead of `周刊` produces a new `week/` directory and a new config
 * entry with no error anywhere.
 *
 * This module is imported by the BROWSER, so it must stay free of Node builtins.
 * It deliberately duplicates the lookup *order* from `cms/src/api/create.ts`
 * rather than importing it — `create.ts` pulls in `node:fs/promises`, which Vite
 * externalises and which would break the app at runtime instead of at build
 * time. The two must be kept in sync by hand; `category-preview.test.ts` pins
 * the behaviour.
 */

import type { CustomCategory } from '@/hooks/useCustomCategories';

/** How a typed category name will be treated when the post is created. */
export type CategoryResolution = { kind: 'existing'; name: string; slug: string } | { kind: 'new'; name: string; slug: string };

/**
 * Resolve a single category name against the known map and this dialog's
 * custom mappings.
 *
 * Order matters and matches the server: a custom mapping (the user explicitly
 * edited the slug for a name they added in this session) wins, then the
 * configured `categoryMap`, then a generated slug. An empty name resolves to
 * nothing at all rather than a category.
 */
export function resolveCategory(
  name: string,
  categoryMap: Record<string, string>,
  customCategories: CustomCategory[],
): CategoryResolution | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Exact-string matching, mirroring the server's `categoryMap[cat]` and
  // `name in existingCategoryMap` — both case- and whitespace-sensitive. A
  // looser match here would promise a reuse the server would not perform.

  // A slug the user typed or edited in this dialog. Empty means they cleared a
  // generated one, which is not a usable path segment, so it is ignored and the
  // name falls through to the normal lookup rather than becoming a category
  // called "".
  const customSlug = customCategories.find((c) => c.name === trimmed)?.slug.trim();
  if (customSlug) return { kind: 'new', name: trimmed, slug: customSlug };

  const knownSlug = categoryMap[trimmed];
  if (knownSlug) return { kind: 'existing', name: trimmed, slug: knownSlug };

  // Unmatched. The slug is left empty rather than generated here: `slugify`
  // lives in `node_modules` and `generateCategorySlug` would pull it into the
  // browser bundle for one string. The caller generates it where a real slug is
  // needed (adding it as a chip), and `previewCategoryPath` renders an empty
  // slug as a placeholder.
  return { kind: 'new', name: trimmed, slug: '' };
}

/**
 * The full preview of where a post will land, given its selected categories.
 *
 * Mirrors `generateFilePath` in `cms/src/api/create.ts`: no categories means the
 * post sits at the content root, and each category becomes one path segment.
 *
 * A new category with no slug yet contributes a placeholder segment, because it
 * *will* be one directory deep — omitting it would understate the path.
 */
export function previewCategoryPath(
  selected: string[],
  categoryMap: Record<string, string>,
  customCategories: CustomCategory[],
  slugFor: (name: string) => string,
): { segments: string[]; resolutions: CategoryResolution[] } {
  const resolutions = selected
    .map((name) => resolveCategory(name, categoryMap, customCategories))
    .filter((r): r is CategoryResolution => r !== null);

  return {
    // A brand-new category has no slug until the user confirms the chip, so the
    // caller's generator supplies one for the preview. It matches what the
    // server will produce for the same name.
    segments: resolutions.map((r) => r.slug || slugFor(r.name) || '…'),
    resolutions,
  };
}

/**
 * The category names the dialog offers as chips.
 *
 * Configured categories come first because they are the ones that already have
 * a URL and a page; names that merely appear in existing posts are appended so
 * a name a post uses but the config does not map is still one click away.
 * Duplicates are dropped in favour of the configured entry.
 */
export function mergeCategoryOptions(configured: Record<string, string>, usedInPosts: string[]): string[] {
  const configuredNames = Object.keys(configured);
  const seen = new Set(configuredNames);
  const extra: string[] = [];
  for (const name of usedInPosts) {
    if (!seen.has(name)) {
      seen.add(name);
      extra.push(name);
    }
  }
  return [...configuredNames, ...extra];
}
