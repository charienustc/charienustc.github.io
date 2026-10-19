/**
 * Initial frontmatter for a newly created post.
 *
 * Built through js-yaml rather than string concatenation: a title like
 * `OpenEP: Open-Ended Future Event Prediction` contains `": "`, which YAML
 * reads as a mapping separator. The old hand-built variant wrote the file,
 * then the very next read failed to parse it and the editor reported an
 * internal error. Dumping auto-quotes such values. The flow/quotes options
 * mirror `write.ts` so a fresh file matches what the editor produces.
 */

import { format } from 'date-fns';
import yaml from 'js-yaml';

export interface CreateFrontmatterInput {
  title: string;
  link: string;
  categories?: string[];
  tags?: string[];
  draft?: boolean;
}

export function generateFrontmatter(params: CreateFrontmatterInput): string {
  const dateStr = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

  // `link` is the locale-free path the content migration also derives; emitting
  // it up front keeps new posts from tripping the build's migration guard.
  const frontmatter: Record<string, unknown> = {
    link: params.link,
    title: params.title,
    date: dateStr,
    updated: dateStr,
  };

  if (params.categories && params.categories.length > 0) {
    frontmatter.categories = [params.categories];
  }

  if (params.tags && params.tags.length > 0) {
    frontmatter.tags = params.tags;
  }

  if (params.draft !== false) {
    frontmatter.draft = true;
  }

  frontmatter.catalog = true;

  const yamlStr = yaml
    .dump(frontmatter, {
      flowLevel: 2, // Nested arrays (categories) use flow style [a, b]
      lineWidth: -1,
      quotingType: "'",
      forceQuotes: false,
    })
    // Keep date/updated as plain timestamps instead of quoted strings.
    .replace(/^(date|updated): '(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'$/gm, '$1: $2');

  return `---\n${yamlStr}---\n\n`;
}
