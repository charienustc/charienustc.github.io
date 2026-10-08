/**
 * ThemeToggle Component
 *
 * A sun/moon toggle for switching between light and dark themes.
 * The new theme is revealed as a circle growing from the button (View Transitions API).
 *
 * Toggle mechanics ported from upstream v7 (astro-koharu); the button keeps the
 * local lucide sun/moon icons instead of upstream's CSS-only indicator.
 */

import { useIsMounted } from '@hooks/useIsMounted';
import { useTranslation } from '@hooks/useTranslation';
import { Icon } from '@iconify/react';
import { isMotionDisabled } from '@lib/motion-level';
import { holdPetalBurst } from '@lib/sakura/petal-burst';
import { cn } from '@lib/utils';
import { useCallback, useEffect, useState } from 'react';

/**
 * Hook to manage theme state
 */
function useTheme() {
  // Starts false to match the server render; the effect below syncs it from <html class="dark">.
  const [isDark, setIsDark] = useState(false);

  // Sync with DOM changes (e.g., from other tabs or initial state)
  useEffect(() => {
    const rootElement = document.documentElement;

    // Initial sync
    setIsDark(rootElement.classList.contains('dark'));

    // Watch for class changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          setIsDark(rootElement.classList.contains('dark'));
        }
      }
    });

    observer.observe(rootElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const applyTheme = useCallback((dark: boolean) => {
    const root = document.documentElement;
    const theme = dark ? 'dark' : 'light';

    root.classList.toggle('dark', dark);
    root.dataset.theme = theme; // For astro-mermaid autoTheme
    localStorage.setItem('theme', theme);
  }, []);

  const toggle = useCallback(
    (origin: HTMLElement) => {
      const newIsDark = !isDark;
      const rootElement = document.documentElement;

      if (isMotionDisabled() || !document.startViewTransition) {
        applyTheme(newIsDark);
        setIsDark(newIsDark);
        return;
      }

      // The reveal circle starts at the button and must reach the farthest viewport corner.
      const rect = origin.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      rootElement.style.setProperty('--theme-x', `${x}px`);
      rootElement.style.setProperty('--theme-y', `${y}px`);
      rootElement.style.setProperty('--theme-r', `${radius}px`);
      rootElement.classList.add('theme-transition');

      const transition = document.startViewTransition(() => {
        applyTheme(newIsDark);
        setIsDark(newIsDark);
      });
      holdPetalBurst(transition);

      transition.finished.finally(() => {
        rootElement.classList.remove('theme-transition');
      });
    },
    [isDark, applyTheme],
  );

  return { isDark, toggle };
}

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { isDark, toggle } = useTheme();
  const isMounted = useIsMounted();
  const label = t('common.toggleTheme');

  return (
    <button
      className={cn('flex-center cursor-pointer transition duration-300 hover:scale-110', className)}
      aria-label={label}
      aria-pressed={isMounted ? isDark : undefined}
      title={label}
      type="button"
      onClick={(event) => toggle(event.currentTarget)}
    >
      <span className="inline-flex size-8 items-center justify-center">
        <Icon icon={isDark ? 'lucide:sun' : 'lucide:moon'} className="size-6" />
      </span>
    </button>
  );
}
