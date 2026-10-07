import { ErrorBoundary, ErrorFallback } from '@components/common';
import { LazyMotionProvider } from '@components/common/LazyMotionProvider';
import { microDampingPreset } from '@constants/anim/spring';
import { friendGroups, friendsData } from '@constants/friends-config';
import { useTranslation } from '@hooks/useTranslation';
import { groupFriendLinks } from '@lib/config/friends';
import { m } from 'motion/react';
import { useState } from 'react';
import FriendCard from './FriendCard';

export default function FriendsGrid() {
  const { t } = useTranslation();
  const grouped = friendGroups.length > 0;
  const sections = groupFriendLinks(friendsData, friendGroups).map(({ group, friends }) => ({
    id: group?.id ?? 'ungrouped',
    title: group?.title ?? t('friends.ungrouped'),
    description: group?.description,
    friends,
  }));
  const [activeFilter, setActiveFilter] = useState('all');

  if (!grouped) {
    return (
      <LazyMotionProvider>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="w-full">
            {/* Grid Container */}
            <div className="grid grid-cols-3 gap-6 md:grid-cols-2 md:gap-4 xl:grid-cols-4 xl:gap-8">
              {friendsData.map((friend, index) => (
                <FriendCard key={friend.url} friend={friend} index={index} />
              ))}
            </div>

            {/* Empty State */}
            {friendsData.length === 0 && (
              <m.div
                className="flex min-h-[300px] flex-col items-center justify-center text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, ...microDampingPreset }}
              >
                <h3 className="mb-2 font-bold text-3xl text-gray-700 dark:text-gray-300">The Void is Empty</h3>
                <p className="text-gray-500 text-lg dark:text-gray-400">Be the first to connect!</p>
              </m.div>
            )}
          </div>
        </ErrorBoundary>
      </LazyMotionProvider>
    );
  }

  const visibleSections = activeFilter === 'all' ? sections : sections.filter((section) => section.id === activeFilter);
  const globalIndex = (before: string) => sections.findIndex((section) => section.id === before);

  return (
    <LazyMotionProvider>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <div className="w-full">
          {/* In-page filter tabs; without JS every group is listed anyway (SSR renders all). */}
          <fieldset className="m-0 mb-6 flex min-w-0 flex-wrap gap-2 border-0 p-0" aria-label={t('friends.filterLabel')}>
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              aria-pressed={activeFilter === 'all'}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                activeFilter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {t('friends.all')}
              <sup className="ml-1">{friendsData.length}</sup>
            </button>
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveFilter(section.id)}
                aria-pressed={activeFilter === section.id}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  activeFilter === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {section.title}
                <sup className="ml-1">{section.friends.length}</sup>
              </button>
            ))}
          </fieldset>

          {visibleSections.map((section, offset) => {
            const flatIndex = activeFilter === 'all' ? offset : globalIndex(section.id);
            return (
              <section key={section.id} id={`friends-${section.id}`} className="scroll-mt-20">
                <h2 className="mb-3 flex items-baseline gap-2 font-semibold text-foreground text-lg">
                  <span>{section.title}</span>
                  <small className="text-muted-foreground text-sm">{section.friends.length}</small>
                </h2>
                {section.description && <p className="-mt-2 mb-3 text-muted-foreground text-sm">{section.description}</p>}
                {section.friends.length > 0 ? (
                  <div className="grid grid-cols-3 gap-6 md:grid-cols-2 md:gap-4 xl:grid-cols-4 xl:gap-8">
                    {section.friends.map((friend, index) => (
                      <FriendCard key={friend.url} friend={friend} index={flatIndex + index} />
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-32 flex-col items-center justify-center gap-1 rounded-2xl bg-muted/45 text-center">
                    <p className="font-semibold text-foreground">{t('friends.emptyGroupTitle')}</p>
                    <p className="text-muted-foreground text-sm">{t('friends.emptyGroupDescription')}</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </ErrorBoundary>
    </LazyMotionProvider>
  );
}
