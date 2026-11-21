// Porto Verde's map: roads, buildings, parks, trees and named places.
// Generated once from a seed so the city is the same every visit. Buildings are
// axis-aligned boxes; collision is a plain AABB test against them.
import { ROADS_X, ROADS_Y, ROAD_HALF, WORLD, PALETTE } from './config.js';

export function roadAt(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let bestX = ROADS_X[0];
  let bestY = ROADS_Y[0];
  for (const rx of ROADS_X) if (Math.abs(rx - x) < Math.abs(bestX - x)) bestX = rx;
  for (const ry of ROADS_Y) if (Math.abs(ry - y) < Math.abs(bestY - y)) bestY = ry;
  return Math.abs(bestX - x) < Math.abs(bestY - y) ? { x: bestX, y } : { x, y: bestY };
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  // One building per block cell, inset from the roads, with a jittered footprint.
  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const x0 = ROADS_X[ix] + ROAD_HALF + 14;
      const y0 = ROADS_Y[iy] + ROAD_HALF + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_HALF - 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const roll = random();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = 5 + Math.floor(random() * 6);
        for (let t = 0; t < count; t += 1) {
          trees.push({ x: x0 + 30 + random() * (x1 - x0 - 60), y: y0 + 30 + random() * (y1 - y0 - 60), r: 12 + random() * 8 });
        }
        continue;
      }
      const bw = 90 + random() * Math.max(20, (x1 - x0) - 200);
      const bh = 80 + random() * Math.max(20, (y1 - y0) - 180);
      const bx = x0 + random() * Math.max(1, (x1 - x0) - bw);
      const by = y0 + random() * Math.max(1, (y1 - y0) - bh);
      buildings.push({
        x: bx, y: by, w: bw, h: bh,
        color: PALETTE.building[Math.floor(random() * PALETTE.building.length)],
        floors: 1 + Math.floor(random() * 4),
      });
    }
  }
  // Beach trees along the marina strip.
  for (let t = 0; t < 26; t += 1) {
    trees.push({ x: 60 + random() * (WORLD.width - 120), y: 2060 + random() * 90, r: 11 + random() * 7 });
  }
  // Traffic-light intersections (one per grid crossing).
  const lights = [];
  for (const rx of ROADS_X) for (const ry of ROADS_Y) lights.push({ x: rx, y: ry, phase: (rx + ry) % 2 });
  return { buildings, trees, parks, lights };
}

export function collidesBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of any building it overlaps; returns true if it hit one.
export function resolveBuildingCollision(city, p, r) {
  const b = collidesBuilding(city, p.x, p.y, r);
  if (!b) return false;
  const left = p.x + r - b.x;
  const right = b.x + b.w - (p.x - r);
  const top = p.y + r - b.y;
  const bottom = b.y + b.h - (p.y - r);
  const min = Math.min(left, right, top, bottom);
  if (min === left) p.x = b.x - r;
  else if (min === right) p.x = b.x + b.w + r;
  else if (min === top) p.y = b.y - r;
  else p.y = b.y + b.h + r;
  return true;
}

export function clampWorld(p, r) {
  p.x = Math.max(r, Math.min(WORLD.width - r, p.x));
  p.y = Math.max(r, Math.min(WORLD.height - r, p.y));
}
