/**
 * Shared paper-plane geometry for the click burst and the ToC ribbon progress mark.
 * One plane silhouette in a 20×24 box, nose toward the upper right (it reads as
 * "sent/flying" on the ribbon and matches the burst's upward toss).
 */

export const PETAL_VIEWBOX = { width: 20, height: 24 } as const;

const PETAL_PATH = 'M1.5 11.2 18.5 1.5 12.6 22.3 9.4 13.6Z';

/** Tip and base colors per variant; the gradient runs from the nose to the tail. */
export const PETAL_COLORS: ReadonlyArray<readonly [tip: string, base: string]> = [
  ['#e0f2fe', '#60a5fa'],
  ['#eff6ff', '#93c5fd'],
  ['#dbeafe', '#3b82f6'],
  ['#f0f9ff', '#7dd3fc'],
];

/**
 * Pre-render every color variant once so each frame is only a `drawImage` per petal.
 * `scale` is the device-pixel size of one viewBox unit.
 */
export function createPetalSprites(scale: number): HTMLCanvasElement[] {
  const path = new Path2D(PETAL_PATH);
  return PETAL_COLORS.map(([tip, base]) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(PETAL_VIEWBOX.width * scale);
    canvas.height = Math.ceil(PETAL_VIEWBOX.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.scale(scale, scale);
    const gradient = ctx.createLinearGradient(10, 0, 10, 24);
    gradient.addColorStop(0, tip);
    gradient.addColorStop(1, base);
    ctx.fillStyle = gradient;
    ctx.fill(path);
    return canvas;
  });
}

/** CSS mask for DOM petals (the click burst), matching the canvas shape. */
export const PETAL_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${PETAL_VIEWBOX.width} ${PETAL_VIEWBOX.height}'><path d='${PETAL_PATH}'/></svg>`,
)}")`;
