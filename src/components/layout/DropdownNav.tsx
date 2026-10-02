import Popover from '@components/ui/popover';
import type { Router } from '@constants/router';
import { Icon } from '@iconify/react';
import { cn } from '@lib/utils';
import { memo, useCallback, useState } from 'react';
import { defaultLocale, localizedPath, resolveNavName, stripLocaleFromPath, t } from '@/i18n';

interface DropdownNavProps {
  item: Router;
  currentPath: string;
  className?: string;
  locale?: string;
}

const DropdownNavComponent = ({ item, currentPath, className, locale = defaultLocale }: DropdownNavProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { icon, children } = item;
  const name = resolveNavName(item.nameKey, item.name, locale);

  const strippedPath = stripLocaleFromPath(currentPath);
  const hasActiveChild = children?.some((child) => child.path && child.path === strippedPath) ?? false;

  const renderDropdownContent = useCallback(
    () => (
      <div className="nav-dropdown flex flex-col">
        {children?.length
          ? children.map((child: Router, index) => {
              const childName = resolveNavName(child.nameKey, child.name, locale);
              const childUrl = child.path
                ? child.localeIndependent
                  ? child.path
                  : localizedPath(child.path, locale)
                : child.path;
              return (
                <a
                  key={child.path}
                  href={childUrl}
                  className={cn(
                    'group px-4 py-2 text-base outline-hidden transition-colors duration-300 hover:bg-gradient-shoka-button',
                    {
                      'rounded-t-xl': index === 0,
                      'rounded-b-xl': index === children.length - 1,
                      'bg-gradient-shoka-button text-muted': strippedPath === child.path,
                    },
                  )}
                >
                  <div className="flex items-center gap-2 text-white transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white">
                    {child.icon && <Icon icon={child.icon} className="size-4" />}
                    {childName}
                  </div>
                </a>
              );
            })
          : null}
      </div>
    ),
    [children, strippedPath, locale],
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} placement="bottom-start" trigger="hover" render={renderDropdownContent}>
      <button
        type="button"
        className={cn('inline-flex h-10 items-center px-3 py-2 text-base tracking-wider', className)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-current={hasActiveChild ? 'page' : undefined}
        aria-label={t(locale, 'common.menuLabel', { name })}
      >
        {icon && (
          <span className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <Icon icon={icon} className="h-4 w-4" />
          </span>
        )}
        {name}
      </button>
    </Popover>
  );
};

// Memoize component for performance
const DropdownNav = memo(DropdownNavComponent);

export default DropdownNav;
