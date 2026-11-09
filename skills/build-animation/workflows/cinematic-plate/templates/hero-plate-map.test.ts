import { describe, expect, it } from "vitest";
import {
  PLATE_FOCUS,
  PLATE_H,
  PLATE_MODULES,
  PLATE_SPHERE,
  PLATE_W,
  edgeCurve,
  fitPlate,
} from "@/components/hero/plateMap";
import { FRAGMENT } from "@/components/hero/plateGL";
import { SERVICES } from "@/components/hero/topology";

describe("hero plate map", () => {
  it("places every service inside the plate", () => {
    for (const service of SERVICES) {
      const point = PLATE_MODULES[service.id];
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(PLATE_W);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(PLATE_H);
    }
  });

  // Regression: at 1440x900 a strict height cover blew the plate up ~11%, pushing the
  // bonsai into the copy and the right-hand callouts off screen. The reference frames the
  // whole plate width, so a short vertical shortfall is taken at the top (sky) instead.
  it("frames the full plate width on a desktop viewport, lake at the bottom", () => {
    const fit = fitPlate(1440, 900);
    expect(fit.scale).toBeCloseTo(1440 / PLATE_W, 3);
    expect(fit.x).toBeCloseTo(0, 3);
    expect(fit.y + PLATE_H * fit.scale).toBeCloseTo(900, 1);
    expect(fit.y).toBeLessThan(100);
  });

  it("still covers a wide desktop viewport edge to edge", () => {
    const fit = fitPlate(1920, 980);
    expect(fit.x).toBeLessThanOrEqual(0);
    expect(PLATE_W * fit.scale + fit.x).toBeGreaterThanOrEqual(1920 - 0.5);
    expect(fit.y).toBeLessThanOrEqual(0.5);
  });

  it("shrinks below cover on a narrow band so the whole sculpture fits", () => {
    const fit = fitPlate(390, 600);
    const cover = Math.max(390 / PLATE_W, 600 / PLATE_H);
    expect(fit.scale).toBeLessThan(cover);
    expect(fit.x + PLATE_FOCUS.x0 * fit.scale).toBeGreaterThanOrEqual(-0.5);
    expect(fit.x + PLATE_FOCUS.x1 * fit.scale).toBeLessThanOrEqual(390.5);
    expect(fit.y + PLATE_FOCUS.y0 * fit.scale).toBeGreaterThanOrEqual(-0.5);
    expect(fit.y + PLATE_FOCUS.y1 * fit.scale).toBeLessThanOrEqual(600.5);
  });

  it("returns a zero fit for an empty container", () => {
    expect(fitPlate(0, 400)).toEqual({ scale: 0, x: 0, y: 0 });
  });

  it("bows route curves away from the core", () => {
    const { a, b, c } = edgeCurve("gateway", "inference");
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dist = (p: { x: number; y: number }) =>
      Math.hypot(p.x - PLATE_SPHERE.x, p.y - PLATE_SPHERE.y);
    expect(dist(c)).toBeGreaterThan(dist(mid));
  });

  // Regression: the core twinkle used per-16px-cell random phases, which showed as hard
  // square blocks on the bright underside of the sphere.
  it("keeps the core twinkle free of per-cell blocks", () => {
    expect(FRAGMENT).not.toMatch(/floor\(p \/ \d/);
  });
});
