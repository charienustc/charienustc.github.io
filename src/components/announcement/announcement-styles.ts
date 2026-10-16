/**
 * Shared visual mappings for announcements.
 *
 * Each announcement resolves an accent color (explicit `color` override, then
 * per-type default) and an icon from its `type`. Used by both the top banner
 * and the list popup so the two surfaces stay consistent.
 */

import type { Announcement } from '@/types/announcement';

const typeStyles: Record<string, { color: string; icon: string }> = {
  info: { color: '#3b82f6', icon: 'lucide:info' },
  warning: { color: '#eab308', icon: 'lucide:triangle-alert' },
  success: { color: '#22c55e', icon: 'lucide:circle-check' },
  important: { color: '#ef4444', icon: 'lucide:circle-alert' },
};

export function getAnnouncementColor(announcement: Announcement): string {
  if (announcement.color) return announcement.color;
  const type = announcement.type ?? 'info';
  return typeStyles[type]?.color ?? typeStyles.info.color;
}

export function getAnnouncementIcon(announcement: Announcement): string {
  const type = announcement.type ?? 'info';
  return typeStyles[type]?.icon ?? typeStyles.info.icon;
}
