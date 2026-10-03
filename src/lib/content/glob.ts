export const BLOG_CONTENT_GLOB_PATTERN = ['**/*.{md,mdx}', '!**/_*/**', '!**/_*.{md,mdx}'];

/**
 * Glob for the moments feed.
 *
 * Markdown only — moments are short-form and have no use for MDX components,
 * which keeps the CMS's plain-text writer valid for every file it can produce.
 * Underscore-prefixed files are skipped using the same convention as posts.
 */
export const MOMENTS_CONTENT_GLOB_PATTERN = ['**/*.md', '!**/_*/**', '!**/_*.md'];

export function isBlogContentFile(relativePath: string): boolean {
  const segments = relativePath.replaceAll('\\', '/').split('/').filter(Boolean);
  const fileName = segments.at(-1);
  return Boolean(fileName && segments.every((segment) => !segment.startsWith('_')) && /\.(md|mdx)$/i.test(fileName));
}
