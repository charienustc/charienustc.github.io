/**
 * AnnouncementBanner Component
 *
 * Shows the highest-priority unread announcement as a full-width banner at the
 * top of the page. Unlike the old toast, closing the banner means "got it":
 * the announcement is marked as read so it does not come back on the next
 * page. Less urgent unread announcements remain reachable through the footer
 * announcement list.
 */

import { LazyMotionProvider } from '@components/common/LazyMotionProvider';
import { useTranslation } from '@hooks/useTranslation';
import { Icon } from '@iconify/react';
import { useStore } from '@nanostores/react';
import { announcementInitialized, markAsRead, openAnnouncementList, unreadAnnouncements } from '@store/announcement';
import { AnimatePresence, m } from 'motion/react';
import type { CSSProperties } from 'react';
import type { Announcement } from '@/types/announcement';
import { getAnnouncementColor, getAnnouncementIcon } from './announcement-styles';

function BannerContent({ announcement }: { announcement: Announcement }) {
  const { t } = useTranslation();
  const color = getAnnouncementColor(announcement);
  const icon = getAnnouncementIcon(announcement);

  const style = {
    backgroundColor: `color-mix(in oklab, ${color} 9%, hsl(var(--card)))`,
    borderBottom: `1px solid color-mix(in oklab, ${color} 25%, transparent)`,
  } satisfies CSSProperties;

  const handleClose = () => {
    // A banner reappears on every page load until read, so unlike the old
    // toast dismiss, closing it records the read state on purpose.
    markAsRead(announcement.id);
  };

  return (
    <m.div
      className="relative z-40"
      style={style}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      role="region"
      aria-label={t('announcement.title')}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-2 md:gap-3">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full md:h-7 md:w-7"
          style={{ backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)` }}
        >
          <Icon icon={icon} className="h-3.5 w-3.5 md:h-4 md:w-4" style={{ color }} />
        </span>

        <div className="flex min-w-0 flex-1 items-baseline gap-2 md:gap-3">
          <span className="truncate font-semibold text-sm md:text-base">{announcement.title}</span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">{announcement.content}</span>
        </div>

        {announcement.link && (
          <a
            href={announcement.link.url}
            target={announcement.link.external ? '_blank' : undefined}
            rel={announcement.link.external ? 'noopener noreferrer' : undefined}
            className="hidden shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs transition-opacity hover:opacity-80 sm:inline-flex md:text-sm"
            style={{
              backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
              color,
            }}
          >
            {announcement.link.text ?? t('announcement.learnMore')}
            {announcement.link.external && <Icon icon="lucide:external-link" className="h-3 w-3" />}
          </a>
        )}

        <button
          type="button"
          onClick={openAnnouncementList}
          className="shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors hover:bg-black/5 md:text-sm dark:hover:bg-white/10"
          style={{ color }}
        >
          {t('announcement.viewAll')}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 rounded-full p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          aria-label={t('announcement.dismiss')}
        >
          <Icon icon="lucide:x" className="h-4 w-4" />
        </button>
      </div>
    </m.div>
  );
}

export default function AnnouncementBanner() {
  const initialized = useStore(announcementInitialized);
  const unread = useStore(unreadAnnouncements);

  if (!initialized || unread.length === 0) return null;

  return (
    <LazyMotionProvider>
      <AnimatePresence>{unread[0] && <BannerContent key={unread[0].id} announcement={unread[0]} />}</AnimatePresence>
    </LazyMotionProvider>
  );
}
