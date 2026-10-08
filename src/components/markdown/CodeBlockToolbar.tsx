/**
 * Code block toolbar rendered via portal into a wrapper created by ContentEnhancer.
 * Provides Mac-style toolbar with copy and fullscreen buttons.
 */

import { CopyButton } from '@components/markdown/shared/CopyButton';
import { MacToolbar } from '@components/markdown/shared/MacToolbar';
import { useTranslation } from '@hooks/useTranslation';
import { Icon } from '@iconify/react';
import { extractCode, extractCodeClassName, extractCodeHTML, extractLanguage } from '@lib/content-enhancer-utils';
import { cn } from '@lib/utils';
import { openModal } from '@store/modal';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const EXPAND_DURATION = 480;
const EXPAND_EASING = 'cubic-bezier(0.25, 1, 0.5, 1)';

/**
 * Animate the code body's max-height between the collapsed preview height and
 * the full height. The wrapper class is toggled synchronously so the final
 * state comes from CSS; inline max-height only carries the animation.
 */
function animateHeight(
  wrapper: HTMLElement,
  codeEl: HTMLElement,
  expanding: boolean,
  running: React.RefObject<Animation | null>,
): void {
  running.current?.cancel();
  const from = codeEl.getBoundingClientRect().height;
  wrapper.classList.toggle('code-collapsed', !expanding);
  const to = codeEl.getBoundingClientRect().height;
  if (from === to) return;

  codeEl.style.overflow = 'hidden';
  codeEl.style.maxHeight = `${from}px`;
  const anim = codeEl.animate([{ maxHeight: `${from}px` }, { maxHeight: `${to}px` }], {
    duration: EXPAND_DURATION,
    easing: EXPAND_EASING,
  });
  running.current = anim;
  anim.onfinish = () => {
    codeEl.style.removeProperty('max-height');
    codeEl.style.removeProperty('overflow');
    running.current = null;
  };
}

interface CodeBlockToolbarProps {
  preElement: HTMLElement;
  enableCopy?: boolean;
  enableFullscreen?: boolean;
}

export function CodeBlockToolbar({ preElement, enableCopy = true, enableFullscreen = true }: CodeBlockToolbarProps) {
  const { t } = useTranslation();
  const info = useMemo(
    () => ({
      language: extractLanguage(preElement),
      code: extractCode(preElement),
      codeHTML: extractCodeHTML(preElement),
      preClassName: preElement.className,
      preStyle: preElement.getAttribute('style') || '',
      codeClassName: extractCodeClassName(preElement),
      title: preElement.dataset.title,
      url: preElement.dataset.url,
      linkText: preElement.dataset.linkText,
    }),
    [preElement],
  );

  // The build-time transformer owns the collapsibility decision; the wrapper class is its output.
  const collapsible = useMemo(() => preElement.parentElement?.classList.contains('code-collapsible') ?? false, [preElement]);
  const [collapsed, setCollapsed] = useState(collapsible);
  const runningAnim = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const wrapper = preElement.parentElement;
    if (!wrapper || !collapsible) return;
    wrapper.classList.toggle('code-collapsed', collapsed);
    return () => {
      wrapper.classList.remove('code-collapsed');
      runningAnim.current?.cancel();
    };
  }, [preElement, collapsible, collapsed]);

  /** Flip collapsed state, animating the code body height when motion is allowed. */
  const toggleCollapsed = useCallback(() => {
    const wrapper = preElement.parentElement;
    const codeEl = preElement.querySelector('code');
    // The wrapper class is the source of truth (the layout effect keeps it in sync),
    // so this stays correct even when called from a stale event-listener closure.
    const isCollapsed = wrapper?.classList.contains('code-collapsed') ?? true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!wrapper || !codeEl || reduced) {
      setCollapsed((prev) => !prev);
      return;
    }
    animateHeight(wrapper, codeEl, isCollapsed, runningAnim);
    setCollapsed(!isCollapsed);
  }, [preElement]);

  // Make the full toolbar clickable while preserving button and link behavior.
  useEffect(() => {
    const wrapper = preElement.parentElement;
    if (!wrapper || !collapsible) return;
    const toolbar = wrapper.querySelector('.code-block-wrapper-toolbar-mount');
    const handleBarClick = (event: Event) => {
      // Buttons and title links keep their own behavior instead of toggling the block.
      if ((event.target as HTMLElement).closest('button, a')) return;
      toggleCollapsed();
    };
    toolbar?.addEventListener('click', handleBarClick);
    return () => toolbar?.removeEventListener('click', handleBarClick);
  }, [preElement, collapsible, toggleCollapsed]);

  const handleFullscreen = () => {
    openModal('codeFullscreen', info);
  };

  return (
    <>
      <MacToolbar
        language={info.language}
        title={info.title}
        url={info.url}
        linkText={info.linkText}
        onFullscreen={enableFullscreen ? handleFullscreen : undefined}
      >
        {collapsible && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95"
            aria-label={collapsed ? t('code.expand') : t('code.collapse')}
            aria-expanded={!collapsed}
            title={collapsed ? t('code.expand') : t('code.collapse')}
          >
            <Icon
              icon="ri:arrow-down-s-line"
              className={cn('size-4 transition-transform duration-200', !collapsed && 'rotate-180')}
            />
          </button>
        )}
        {enableFullscreen && (
          <button
            type="button"
            onClick={(event) => {
              // Safari does not focus buttons on tap; record the return target before opening the dialog.
              event.currentTarget.focus({ preventScroll: true });
              handleFullscreen();
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95"
            aria-label={t('code.fullscreen')}
            title={t('code.fullscreen')}
          >
            <Icon icon="ri:fullscreen-line" className="size-4" />
          </button>
        )}
        {enableCopy && <CopyButton text={info.code} />}
      </MacToolbar>
      {collapsible && collapsed && (
        <button
          type="button"
          className="code-block-expand-overlay"
          onClick={toggleCollapsed}
          aria-label={t('code.expand')}
          title={t('code.expand')}
        >
          <span className="code-block-expand-overlay-pill">
            <Icon icon="ri:arrow-down-s-line" className="size-4" />
            {t('code.expand')}
          </span>
        </button>
      )}
    </>
  );
}
