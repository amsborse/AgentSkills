/**
 * Pixel map of the generated hero art plate (public/hero/plate-*.webp, 1672x941).
 *
 * The dark and light plates share one composition, so every live layer (shader
 * effects, route paths, hotspots, callouts) is placed in these plate pixels and
 * scaled with the image. Positions were measured on the plate itself; the plate is
 * an illustration, and the module assignment below is a reading aid, not a claim
 * about any real system.
 */
import type { ServiceId } from "./topology";

export const PLATE_W = 1672;
export const PLATE_H = 941;

export interface PlatePoint {
  x: number;
  y: number;
}

export interface PlateRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Where each service sits on the plate: four ring modules, three on the island. */
export const PLATE_MODULES: Readonly<Record<ServiceId, PlatePoint>> = {
  gateway: { x: 923, y: 243 },
  policy: { x: 1317, y: 207 },
  ingest: { x: 1022, y: 541 },
  orchestrator: { x: 953, y: 492 },
  inference: { x: 1399, y: 416 },
  storage: { x: 1148, y: 572 },
  observability: { x: 1240, y: 596 },
};

export const PLATE_SPHERE = { x: 1130, y: 343, r: 92 } as const;
export const PLATE_RINGS: PlateRect = { x0: 770, y0: 118, x1: 1452, y1: 480 };
export const PLATE_FALLS: readonly PlateRect[] = [
  { x0: 898, y0: 605, x1: 1008, y1: 722 },
  { x0: 1036, y0: 645, x1: 1146, y1: 735 },
];
export const PLATE_HORIZON_Y = 712;
export const PLATE_RIPPLE: PlatePoint = { x: 1000, y: 716 };
export const PLATE_BEAM = { x: 1148, y0: 436, y1: 576 } as const;

/** The part of the plate that must stay visible on narrow screens. */
export const PLATE_FOCUS: PlateRect = { x0: 640, y0: 100, x1: 1470, y1: 770 };

export interface StageFit {
  /** CSS px per plate px. */
  scale: number;
  /** Stage offset inside the container, CSS px. */
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Up to this share of the container height may go uncovered at the top, so desktop
 * frames the full plate width like the reference instead of zooming in to cover height.
 * The plate's sky fades into the page background there.
 */
const TOP_SLACK = 0.1;

/**
 * Place the plate inside a container like `object-fit: cover`, but anchored on the
 * focus rect: the sculpture stays as centred as the cover crop allows, and when the
 * cover crop would cut into it the plate shrinks until the whole focus rect fits.
 * A plate shorter than the container sits on the bottom edge, so the lake meets the fold.
 */
export function fitPlate(width: number, height: number, focus: PlateRect = PLATE_FOCUS): StageFit {
  if (width <= 0 || height <= 0) return { scale: 0, x: 0, y: 0 };
  const cover = Math.max(width / PLATE_W, (height * (1 - TOP_SLACK)) / PLATE_H);
  const fitFocus = Math.min(width / (focus.x1 - focus.x0), height / (focus.y1 - focus.y0));
  const scale = Math.min(cover, fitFocus);
  const w = PLATE_W * scale;
  const h = PLATE_H * scale;
  const cx = ((focus.x0 + focus.x1) / 2) * scale;
  const cy = ((focus.y0 + focus.y1) / 2) * scale;
  const place = (size: number, content: number, centre: number, slack: number) =>
    content <= size ? (size - content) * slack : clamp(size / 2 - centre, size - content, 0);
  return { scale, x: place(width, w, cx, 0.5), y: place(height, h, cy, 1) };
}

/** Plate pixel → percentage of the plate, for CSS positioning. */
export const platePercent = (point: PlatePoint) => ({
  left: `${(point.x / PLATE_W) * 100}%`,
  top: `${(point.y / PLATE_H) * 100}%`,
});

/** Quadratic curve between two modules, bowed away from the core so paths read as routes. */
export function edgeCurve(from: ServiceId, to: ServiceId) {
  const a = PLATE_MODULES[from];
  const b = PLATE_MODULES[to];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  let nx = mx - PLATE_SPHERE.x;
  let ny = my - PLATE_SPHERE.y;
  let n = Math.hypot(nx, ny);
  if (n < 1) {
    nx = -(b.y - a.y);
    ny = b.x - a.x;
    n = Math.hypot(nx, ny) || 1;
  }
  const bow = length * 0.22;
  return { a, b, c: { x: mx + (nx / n) * bow, y: my + (ny / n) * bow } };
}
