/**
 * ActivityCard — one entry of the homepage latest-activity block.
 *
 * Matches the friend cards' simple CSS hover style (FriendCard.astro):
 * background color shift, border color shift, subtle shadow, icon micro-rotation,
 * arrow slide-in. No heavy 3D tilt or spotlight.
 */
import { Icon } from '@iconify/react';

interface ActivityCardProps {
  href: string;
  icon: string;
  label: string;
  dateText: string;
  dateTime: string;
  text: string;
}

export default function ActivityCard({ href, icon, label, dateText, dateTime, text }: ActivityCardProps) {
  return (
    <>
      <a href={href} className="activity-card">
        <span className="activity-card__icon">
          <Icon icon={icon} className="absolute inset-0 m-auto size-4.5 opacity-60" aria-hidden="true" />
        </span>

        <span className="activity-card__content">
          <strong className="activity-card__title">{text}</strong>
          <span className="activity-card__meta">
            {label} · <time dateTime={dateTime}>{dateText}</time>
          </span>
        </span>

        <Icon
          icon="ri:arrow-right-up-line"
          className="activity-card__arrow absolute top-2.5 right-2.5 size-3.5"
          aria-hidden="true"
        />
      </a>

      <style>{`
        .activity-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.875rem;
          min-width: 0;
          padding: 0.875rem 1rem;
          border-radius: 1rem;
          background: color-mix(in oklab, hsl(var(--muted)) 45%, hsl(var(--card)));
          box-shadow: inset 0 0 0 1px hsl(var(--border) / 0.6);
          color: hsl(var(--foreground));
          text-decoration: none;
          transition:
            background-color 240ms ease,
            box-shadow 240ms ease;
        }

        .activity-card:hover {
          background: color-mix(in oklab, hsl(var(--shoka-blue)) 10%, hsl(var(--card)));
          box-shadow:
            inset 0 0 0 1px color-mix(in oklab, hsl(var(--shoka-blue)) 40%, hsl(var(--border))),
            0 6px 16px -12px color-mix(in oklab, hsl(var(--shoka-blue)) 60%, transparent);
        }

        .activity-card__icon {
          position: relative;
          width: 2.25rem;
          height: 2.25rem;
          flex-shrink: 0;
          border-radius: 50%;
          background: hsl(var(--card));
          box-shadow:
            0 0 0 2px hsl(var(--card)),
            0 0 0 3.5px color-mix(in oklab, hsl(var(--shoka-blue)) 70%, transparent);
          transition:
            transform 420ms cubic-bezier(0.34, 1.4, 0.64, 1),
            box-shadow 240ms ease;
        }

        .activity-card:hover .activity-card__icon {
          transform: rotate(-8deg) scale(1.06);
          box-shadow:
            0 0 0 2px hsl(var(--card)),
            0 0 0 3.5px hsl(var(--shoka-blue)),
            0 4px 12px -6px color-mix(in oklab, hsl(var(--shoka-blue)) 60%, transparent);
        }

        .activity-card__content {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          gap: 0.25rem;
          padding-right: 1rem;
        }

        .activity-card__title {
          overflow: hidden;
          font-size: 0.9375rem;
          line-height: 1.4;
          color: hsl(var(--foreground));
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 200ms ease;
        }

        .activity-card:hover .activity-card__title {
          color: color-mix(in oklab, hsl(var(--shoka-blue)) 35%, hsl(var(--foreground)));
        }

        .activity-card__meta {
          overflow: hidden;
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .activity-card__arrow {
          color: color-mix(in oklab, hsl(var(--shoka-blue)) 70%, hsl(var(--foreground)));
          opacity: 0;
          transform: translate(-4px, 4px);
          transition:
            transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
            opacity 200ms ease;
        }

        .activity-card:hover .activity-card__arrow {
          opacity: 1;
          transform: translate(0, 0);
        }
      `}</style>
    </>
  );
}
