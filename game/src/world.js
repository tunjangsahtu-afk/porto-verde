// Porto Verde simulation: no drawing, no browser in it. Player on foot and in
// cars, traffic AI, pedestrians, police and the wanted system, combat, pickups,
// particles, the day clock and the five-mission story. step() advances one fixed
// step and returns what happened as bit flags.
import { CAR, GUN, HIDEOUT, PLAYER, POLICE, ROADS_X, ROADS_Y, ROAD_HALF, WANTED_MAX, WORLD } from './config.js';
import { clampWorld, collidesBuilding, createCity, nearestRoadPoint, resolveBuildingCollision, roadAt } from './city.js';
import { MISSIONS } from './missions.js';

export const EVENT_HIT = 1;
export const EVENT_SHOT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_MISSION = 8;
export const EVENT_BUSTED = 16;
export const EVENT_WASTED = 32;
export const EVENT_WIN = 64;
export const EVENT_CRIME = 128;

const CAR_COLORS = ['#d84a4a', '#4a7ad8', '#e8b73a', '#4ad87a', '#8a4ad8', '#d8d8d8', '#e07a2a', '#2a9d8f', '#c0c0c0', '#7a3a5a'];
const PED_COLORS = ['#e8e0d0', '#7ab0d8', '#d87ab0', '#a8d87a', '#d8a05a', '#9a8ad8'];

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    city,
    player: { x: HIDEOUT.x, y: HIDEOUT.y, angle: 0, health: PLAYER.health, money: 150, ammo: GUN.startAmmo, car: null, speed: 0, invulnerable: 0, moving: false },
    cars: [],
    peds: [],
    police: [],
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    wanted: 0,
    wantedTimer: 0,
    policeTimer: 3,
    lightTimer: 0,
    lightsNS: true,
    clock: 10,
    elapsed: 0,
    missionIndex: 0,
    missionStep: 0,
    missionTimer: 0,
    missionDone: 0,
    banner: null,
    bannerT: 0,
    stats: { stolen: 0, crimes: 0, earned: 0 },
    won: false,
    over: null,
    defeatCount: 0,
    defeatNeed: 0,
  };

  function showBanner(title, text, dur) {
    state.banner = { title, text };
    state.bannerT = dur || 4;
  }

  function spawnCar(x, y, angle, traffic, color) {
    const car = { x, y, angle, speed: traffic ? 120 + random() * 80 : 0, color: color || CAR_COLORS[Math.floor(random() * CAR_COLORS.length)], traffic: !!traffic, driver: traffic ? 'traffic' : 'none', health: CAR.health, axis: 'x', dir: 1, lane: 0, stuck: 0 };
    if (traffic) {
      const onX = Math.abs(x - nearestRoadPoint(x, y).x) < 5;
      car.axis = onX ? 'y' : 'x';
      car.dir = random() < 0.5 ? 1 : -1;
      car.lane = (random() < 0.5 ? -1 : 1) * 18;
    }
    state.cars.push(car);
    return car;
  }

  function spawnPed(x, y) {
    const p = { x, y, angle: random() * Math.PI * 2, speed: 55 + random() * 40, tx: x, ty: y, flee: 0, color: PED_COLORS[Math.floor(random() * PED_COLORS.length)] };
    pickPedTarget(p);
    state.peds.push(p);
    return p;
  }

  function pickPedTarget(p) {
    const rp = nearestRoadPoint(p.x, p.y);
    const along = random() * 600 - 300;
    if (Math.abs(rp.x - p.x) < 5) { p.tx = rp.x + (random() < 0.5 ? -58 : 58); p.ty = clamp(p.y + along, 40, WORLD.height - 40); }
    else { p.tx = clamp(p.x + along, 40, WORLD.width - 40); p.ty = rp.y + (random() < 0.5 ? -58 : 58); }
  }

  function spawnTraffic() {
    for (let i = 0; i < 14; i += 1) {
      const rx = ROADS_X[Math.floor(random() * ROADS_X.length)];
      const ry = ROADS_Y[Math.floor(random() * ROADS_Y.length)];
      const horizontal = random() < 0.5;
      spawnCar(horizontal ? 120 + random() * (WORLD.width - 240) : rx, horizontal ? ry : 120 + random() * (WORLD.height - 240), horizontal ? 0 : Math.PI / 2, true);
    }
    // Parked cars along roads, ready to steal.
    const spots = [[420, 245], [820, 245], [1220, 245], [1620, 245], [245, 820], [245, 1220], [2020, 245], [245, 1620], [2820, 645], [645, 2020]];
    for (const [x, y] of spots) spawnCar(x, y, random() < 0.5 ? 0 : Math.PI / 2, false);
  }

  function spawnPeds() {
    for (let i = 0; i < 22; i += 1) {
      spawnPed(120 + random() * (WORLD.width - 240), 120 + random() * (WORLD.height - 240));
    }
  }

  function addCashPickups() {
    const spots = [[800, 800], [2000, 1200], [1200, 2000], [2600, 1600], [600, 1600], [2800, 400]];
    for (const [x, y] of spots) state.pickups.push({ x, y, kind: 'cash', amount: 25 + Math.floor(random() * 75) });
    state.pickups.push({ x: 900, y: 1500, kind: 'health', amount: 50 });
    state.pickups.push({ x: 2200, y: 800, kind: 'health', amount: 50 });
    state.pickups.push({ x: 1400, y: 1800, kind: 'ammo', amount: 24 });
    state.pickups.push({ x: 2600, y: 1000, kind: 'ammo', amount: 24 });
  }

  function spawnEnemies(kind, cx, cy, count) {
    state.enemies = [];
    state.defeatCount = 0;
    state.defeatNeed = count;
    for (let i = 0; i < count; i += 1) {
      state.enemies.push({ x: cx + (random() * 160 - 80), y: cy + (random() * 160 - 80), angle: 0, health: 60, alive: true, kind, shootTimer: 1 + random(), speed: 130 });
    }
  }

  function startMission(index) {
    const m = MISSIONS[index];
    if (!m) return;
    state.missionStep = 0;
    state.missionTimer = m.timeLimit || 0;
    state.enemies = [];
    showBanner(m.title, m.brief, 5);
    if (m.id === 'heist') state.pickups.push({ x: 2400, y: 2150, kind: 'crate', amount: 0 });
    if (m.id === 'score') state.pickups.push({ x: 1500, y: 500, kind: 'vault', amount: 0 });
  }

  function addWanted(n) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, WANTED_MAX);
    if (state.wanted > before) state.wantedTimer = 0;
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      const s = (0.3 + random() * 0.7) * (speed || 160);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + random() * 0.5, max: 0.9, color, size: 2 + random() * 3 });
    }
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const c of state.cars) {
      const d = dist(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function carFrontRear(c) {
    const dx = Math.cos(c.angle);
    const dy = Math.sin(c.angle);
    return [{ x: c.x + dx * 20, y: c.y + dy * 20 }, { x: c.x - dx * 20, y: c.y - dy * 20 }];
  }

  function moveCar(c, dt) {
    const dx = Math.cos(c.angle);
    const dy = Math.sin(c.angle);
    c.x += dx * c.speed * dt;
    c.y += dy * c.speed * dt;
    clampWorld(c, 40);
    for (const p of carFrontRear(c)) {
      if (resolveBuildingCollision(city, p, 16)) {
        c.speed *= 0.4;
        if (Math.abs(c.speed) > 200) { c.health -= 8; burst(p.x, p.y, '#f2c94c', 6, 120); }
        c.x += (p.x - (c.x + dx * 20)) * 0.2;
        c.y += (p.y - (c.y + dy * 20)) * 0.2;
      }
    }
  }

  function drivePlayerCar(c, dt, ctl) {
    const fwd = (ctl.up ? 1 : 0) - (ctl.down ? 1 : 0);
    if (fwd > 0) c.speed += CAR.accel * dt;
    else if (fwd < 0) {
      if (c.speed > 5) c.speed -= CAR.brake * dt;
      else c.speed -= CAR.accel * 0.55 * dt;
    } else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 180 * dt);
    c.speed = clamp(c.speed, -CAR.reverseMax, CAR.maxSpeed);
    const steer = (ctl.left ? -1 : 0) + (ctl.right ? 1 : 0);
    if (steer !== 0 && Math.abs(c.speed) > 8) {
      c.angle += steer * CAR.turnRate * dt * clamp(Math.abs(c.speed) / 220, 0.25, 1) * Math.sign(c.speed);
    }
    moveCar(c, dt);
    state.player.x = c.x;
    state.player.y = c.y;
    state.player.angle = c.angle;
    state.player.speed = Math.abs(c.speed);
    if (c.health <= 0) {
      burst(c.x, c.y, '#ff7a3a', 26, 260);
      burst(c.x, c.y, '#555', 18, 160);
      state.cars.splice(state.cars.indexOf(c), 1);
      state.player.car = null;
      state.player.x = c.x + 50;
      state.player.y = c.y + 50;
      state.player.health -= 15;
      addWanted(1);
      return EVENT_HIT;
    }
    return 0;
  }

  function stepTraffic(dt) {
    state.lightTimer += dt;
    if (state.lightTimer > 8) { state.lightTimer = 0; state.lightsNS = !state.lightsNS; }
    for (const c of state.cars) {
      if (!c.traffic) continue;
      // Lane target: stay on its road, offset to the right-hand lane.
      let tx;
      let ty;
      if (c.axis === 'x') { tx = c.x + c.dir * 100; ty = (c.axis === 'x' ? nearestRoadPoint(c.x, c.y).y : c.y) + c.lane; }
      else { tx = nearestRoadPoint(c.x, c.y).x + c.lane; ty = c.y + c.dir * 100; }
      const wantAngle = Math.atan2(ty - c.y, tx - c.x);
      let da = wantAngle - c.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      c.angle += clamp(da, -1.8 * dt, 1.8 * dt);
      // Red light: stop before the next intersection on a red axis.
      let targetSpeed = 150;
      const rp = nearestRoadPoint(c.x, c.y);
      const dInter = dist(c.x, c.y, rp.x, rp.y);
      const redForMe = (c.axis === 'x' && state.lightsNS) || (c.axis === 'y' && !state.lightsNS);
      if (redForMe && dInter < 110 && dInter > 40) targetSpeed = 0;
      // Car ahead: slow down.
      for (const o of state.cars) {
        if (o === c) continue;
        const d = dist(c.x, c.y, o.x, o.y);
        const ahead = Math.cos(c.angle) * (o.x - c.x) + Math.sin(c.angle) * (o.y - c.y);
        if (d < 70 && ahead > 0) targetSpeed = Math.min(targetSpeed, 40);
      }
      c.speed += clamp(targetSpeed - c.speed, -260 * dt, 140 * dt);
      // Turn at an intersection sometimes.
      if (dInter < 26 && random() < 0.02) {
        c.axis = c.axis === 'x' ? 'y' : 'x';
        c.dir = random() < 0.5 ? 1 : -1;
        c.lane = (random() < 0.5 ? -1 : 1) * 18;
      }
      moveCar(c, dt);
      if (c.health <= 0) { burst(c.x, c.y, '#ff7a3a', 20, 220); c.traffic = false; c.speed = 0; c.health = 0; }
    }
    // Keep traffic topped up.
    if (state.cars.filter((c) => c.traffic).length < 10 && random() < 0.01) {
      const rx = ROADS_X[Math.floor(random() * ROADS_X.length)];
      const ry = ROADS_Y[Math.floor(random() * ROADS_Y.length)];
      spawnCar(rx, 120 + random() * 400, Math.PI / 2, true);
    }
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = Math.atan2(ped.y - p.y, ped.x - p.x);
        ped.x += Math.cos(a) * 200 * dt;
        ped.y += Math.sin(a) * 200 * dt;
      } else {
        const d = dist(ped.x, ped.y, ped.tx, ped.ty);
        if (d < 12) pickPedTarget(ped);
        else {
          const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
          ped.angle = a;
          ped.x += Math.cos(a) * ped.speed * dt;
          ped.y += Math.sin(a) * ped.speed * dt;
        }
      }
      clampWorld(ped, 20);
      resolveBuildingCollision(city, ped, 12);
    }
  }

  function spawnPolice() {
    const p = state.player;
    const a = random() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(a) * 620, 60, WORLD.width - 60);
    const y = clamp(p.y + Math.sin(a) * 620, 60, WORLD.height - 60);
    const rp = nearestRoadPoint(x, y);
    if (state.wanted >= 2 && random() < 0.6) {
      const car = spawnCar(rp.x, rp.y, 0, false, '#e8e8e8');
      car.driver = 'police';
      state.police.push({ x: car.x, y: car.y, angle: 0, mode: 'car', car, arrestTimer: 0, shootTimer: 1 });
    } else {
      state.police.push({ x: rp.x, y: rp.y, angle: 0, mode: 'foot', car: null, arrestTimer: 0, shootTimer: 1 });
    }
  }

  function stepPolice(dt) {
    const p = state.player;
    state.policeTimer -= dt;
    const wantCount = state.wanted === 0 ? 0 : Math.min(2 + state.wanted, 7);
    if (state.wanted > 0 && state.police.length < wantCount && state.policeTimer <= 0) {
      spawnPolice();
      state.policeTimer = Math.max(1.5, 7 - state.wanted);
    }
    if (state.wanted === 0) {
      // Police give up and drive off.
      for (const po of state.police) {
        po.x += Math.cos(po.angle) * 200 * dt;
        po.y += Math.sin(po.angle) * 200 * dt;
      }
      state.police = state.police.filter((po) => dist(po.x, po.y, p.x, p.y) < 1400);
      return 0;
    }
    let events = 0;
    for (const po of state.police) {
      const d = dist(po.x, po.y, p.x, p.y);
      if (po.mode === 'car' && po.car) {
        const c = po.car;
        const wantAngle = Math.atan2(p.y - c.y, p.x - c.x);
        let da = wantAngle - c.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        c.angle += clamp(da, -2.4 * dt, 2.4 * dt);
        c.speed = clamp(c.speed + 300 * dt, 0, POLICE.carSpeed);
        moveCar(c, dt);
        po.x = c.x; po.y = c.y; po.angle = c.angle;
        if (p.car && d < 70) {
          p.car.health -= 22 * dt;
          burst(p.x, p.y, '#f2c94c', 3, 100);
          if (p.car.health <= 0) events |= drivePlayerCar(p.car, 0, { up: false, down: false, left: false, right: false });
        }
      } else {
        const a = Math.atan2(p.y - po.y, p.x - po.x);
        po.angle = a;
        po.x += Math.cos(a) * POLICE.footSpeed * dt;
        po.y += Math.sin(a) * POLICE.footSpeed * dt;
        resolveBuildingCollision(city, po, 12);
        if (!p.car && d < POLICE.arrestRange) {
          po.arrestTimer += dt;
          if (po.arrestTimer > POLICE.arrestTime) return EVENT_BUSTED;
        } else po.arrestTimer = Math.max(0, po.arrestTimer - dt);
        if (state.wanted >= 3 && d < POLICE.shootRange) {
          po.shootTimer -= dt;
          if (po.shootTimer <= 0) {
            po.shootTimer = 1.1 + random() * 0.5;
            const spread = (random() - 0.5) * 0.24;
            state.bullets.push({ x: po.x, y: po.y, vx: Math.cos(a + spread) * 620, vy: Math.sin(a + spread) * 620, life: 0.9, from: 'police', damage: 8 });
          }
        }
      }
    }
    return events;
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = a;
      if (d > 90) {
        e.x += Math.cos(a) * e.speed * dt;
        e.y += Math.sin(a) * e.speed * dt;
        resolveBuildingCollision(city, e, 12);
      } else if (d < 60) {
        // Melee hit.
        if (random() < dt * 0.8) {
          state.player.health -= 6;
          burst(p.x, p.y, '#e5534b', 5, 120);
          if (state.player.health <= 0) return EVENT_WASTED;
        }
      }
      e.shootTimer -= dt;
      if (d < 420 && e.shootTimer <= 0) {
        e.shootTimer = 1.4 + random();
        const spread = (random() - 0.5) * 0.3;
        state.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a + spread) * 560, vy: Math.sin(a + spread) * 560, life: 1, from: 'enemy', damage: 9 });
      }
    }
    return 0;
  }

  function stepBullets(dt) {
    let events = 0;
    const p = state.player;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height) { b.dead = true; continue; }
      if (collidesBuilding(city, b.x, b.y, 2)) { burst(b.x, b.y, '#c8c8c8', 4, 90); b.dead = true; continue; }
      if (b.from === 'player') {
        for (const e of state.enemies) {
          if (e.alive && dist(b.x, b.y, e.x, e.y) < 18) {
            e.health -= b.damage;
            burst(e.x, e.y, '#e5534b', 6, 130);
            b.dead = true;
            if (e.health <= 0) {
              e.alive = false;
              state.defeatCount += 1;
              state.player.money += 40;
              burst(e.x, e.y, '#f2c94c', 10, 150);
            }
            break;
          }
        }
        if (b.dead) continue;
        for (const po of state.police) {
          if (dist(b.x, b.y, po.x, po.y) < 18) {
            burst(po.x, po.y, '#3a6fd8', 8, 140);
            b.dead = true;
            addWanted(1);
            break;
          }
        }
        if (b.dead) continue;
        for (const ped of state.peds) {
          if (dist(b.x, b.y, ped.x, ped.y) < 16) {
            ped.flee = 5;
            burst(ped.x, ped.y, '#e5534b', 5, 120);
            b.dead = true;
            addWanted(1);
            state.stats.crimes += 1;
            events |= EVENT_CRIME;
            break;
          }
        }
        if (b.dead) continue;
        for (const c of state.cars) {
          if (c !== p.car && dist(b.x, b.y, c.x, c.y) < 30) {
            c.health -= b.damage;
            burst(b.x, b.y, '#f2c94c', 4, 100);
            b.dead = true;
            break;
          }
        }
      } else if (dist(b.x, b.y, p.x, p.y) < (p.car ? 30 : 16)) {
        if (state.player.invulnerable <= 0) {
          state.player.health -= b.damage;
          state.player.invulnerable = 0.4;
          burst(p.x, p.y, '#e5534b', 6, 130);
          events |= EVENT_HIT;
          if (state.player.health <= 0) events |= EVENT_WASTED;
        }
        b.dead = true;
      }
    }
    state.bullets = state.bullets.filter((b) => !b.dead);
    return events;
  }

  function stepPickups(dt) {
    const p = state.player;
    let events = 0;
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (dist(p.x, p.y, pk.x, pk.y) < 44) {
        pk.taken = true;
        if (pk.kind === 'cash') { state.player.money += pk.amount; state.stats.earned += pk.amount; events |= EVENT_PICKUP; }
        else if (pk.kind === 'health') { state.player.health = Math.min(PLAYER.health, state.player.health + pk.amount); events |= EVENT_PICKUP; }
        else if (pk.kind === 'ammo') { state.player.ammo += pk.amount; events |= EVENT_PICKUP; }
        else if (pk.kind === 'crate' || pk.kind === 'vault') {
          addWanted(pk.kind === 'vault' ? 2 : 1);
          showBanner(pk.kind === 'vault' ? 'Vault cash grabbed!' : 'Crate grabbed!', 'Now get to the Hideout — and lose the cops!', 4);
          events |= EVENT_PICKUP;
        }
        burst(pk.x, pk.y, '#f2c94c', 10, 140);
      }
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken);
    return events;
  }

  function currentStep() {
    const m = MISSIONS[state.missionIndex];
    return m ? m.steps[state.missionStep] : null;
  }

  function advanceStep() {
    state.missionStep += 1;
    const m = MISSIONS[state.missionIndex];
    if (!m) return EVENT_WIN;
    if (state.missionStep >= m.steps.length) {
      state.player.money += m.reward;
      state.stats.earned += m.reward;
      state.missionDone += 1;
      showBanner('Mission complete!', `${m.title} — +$${m.reward}`, 4);
      state.missionIndex += 1;
      state.wanted = 0;
      state.police = [];
      if (state.missionIndex >= MISSIONS.length) {
        state.won = true;
        return EVENT_MISSION | EVENT_WIN;
      }
      startMission(state.missionIndex);
      return EVENT_MISSION;
    }
    const step = m.steps[state.missionStep];
    if (step.type === 'defeat') {
      const m2 = MISSIONS[state.missionIndex];
      if (m2.id === 'debt') spawnEnemies('goon', 500, 900, step.count);
      else if (m2.id === 'score') spawnEnemies('guard', 1500, 500, step.count);
    }
    return EVENT_MISSION;
  }

  function stepMissions(dt) {
    const m = MISSIONS[state.missionIndex];
    if (!m || state.won) return 0;
    let events = 0;
    if (m.timeLimit) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        showBanner('Too slow!', 'The delivery window closed. Mira is not happy — try again.', 4);
        state.missionStep = 0;
        state.missionTimer = m.timeLimit;
        state.player.x = HIDEOUT.x;
        state.player.y = HIDEOUT.y;
        if (state.player.car) { state.player.car.driver = 'none'; state.player.car = null; }
        return EVENT_MISSION;
      }
    }
    const step = currentStep();
    if (!step) return 0;
    const p = state.player;
    if (step.type === 'stealCar' && p.car) return advanceStep();
    if (step.type === 'goto' || step.type === 'escape') {
      if (dist(p.x, p.y, step.x, step.y) < step.r && (!step.inCar || p.car)) {
        if (step.type === 'escape') state.wanted = 0;
        return advanceStep();
      }
    }
    if (step.type === 'defeat' && state.defeatCount >= step.count) return advanceStep();
    if (step.type === 'collect') {
      const kind = m.id === 'heist' ? 'crate' : 'vault';
      if (!state.pickups.some((pk) => pk.kind === kind)) return advanceStep();
    }
    return events;
  }

  function reset() {
    state.player.x = HIDEOUT.x;
    state.player.y = HIDEOUT.y;
    state.player.angle = 0;
    state.player.health = PLAYER.health;
    state.player.money = 150;
    state.player.ammo = GUN.startAmmo;
    state.player.car = null;
    state.player.invulnerable = 0;
    state.cars = [];
    state.peds = [];
    state.police = [];
    state.enemies = [];
    state.bullets = [];
    state.pickups = [];
    state.particles = [];
    state.wanted = 0;
    state.clock = 10;
    state.elapsed = 0;
    state.missionIndex = 0;
    state.missionStep = 0;
    state.missionTimer = 0;
    state.missionDone = 0;
    state.won = false;
    state.over = null;
    state.defeatCount = 0;
    spawnTraffic();
    spawnPeds();
    addCashPickups();
    startMission(0);
  }

  function step(dt, ctl) {
    if (state.over || state.won) return 0;
    let events = 0;
    state.elapsed += dt;
    state.clock = (10 + state.elapsed / 90) % 24;
    if (state.bannerT > 0) state.bannerT -= dt;
    if (state.player.invulnerable > 0) state.player.invulnerable -= dt;
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);

    const p = state.player;
    // Enter / exit a car.
    if (ctl.enter) {
      if (p.car) {
        const c = p.car;
        c.driver = 'none';
        c.speed = 0;
        p.car = null;
        p.x = c.x + 46;
        p.y = c.y + 46;
      } else {
        const c = nearestCar(p.x, p.y, 78);
        if (c) {
          const wasTraffic = c.driver === 'traffic';
          const policeNear = state.police.some((po) => dist(po.x, po.y, p.x, p.y) < 520);
          c.driver = 'player';
          c.traffic = false;
          p.car = c;
          p.x = c.x;
          p.y = c.y;
          state.stats.stolen += 1;
          if (wasTraffic || policeNear) {
            addWanted(1);
            state.stats.crimes += 1;
            events |= EVENT_CRIME;
            showBanner('Car stolen!', 'Someone saw that. The cops are coming.', 3);
          }
        }
      }
    }

    if (p.car) {
      events |= drivePlayerCar(p.car, dt, ctl);
      if (ctl.shoot && p.ammo > 0) {
        // Drive-by: shoot from the car window toward the mouse.
        p.ammo -= 1;
        const a = Math.atan2(ctl.mouseY - p.y, ctl.mouseX - p.x);
        state.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: 0.9, from: 'player', damage: GUN.damage });
        events |= EVENT_SHOT;
        addWanted(0);
      }
    } else {
      const mx = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
      const my = (ctl.down ? 1 : 0) - (ctl.up ? 1 : 0);
      const len = Math.hypot(mx, my) || 1;
      const speed = ctl.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      p.moving = mx !== 0 || my !== 0;
      if (p.moving) {
        p.x += (mx / len) * speed * dt;
        p.y += (my / len) * speed * dt;
        p.angle = Math.atan2(my, mx);
      }
      clampWorld(p, 16);
      resolveBuildingCollision(city, p, 14);
      p.speed = p.moving ? speed : 0;
      if (ctl.punch) {
        events |= EVENT_SHOT;
        const a = ctl.mouseX !== undefined ? Math.atan2(ctl.mouseY - p.y, ctl.mouseX - p.x) : p.angle;
        let hitAny = false;
        for (const e of state.enemies) {
          if (!e.alive) continue;
          const d = dist(p.x, p.y, e.x, e.y);
          let da = Math.atan2(e.y - p.y, e.x - p.x) - a;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (d < PLAYER.punchRange && Math.abs(da) < PLAYER.punchArc) {
            e.health -= PLAYER.punchDamage;
            e.x += Math.cos(a) * 26;
            e.y += Math.sin(a) * 26;
            burst(e.x, e.y, '#f2c94c', 6, 130);
            hitAny = true;
            if (e.health <= 0) { e.alive = false; state.defeatCount += 1; state.player.money += 40; }
          }
        }
        if (!hitAny) {
          for (const ped of state.peds) {
            const d = dist(p.x, p.y, ped.x, ped.y);
            if (d < PLAYER.punchRange) { ped.flee = 5; addWanted(1); state.stats.crimes += 1; events |= EVENT_CRIME; break; }
          }
        }
      }
      if (ctl.shoot && p.ammo > 0) {
        p.ammo -= 1;
        const a = Math.atan2(ctl.mouseY - p.y, ctl.mouseX - p.x);
        state.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: 0.9, from: 'player', damage: GUN.damage });
        burst(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, '#ffd76a', 4, 120);
        events |= EVENT_SHOT;
        for (const ped of state.peds) if (dist(ped.x, ped.y, p.x, p.y) < 300) ped.flee = 3;
      }
    }

    // Wanted decay: lay low and the heat fades.
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      const nearestCop = state.police.reduce((m, po) => Math.min(m, dist(po.x, po.y, p.x, p.y)), Infinity);
      if (state.wantedTimer > 22 && nearestCop > 420) {
        state.wanted -= 1;
        state.wantedTimer = 0;
      }
    }
    if (state.wanted === 0 && state.player.health < PLAYER.health) {
      state.player.health = Math.min(PLAYER.health, state.player.health + 1.5 * dt);
    }

    events |= stepTraffic(dt);
    events |= stepPeds(dt);
    events |= stepPolice(dt);
    events |= stepEnemies(dt);
    events |= stepBullets(dt);
    events |= stepPickups(dt);
    events |= stepMissions(dt);

    if (state.player.health <= 0) {
      state.over = 'wasted';
      return events | EVENT_WASTED;
    }
    if (events & EVENT_BUSTED) state.over = 'busted';
    if (state.won) return events | EVENT_WIN;
    return events;
  }

  function getSave() {
    const p = state.player;
    return { money: p.money, missionIndex: state.missionIndex, health: p.health, x: p.x, y: p.y, clock: state.clock, ammo: p.ammo, earned: state.stats.earned };
  }

  function loadSave(s) {
    reset();
    state.player.money = s.money ?? 150;
    state.player.health = s.health ?? PLAYER.health;
    state.player.ammo = s.ammo ?? GUN.startAmmo;
    state.player.x = s.x ?? HIDEOUT.x;
    state.player.y = s.y ?? HIDEOUT.y;
    state.clock = s.clock ?? 10;
    state.stats.earned = s.earned ?? 0;
    state.missionIndex = Math.min(s.missionIndex ?? 0, MISSIONS.length - 1);
    state.missionStep = 0;
    startMission(state.missionIndex);
  }

  reset();
  return { state, reset, step, nearestCar, getSave, loadSave, currentStep, showBanner, startMission };
}
