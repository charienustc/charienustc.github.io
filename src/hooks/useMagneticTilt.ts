/**
 * Magnetic 3D tilt driven by pointer position.
 *
 * Tracks the pointer inside a card, normalises it to [-0.5, 0.5] on both axes
 * around the card's centre, and turns that into spring-damped `rotateX` /
 * `rotateY` plus a highlight that follows the cursor.
 *
 * Mirrors the tilt the friend cards get from `FriendCard`, so the two surfaces
 * share one feel instead of drifting apart. Attach the returned handlers to the
 * element whose rect the tilt should be measured against, spread `wrapperStyle`
 * onto the outer element (it owns `perspective`) and `layerStyle` onto the child
 * that should rotate.
 */

import { microDampingPreset } from '@constants/anim/spring';
import { type MotionStyle, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useCallback } from 'react';

export interface UseMagneticTiltOptions {
  /** Peak rotation in degrees at the card's edge; reached on corner hover. */
  maxRotate?: number;
  /** Perspective distance applied to the wrapper. */
  perspective?: string;
}

export interface UseMagneticTiltResult {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  /** Motion style for the outer element; carries `perspective`. */
  wrapperStyle: MotionStyle;
  /** Motion style for the rotating layer; carries the `rotateX` / `rotateY` springs. */
  layerStyle: MotionStyle;
  /** Motion style for the highlight overlay; keeps the cursor-following gradient. */
  highlightStyle: MotionStyle;
}

const DEFAULT_PERSPECTIVE = '1000px';
/** Matches the friend cards so both surfaces tilt identically. */
const DEFAULT_MAX_ROTATE = 8;

export function useMagneticTilt({
  maxRotate = DEFAULT_MAX_ROTATE,
  perspective = DEFAULT_PERSPECTIVE,
}: UseMagneticTiltOptions = {}): UseMagneticTiltResult {
  // Normalised pointer position, [-0.5, 0.5] from the card's centre.
  // Seeded at 0 (dead centre) rather than left undefined so the derived
  // highlight below resolves to a valid percentage on the very first render.
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [maxRotate, -maxRotate]), microDampingPreset);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-maxRotate, maxRotate]), microDampingPreset);

  // Cursor position as a CSS custom property pair. Exposed as variables rather
  // than a whole `backgroundImage` string so CSS owns the gradient itself: the
  // server and the client then agree on the pre-hydration paint, and Motion only
  // has to ship two short percentages instead of re-serialising a full gradient
  // every frame.
  const highlightX = useMotionTemplate`${useTransform(x, [-0.5, 0.5], ['0%', '100%'])}`;
  const highlightY = useMotionTemplate`${useTransform(y, [-0.5, 0.5], ['0%', '100%'])}`;

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      x.set((e.clientX - (rect.left + rect.width / 2)) / rect.width);
      y.set((e.clientY - (rect.top + rect.height / 2)) / rect.height);
    },
    [x, y],
  );

  const onPointerLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return {
    onPointerMove,
    onPointerLeave,
    wrapperStyle: { perspective },
    layerStyle: { transformStyle: 'preserve-3d', rotateX, rotateY },
    // Typed as a plain object: these are custom properties, which `MotionStyle`
    // does not model, and both values are consumed by the `.magnetic-highlight`
    // rule rather than by the element's own `background`.
    highlightStyle: {
      '--magnetic-x': highlightX,
      '--magnetic-y': highlightY,
    } as MotionStyle,
  };
}
