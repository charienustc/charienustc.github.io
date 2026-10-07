/**
 * Single declaration site for every localized dynamic route's parameter space.
 *
 * Each route is declared once here and consumed twice: the root page exports
 * `<route>.root` and its `[lang]/` mirror exports `<route>.mirror`.
 */

import { PAGINATION } from '@constants/layout';
import { postActionsConfig } from '@lib/config/site';
import {
  getCategoryByLink,
  getCategoryLinks,
  getCategoryList,
  getEnabledSeries,
  getNonFeaturedPosts,
  getPostSlug,
  getSortedPosts,
  normalizeTag,
} from '@lib/content';
import { isPostSourceEnabled, isPostSourcePublic } from '@lib/content/post-source';
import { localePaths } from './utils';

/** Tags can contain `/`, which is not usable as a single route segment. */
const toTagParam = (tag: string) => normalizeTag(tag).replace(/\//g, '-');

export const postRoute = localePaths(async ({ locale }) => {
  const posts = await getSortedPosts(locale);
  return posts.map((post) => ({ params: { slug: getPostSlug(post) }, props: { postId: post.id } }));
});

/** Same param space as `postRoute`, minus posts with encrypted content (and drafts in production). */
export const postSourceRoute = localePaths(async ({ locale }) => {
  // No writing room in this fork: the `.md` endpoint only serves copy/download consumers.
  if (!isPostSourceEnabled(postActionsConfig, false, import.meta.env.DEV)) return [];
  const posts = await getSortedPosts(locale);
  return posts.flatMap((post) =>
    post.filePath && isPostSourcePublic(post.data, post.body, import.meta.env.PROD)
      ? [{ params: { slug: getPostSlug(post) }, props: { filePath: post.filePath } }]
      : [],
  );
});

export const tagRoute = localePaths(async ({ locale }) => {
  const posts = await getSortedPosts(locale);
  const tags = new Set(posts.flatMap((post) => (post.data.tags ?? []).map(normalizeTag)));
  return [...tags].map((tag) => ({ params: { tag: toTagParam(tag) }, props: { tag } }));
});

export const categoryRoute = localePaths(async ({ locale }) => {
  const { categories } = await getCategoryList(locale);
  return getCategoryLinks(categories, '').map((link) => ({
    params: { slug: link },
    props: { category: getCategoryByLink(categories, link) },
  }));
});

export const seriesRoute = localePaths(() =>
  getEnabledSeries().map((series) => ({ params: { seriesSlug: series.slug }, props: { series } })),
);

export const postListRoute = localePaths(async ({ locale, localeParams, paginate }) => {
  const posts = await getNonFeaturedPosts(locale);
  return paginate(posts, { pageSize: PAGINATION.pageSize, params: localeParams });
});
