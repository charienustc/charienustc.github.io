/**
 * Navigator Component
 *
 * Navigation header with scroll-based visibility control.
 * Uses useScrollTrigger hook for optimized scroll handling.
 */

import ThemeToggle from '@components/theme/ThemeToggle';
import { RESERVED_ROUTES } from '@constants/router';
import { configuredSeriesSlugs, enabledSeriesSlugs, routers } from '@constants/site-config';
import { useIsTablet } from '@hooks/useMediaQuery';
import { useScrollTrigger } from '@hooks/useScrollTrigger';
import { Icon } from '@iconify/react';
import { filterNavItems } from '@lib/utils';
import { memo, useEffect, useRef } from 'react';
import { defaultLocale, localizedPath, resolveNavName, stripLocaleFromPath } from '@/i18n';
import DropdownNav from './DropdownNav';
import LanguageSwitcher from './LanguageSwitcher';
import { SearchTrigger } from './SearchDialog';

interface NavigatorProps {
  currentPath: string;
  locale?: string;
}

// Pre-filter navigation items at module load (config is static)
const filteredRouters = filterNavItems(routers, configuredSeriesSlugs, enabledSeriesSlugs, RESERVED_ROUTES);

// Icon component for navigation items - uses @iconify/react for dynamic icons.
// Icon data loads asynchronously (Iconify API); the fixed-size wrapper reserves
// space so late icon rendering does not shift nav geometry (which would yank
// hover-opened dropdowns out from under the cursor).
function NavIcon({ name }: { name: string }) {
  return (
    <span className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <Icon icon={name} className="h-4 w-4" />
    </span>
  );
}

// Button link component.
// The active/hover mark is drawn by the shared `.nav-indicator` pill, so this
// only has to expose `aria-current` for it (and the CSS) to key off.
interface ButtonLinkProps {
  url: string;
  label: string;
  isActive: boolean;
  children: React.ReactNode;
}

function ButtonLink({ url, label, isActive, children }: ButtonLinkProps) {
  return (
    <a
      href={url}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className="relative flex items-center px-3 py-2 text-base tracking-wider"
    >
      {children}
    </a>
  );
}

/**
 * Drives the sliding `.nav-indicator` pill inside the desktop nav.
 *
 * Position is written straight to the element through a ref rather than React
 * state: this runs on every pointer move, and a re-render per move would be
 * wasteful for what is purely a visual offset.
 *
 * Hover is delegated to the container so the dropdown trigger (rendered by
 * `DropdownNav` as a `<button>`) is covered without touching that component.
 */
function useNavIndicator<T extends HTMLElement>(activePath: string) {
  const navRef = useRef<T>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;

    // The nav is `tablet:hidden`; measuring a display:none element yields 0.
    const isHidden = () => nav.offsetParent === null;

    const itemFor = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      return target.closest('a, button');
    };

    // Move the pill onto `el`, or hide it when no element is given.
    const place = (el: HTMLElement | null, instant = false) => {
      if (!el) {
        indicator.setAttribute('data-visible', 'false');
        return;
      }
      if (instant) indicator.setAttribute('data-instant', 'true');
      indicator.style.left = `${el.offsetLeft}px`;
      indicator.style.width = `${el.offsetWidth}px`;
      indicator.setAttribute('data-visible', 'true');
      // Keep `hover:after:`-style transitions from animating the position jump.
      if (instant) requestAnimationFrame(() => indicator.removeAttribute('data-instant'));
    };

    const activeItem = () => nav.querySelector<HTMLElement>('[aria-current="page"]');

    const syncToActive = () => {
      // On first paint (and on resize) snap without animating, so the pill does
      // not fly in from the left edge.
      place(isHidden() ? null : activeItem(), true);
    };

    const onPointerOver = (event: PointerEvent) => {
      const el = itemFor(event.target);
      if (el && nav.contains(el)) place(el);
    };

    // Returning to the active item on leave mirrors the original site: the pill
    // rests on the current page rather than disappearing.
    const onPointerLeave = () => {
      if (isHidden()) return;
      place(activeItem());
    };

    syncToActive();
    nav.addEventListener('pointerover', onPointerOver);
    nav.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', syncToActive);
    document.addEventListener('astro:page-load', syncToActive);

    return () => {
      nav.removeEventListener('pointerover', onPointerOver);
      nav.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', syncToActive);
      document.removeEventListener('astro:page-load', syncToActive);
    };
  }, []);

  // Re-snap the pill whenever the route changes, so it lands on the new active
  // item before the pointer touches anything.
  const activePathRef = useRef(activePath);
  useEffect(() => {
    if (activePathRef.current === activePath) return;
    activePathRef.current = activePath;

    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator || nav.offsetParent === null) return;

    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    indicator.setAttribute('data-instant', 'true');
    if (active) {
      indicator.style.left = `${active.offsetLeft}px`;
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.setAttribute('data-visible', 'true');
    } else {
      indicator.setAttribute('data-visible', 'false');
    }
    requestAnimationFrame(() => indicator.removeAttribute('data-instant'));
  }, [activePath]);

  return { navRef, indicatorRef };
}

const Navigator = memo(function Navigator({ currentPath, locale = defaultLocale }: NavigatorProps) {
  const { isBeyond, direction } = useScrollTrigger({
    triggerDistance: 0.45,
    throttleMs: 80,
  });

  const isTablet = useIsTablet();
  const strippedPath = stripLocaleFromPath(currentPath);
  const isPostPageMobile = isTablet && strippedPath.startsWith('/post/');

  // Re-measure when the route changes.
  const { navRef, indicatorRef } = useNavIndicator<HTMLElement>(currentPath);

  const firstScrollRef = useRef(true);

  // Apply with-background class based on scroll position
  useEffect(() => {
    document.getElementById('site-header')?.classList.toggle('with-background', isBeyond);
  }, [isBeyond]);

  // Handle header visibility based on scroll
  useEffect(() => {
    const siteHeader = document.getElementById('site-header');
    const mobileMenuContainer = document.getElementById('mobile-menu-container');

    // Skip first scroll
    if (firstScrollRef.current) {
      firstScrollRef.current = false;
      return;
    }

    // Post page mobile: keep header visible during scroll
    if (isPostPageMobile) {
      // Ensure header is visible
      siteHeader?.classList.remove('-translate-y-full');
      mobileMenuContainer?.classList.remove('-translate-y-full');
      return;
    }

    // Normal behavior: hide on scroll down, show on scroll up
    if (direction === 'down') {
      siteHeader?.classList.add('-translate-y-full');
      mobileMenuContainer?.classList.add('-translate-y-full');
    } else if (direction === 'up') {
      siteHeader?.classList.remove('-translate-y-full');
      mobileMenuContainer?.classList.remove('-translate-y-full');
    }
  }, [direction, isPostPageMobile]);

  return (
    <div className="flex grow tablet:grow-0 items-center">
      {/* Desktop navigation.
          Absolutely centred against the header row (which is `relative`) so it
          sits in the true middle of the page regardless of how wide the logo
          and the right-hand icon cluster are — justify-between alone drifts.
          `isolate` keeps the indicator's negative z-index above the header
          background rather than behind it. */}
      <nav ref={navRef} className="absolute left-1/2 isolate flex tablet:hidden -translate-x-1/2 items-center">
        <span ref={indicatorRef} aria-hidden="true" className="nav-indicator" data-visible="false" />
        {filteredRouters.map((item) => {
          const displayName = resolveNavName(item.nameKey, item.name, locale);
          if (item.children?.length) {
            return <DropdownNav key={item.path ?? item.name} item={item} currentPath={currentPath} locale={locale} />;
          }
          if (!item.path || !displayName) return null;
          const localizedUrl = item.localeIndependent ? item.path : localizedPath(item.path, locale);
          return (
            <ButtonLink key={item.path} url={localizedUrl} label={displayName} isActive={item.path === strippedPath}>
              {item.icon && <NavIcon name={item.icon} />}
              {displayName}
            </ButtonLink>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <SearchTrigger />
        <div className="tablet:hidden flex-center">
          <LanguageSwitcher locale={locale} />
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
});

export default Navigator;
