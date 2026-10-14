/**
 * ActivityCard — one entry of the homepage latest-activity block.
 *
 * Reuses the friend cards' motion verbatim: magnetic 3D tilt, a
 * cursor-following spotlight, and a blurred border glow that fades in on
 * hover — tinted site-blue instead of the friend cards' per-link colour.
 */
import { LazyMotionProvider } from '@components/common/LazyMotionProvider';
import { microDampingPreset } from '@constants/anim/spring';
import { Icon } from '@iconify/react';
import { m, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { type MouseEvent, useRef } from 'react';

interface ActivityCardProps {
  href: string;
  icon: string;
  label: string;
  dateText: string;
  dateTime: string;
  text: string;
}

export default function ActivityCard({ href, icon, label, dateText, dateTime, text }: ActivityCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);

  // Motion values for magnetic hover
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring animation for smooth magnetic effect
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [15, -15]), microDampingPreset);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-15, 15]), microDampingPreset);

  // Spotlight effect
  const sheenX = useTransform(x, [-0.5, 0.5], ['0%', '100%']);
  const sheenY = useTransform(y, [-0.5, 0.5], ['0%', '100%']);

  const spotlight = useMotionTemplate`radial-gradient(
    600px circle at ${sheenX} ${sheenY},
    rgba(255,255,255,0.15),
    transparent 40%
  )`;

  const handleMouseMove = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const offsetX = (e.clientX - centerX) / rect.width;
    const offsetY = (e.clientY - centerY) / rect.height;

    x.set(offsetX);
    y.set(offsetY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <LazyMotionProvider>
      <m.a
        href={href}
        ref={cardRef}
        className="group relative block w-full cursor-pointer select-none"
        style={{ perspective: '1000px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <m.div
          className="relative w-full rounded-2xl bg-white p-3 shadow-xl ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10"
          style={{
            transformStyle: 'preserve-3d',
            rotateX,
            rotateY,
          }}
        >
          <div className="relative overflow-hidden rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-900">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Icon icon={icon} className="size-3.5 opacity-60" aria-hidden="true" />
              <span>{label}</span>
              <span className="opacity-50">·</span>
              <time dateTime={dateTime}>{dateText}</time>
            </div>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm/6">
              <span className="truncate transition-colors group-hover:text-primary">{text}</span>
              <Icon
                icon="ri:arrow-right-line"
                className="size-3.5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </p>
          </div>

          {/* Spotlight Overlay */}
          <m.div
            className="pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background: spotlight,
            }}
          />

          {/* Border Glow */}
          <div className="absolute inset-0 -z-10 rounded-2xl bg-blue opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-60" />
        </m.div>
      </m.a>
    </LazyMotionProvider>
  );
}
