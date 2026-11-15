// Spring easing for CSS. A damped spring is solved exactly and written as a linear() easing
// with its own duration, so a transition can feel physical with no JavaScript at run time.
//
//   node spring.mjs --stiffness 300 --damping 20 [--mass 1] [--velocity 0] [--name spring]
//
// prints the custom properties. Browsers without linear() need the cubic-bezier fallback that
// the spring-states recipe declares first.
import { pathToFileURL } from 'node:url';

// Position of a spring released at 0 heading for 1, at time t (seconds).
export function springAt(t, { mass = 1, stiffness = 170, damping = 26, velocity = 0 } = {}) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0 - velocity) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + (w0 - velocity) * t);
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - s);
  const r2 = -w0 * (zeta + s);
  const a = (-velocity - r2) / (r1 - r2);
  return 1 - (a * Math.exp(r1 * t) + (1 - a) * Math.exp(r2 * t));
}

// Time (ms) after which the spring stays within `rest` of its target.
export function settleTime(spring, rest = 0.001, maxMs = 10000) {
  let last = 0;
  for (let ms = 0; ms <= maxMs; ms += 2) if (Math.abs(springAt(ms / 1000, spring) - 1) > rest) last = ms;
  if (last >= maxMs) throw new Error('spring does not settle within 10 s: raise damping');
  return last + 2;
}

// Drop samples a straight line between their neighbours already describes.
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  let worst = 0;
  let at = 0;
  const [x0, y0] = points[0];
  const [x1, y1] = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const d = Math.abs(y - (y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)));
    if (d > worst) { worst = d; at = i; }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)];
}

export function springLinear(spring = {}, { tolerance = 0.0025, rest = 0.001 } = {}) {
  for (const k of ['mass', 'stiffness', 'damping']) if (spring[k] !== undefined && !(spring[k] > 0)) throw new Error(`${k} must be a positive number`);
  const settle = settleTime(spring, rest);
  const duration = Math.ceil(settle / 10) * 10;
  const n = Math.max(24, Math.min(240, Math.round(duration / 4)));
  const raw = Array.from({ length: n + 1 }, (_, i) => [i / n, springAt(((i / n) * duration) / 1000, spring)]);
  raw[0][1] = 0;
  raw[n][1] = 1;
  const points = simplify(raw, tolerance);
  const fmt = (v) => String(Math.round(v * 1000) / 1000);
  const stops = points.map(([x, y], i) => (i === 0 || i === points.length - 1 ? fmt(y) : `${fmt(y)} ${Math.round(x * 1000) / 10}%`));
  return { easing: `linear(${stops.join(', ')})`, duration, points, overshoot: Math.max(...raw.map((p) => p[1])) - 1 };
}

export function springCss(name, spring, options) {
  const s = springLinear(spring, options);
  return `--${name}: ${s.easing};\n--${name}-duration: ${s.duration}ms;`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const get = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
  try {
    const spring = { mass: Number(get('mass', 1)), stiffness: Number(get('stiffness', 170)), damping: Number(get('damping', 26)), velocity: Number(get('velocity', 0)) };
    console.log(springCss(get('name', 'spring'), spring));
  } catch (e) { console.error(e.message); process.exit(1); }
}
