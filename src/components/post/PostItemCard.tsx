/**
 * PostItemCard — one post in a list.
 *
 * Ported from the Astro original so the card can run the magnetic tilt and
 * cursor-following highlight that the friend cards use. The server-rendered
 * markup is unchanged: these are the same Tailwind layers in the same order,
 * with `m.div` only where a motion value has to be written every frame.
 */

import { LazyMotionProvider } from '@components/common/LazyMotionProvider';
import { Badge } from '@components/ui/badge';
import { ScrollableRow } from '@components/ui/ScrollableRow';
import { Routes } from '@constants/router';
import { createArticleStatsConfig, defaultCoverList } from '@constants/site-config';
import { useMagneticTilt } from '@hooks/useMagneticTilt';
import { Icon } from '@iconify/react';
import { buildCategoryPath, getCategoryArr } from '@lib/content/category-path';
import { translateCategoryName } from '@lib/content/category-translate';
import { buildTagPath } from '@lib/content/tags';
import { displayDate } from '@lib/date';
import { getLqipProps } from '@lib/lqip';
import { postTitleMorphName } from '@lib/morph-transitions';
import { routeBuilder } from '@lib/route';
import { cn } from '@lib/utils';
import { m } from 'motion/react';
import UmamiPVSpan from '@/components/umami/UmamiPVSpan';
import { defaultLocale, getLocaleFromUrl, getLocaleLabel, localizedPath, t } from '@/i18n';
import type { PostCardData } from '@/types/blog';

export interface PostItemCardProps {
  data: PostCardData;
  leftClip?: boolean;
  randomCover: string;
  showTags?: boolean;
  hideCover?: boolean; // 隐藏图片，让内容铺满
  isSimple?: boolean; // 是否简单模式
  isUniformPosition?: boolean; // 是否统一图片位置（非交替模式）
}

// Stagger padding amounts for uniform position mode (following diagonal edge)
// Only applied when images are on left, where the diagonal faces the content
const staggerAmounts = ['pl-0', 'pl-2', 'pl-4', 'pl-6'] as const;

/**
 * Get stagger padding class for a content row
 * @param rowIndex - The row index (0-3)
 * @returns Tailwind padding class or empty string
 */
function getStaggerPadding(
  rowIndex: number,
  { isUniformPosition, hideCover, leftClip }: { isUniformPosition: boolean; hideCover: boolean; leftClip: boolean },
): string {
  // Only apply stagger for left image position (diagonal faces content)
  if (!isUniformPosition || hideCover || !leftClip) return '';
  return staggerAmounts[rowIndex];
}

export default function PostItemCard({
  randomCover,
  data,
  leftClip = true,
  hideCover: hideCoverProp,
  showTags: showTagsProp,
  isSimple = false,
  isUniformPosition = false,
}: PostItemCardProps) {
  const showTags = showTagsProp ?? !isSimple;
  const hideCover = hideCoverProp ?? isSimple;

  const {
    cover,
    date,
    categories,
    title,
    draft,
    description,
    slug,
    link,
    tags,
    wordCount,
    readingTime,
    postLocale,
    cardMarks,
  } = data ?? {};

  const locale = getLocaleFromUrl(typeof window === 'undefined' ? '/' : window.location.pathname);
  const finalCover = cover ?? randomCover ?? defaultCoverList[0];
  const href = localizedPath(routeBuilder(Routes.Post, { slug, link, title }), locale);
  const isDraft = import.meta.env.DEV && draft === true;
  const isFallback = postLocale != null && locale !== defaultLocale && postLocale !== locale;

  const categoryArr = getCategoryArr(categories?.[0]);
  const categoryLink = localizedPath(buildCategoryPath(categoryArr), locale);
  const categoryStr = categoryArr?.length ? translateCategoryName(categoryArr[categoryArr.length - 1], locale) : '';

  const postDescription = description ?? '';

  const lqipProps = getLqipProps(finalCover);

  const stagger = { isUniformPosition, hideCover, leftClip };
  const pageStatsConfig = createArticleStatsConfig(href);

  const { onPointerMove, onPointerLeave, wrapperStyle, layerStyle, highlightStyle } = useMagneticTilt();

  const titleMorph = postTitleMorphName(slug);

  return (
    <LazyMotionProvider>
      <m.div
        className={cn('post-item-card motion-reveal relative', hideCover && 'md:flex-col')}
        style={wrapperStyle}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <m.div
          className="group relative flex rounded-lg bg-white text-card-foreground shadow-card transition-shadow hover:shadow-card-darker md:flex-col dark:bg-transparent"
          style={layerStyle}
        >
          {!hideCover && (
            <a
              aria-label="post-link"
              href={href}
              style={lqipProps.style ? { backgroundImage: lqipProps.style } : undefined}
              className={cn(
                'md:clip-path-none relative h-46.5 max-h-46.5 w-[calc(50%-2rem)] overflow-hidden md:w-auto',
                leftClip ? 'clip-path-post-img-left order-1 rounded-s-lg' : 'clip-path-post-img-right order-2 rounded-e-lg',
                'md:clip-path-none md:order-0',
                lqipProps.class,
              )}
            >
              <img
                src={finalCover}
                loading="lazy"
                alt="post cover"
                className="h-full w-full cursor-pointer object-cover transition duration-500 group-hover:rotate-3 group-hover:scale-110"
              />
            </a>
          )}

          <div
            className={cn(
              'flex flex-col gap-2 pt-4 pb-2 md:pt-1 md:pb-4',
              'px-4 md:px-4',
              // Reduce margin on the side adjacent to image diagonal when uniform left position
              isUniformPosition && !hideCover && leftClip && '-ml-3',
              hideCover ? 'w-full' : 'w-[calc(50%+2rem)] md:w-full',
              !hideCover && (leftClip ? 'order-2' : 'order-1'),
              'md:order-0',
            )}
          >
            <ScrollableRow
              className={cn('w-full', { 'order-2 pb-3 md:pb-0': isSimple }, getStaggerPadding(0, stagger), 'md:pr-0 md:pl-0')}
              innerClassName="items-center justify-between gap-4 w-full"
              fadeWidth={20}
            >
              {categoryStr && (
                <a
                  href={categoryLink}
                  className="flex-center shrink-0 whitespace-nowrap text-muted-foreground text-xs transition duration-300 hover:text-blue"
                >
                  <Icon icon="gg:flag" />
                  {categoryStr}
                </a>
              )}
              <div className="flex shrink-0 items-center gap-3 text-muted-foreground text-xs">
                {date ? (
                  <p className="flex-center gap-1 whitespace-nowrap">
                    <Icon icon="fa6-solid:calendar-days" />
                    {displayDate.date(date)}
                  </p>
                ) : null}
                {cardMarks?.length ? (
                  <span className="flex-center gap-1.5">
                    {cardMarks.map((mark) => (
                      <span
                        key={mark.icon + mark.label}
                        className="inline-flex"
                        role="img"
                        title={mark.label}
                        aria-label={mark.label}
                      >
                        <Icon icon={mark.icon} className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    ))}
                  </span>
                ) : null}
                <p className="flex-center gap-1 whitespace-nowrap">
                  <Icon icon="fa6-solid:pen-nib" />
                  {t(locale, 'post.wordCount', { count: wordCount })}
                </p>
                <button
                  type="button"
                  className="flex-center gap-1 whitespace-nowrap md:hidden"
                  title={t(locale, 'post.readingTimeTooltip', { time: readingTime })}
                  data-tooltip-placement="top"
                >
                  <Icon icon="fa6-solid:clock" />
                  {readingTime}
                </button>

                {pageStatsConfig && (
                  <span className="flex-center gap-1 whitespace-nowrap">
                    <Icon icon="ri:eye-line" className="h-4 w-4" />
                    <UmamiPVSpan statsConfig={pageStatsConfig} />
                    {t(locale, 'stats.pageviews')}
                  </span>
                )}
              </div>
            </ScrollableRow>

            <div className={cn('mt-1 flex flex-col space-y-1.5 p-0', getStaggerPadding(1, stagger), 'md:pr-0 md:pl-0')}>
              <div className="flex items-center gap-2">
                <a href={href} aria-label="post-link" className="min-w-0 flex-1">
                  <h2
                    className="line-clamp-1 w-fit max-w-full truncate font-bold text-primary text-xl transition-colors duration-300 hover:text-blue"
                    data-morph={titleMorph}
                    style={{ viewTransitionName: titleMorph }}
                  >
                    {title}
                  </h2>
                </a>
                {isDraft && (
                  <Badge className="shrink-0 gap-1 whitespace-nowrap border border-yellow-600/20 bg-yellow-700 text-white transition-colors duration-300 hover:bg-yellow-500">
                    <Icon icon="fa6-solid:file-pen" className="h-3 w-3" />
                    {t(locale, 'post.draft')}
                  </Badge>
                )}
                {isFallback && (
                  <Badge className="shrink-0 gap-1 whitespace-nowrap border-amber-500/30 bg-amber-500/10 text-amber-700 transition-colors duration-300 dark:text-amber-400">
                    <Icon icon="ri:translate-2" className="h-3 w-3" />
                    {getLocaleLabel(postLocale ?? defaultLocale)}
                  </Badge>
                )}
              </div>
            </div>

            <p
              className={cn(
                'line-clamp-3 h-15 text-muted-foreground text-sm md:h-auto md:max-h-15',
                { 'line-clamp-2 h-10 md:max-h-10': isSimple },
                getStaggerPadding(2, stagger),
                'md:pr-0 md:pl-0',
              )}
            >
              {postDescription}
            </p>

            {showTags && tags?.length && (
              <ScrollableRow
                className={cn(
                  'pt-1 pb-1',
                  leftClip ? 'mr-18' : 'ml-18',
                  'md:mx-0',
                  getStaggerPadding(3, stagger),
                  'md:pr-0 md:pl-0',
                )}
                innerClassName="gap-2"
                fadeWidth={16}
              >
                {tags.map((tag: string) => (
                  <a key={tag} href={localizedPath(buildTagPath(tag), locale)}>
                    <Badge
                      className="flex shrink-0 cursor-pointer gap-0.5 whitespace-nowrap border-none px-1 font-bold text-xs transition-colors duration-300 hover:text-badge-primary/80"
                      variant="outline"
                    >
                      <Icon icon="fa6-solid:tags" /> {tag}
                    </Badge>
                  </a>
                ))}
              </ScrollableRow>
            )}
          </div>

          {/* Spotlight Overlay — follows the cursor, matching the friend cards.
              Must live *inside* the `.group` layer, or `group-hover` never matches. */}
          <m.div
            aria-hidden="true"
            className="magnetic-highlight pointer-events-none absolute inset-0 z-10 rounded-lg opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={highlightStyle}
          />
        </m.div>
      </m.div>
    </LazyMotionProvider>
  );
}
