// Drawing only: the world state and the current screen in, pixels out. The
// camera follows the player over the 3200x2400 city; a 1280x720 view is scaled
// to the window. Flat vector art, canvas text for the HUD, minimap and panels.
import { FIELD, FONT, PALETTE, ROADS_X, ROADS_Y, ROAD_HALF, WORLD } from './config.js';
import { roadAt } from './city.js';
import { missionBrief, missionTitle } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const MINIMAP = { x: 1030, y: 16, w: 234, h: 176 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, vw: FIELD.width, vh: FIELD.height };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.vw = canvas.width / view.scale;
    view.vh = canvas.height / view.scale;
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'top';
    context.fillText(value, x, y);
  }

  function textPlain(value, x, y, size, color, align, baseline) {
    if (!fonts.has('p' + size)) fonts.set('p' + size, `${size}px ${FONT}`);
    context.font = fonts.get('p' + size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'top';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawCar(x, y, angle, color, isPolice) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(-34, -15, 68, 32, 8);
    context.fill();
    context.fillStyle = color;
    roundRect(-32, -16, 64, 32, 8);
    context.fill();
    context.fillStyle = isPolice ? '#1d3a6e' : '#222c38';
    roundRect(-8, -13, 20, 26, 4);
    context.fill();
    context.fillStyle = '#dfe8f2';
    context.fillRect(22, -12, 5, 5);
    context.fillRect(22, 7, 5, 5);
    context.fillStyle = '#ff5a4a';
    context.fillRect(-32, -12, 4, 5);
    context.fillRect(-32, 7, 4, 5);
    if (isPolice) {
      context.fillStyle = '#ff3b30';
      context.beginPath(); context.arc(-2, -8, 4, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#3a6fd8';
      context.beginPath(); context.arc(-2, 8, 4, 0, Math.PI * 2); context.fill();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, shirt, isPlayer, isPolice) {
    context.save();
    context.translate(x, y);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath(); context.ellipse(0, 5, 13, 7, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = shirt;
    context.beginPath(); context.arc(0, 0, 13, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath(); context.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, 7, 0, Math.PI * 2); context.fill();
    if (isPlayer) {
      context.strokeStyle = '#f2c94c';
      context.lineWidth = 3;
      context.beginPath(); context.arc(0, 0, 17, 0, Math.PI * 2); context.stroke();
    }
    if (isPolice) {
      context.fillStyle = '#1d3a6e';
      context.fillRect(-8, -16, 16, 6);
    }
    context.restore();
  }

  function drawCity(state, cam) {
    const { city } = state;
    const x0 = Math.max(0, cam.x - 60);
    const y0 = Math.max(0, cam.y - 60);
    const x1 = Math.min(WORLD.width, cam.x + cam.w + 60);
    const y1 = Math.min(WORLD.height, cam.y + cam.h + 60);
    // Ground: grass with checker variation, sand + water along the south marina.
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    context.fillStyle = PALETTE.grass2;
    const gs = 160;
    for (let gx = Math.floor(x0 / gs) * gs; gx < x1; gx += gs) {
      for (let gy = Math.floor(y0 / gs) * gs; gy < y1; gy += gs) {
        if (((gx + gy) / gs) % 2 === 0) context.fillRect(gx, gy, gs, gs);
      }
    }
    context.fillStyle = PALETTE.sand;
    context.fillRect(x0, 2030, x1 - x0, 70);
    context.fillStyle = PALETTE.water;
    context.fillRect(x0, 2100, x1 - x0, Math.max(0, y1 - 2100));
    context.fillStyle = PALETTE.waterDeep;
    for (let wx = Math.floor(x0 / 90) * 90; wx < x1; wx += 90) {
      context.fillRect(wx, 2160, 46, 8);
      context.fillRect(wx + 30, 2260, 46, 8);
    }
    // Parks and trees.
    for (const park of city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      context.fillStyle = PALETTE.tree;
      context.beginPath(); context.arc(t.x, t.y, t.r, 0, Math.PI * 2); context.fill();
      context.fillStyle = PALETTE.tree2;
      context.beginPath(); context.arc(t.x - 4, t.y - 4, t.r * 0.55, 0, Math.PI * 2); context.fill();
    }
    // Roads: asphalt, sidewalks, lane dashes, crosswalks.
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_HALF, y0, ROAD_HALF * 2, y1 - y0);
    for (const ry of ROADS_Y) context.fillRect(x0, ry - ROAD_HALF, x1 - x0, ROAD_HALF * 2);
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) {
      context.fillRect(rx - ROAD_HALF - 8, y0, 8, y1 - y0);
      context.fillRect(rx + ROAD_HALF, y0, 8, y1 - y0);
    }
    for (const ry of ROADS_Y) {
      context.fillRect(x0, ry - ROAD_HALF - 8, x1 - x0, 8);
      context.fillRect(x0, ry + ROAD_HALF, x1 - x0, 8);
    }
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) {
      for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) {
        if (!roadAt(rx, y + 15)) context.fillRect(rx - 3, y, 6, 28);
      }
    }
    for (const ry of ROADS_Y) {
      for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) {
        if (!roadAt(x + 15, ry)) context.fillRect(x, ry - 3, 28, 6);
      }
    }
    // Traffic lights.
    for (const l of city.lights) {
      if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
      const nsGreen = state.lightsNS;
      context.fillStyle = '#222';
      context.fillRect(l.x + ROAD_HALF + 2, l.y - ROAD_HALF - 16, 12, 26);
      context.fillStyle = nsGreen ? '#3ddc5a' : '#e5534b';
      context.beginPath(); context.arc(l.x + ROAD_HALF + 8, l.y - ROAD_HALF - 9, 4, 0, Math.PI * 2); context.fill();
      context.fillStyle = nsGreen ? '#e5534b' : '#3ddc5a';
      context.beginPath(); context.arc(l.x + ROAD_HALF + 8, l.y - ROAD_HALF + 3, 4, 0, Math.PI * 2); context.fill();
    }
    // Buildings with roofs and windows.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.roof;
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      context.fillStyle = 'rgba(255,240,180,0.85)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((cx * 7 + cy * 3 + b.floors) % 3 !== 0) context.fillRect(b.x + 14 + cx * 34, b.y + 14 + cy * 34, 14, 10);
        }
      }
    }
    // District labels.
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    textPlain('PORTO VERDE', 1600, 1200, 44, 'rgba(255,255,255,0.16)', 'center', 'middle');
  }

  function drawMarker(state, cam) {
    const step = state.missionStepTarget;
    if (!step) return;
    const pulse = 1 + Math.sin(state.elapsed * 5) * 0.15;
    context.save();
    context.translate(step.x, step.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = '#f2c94c';
    context.fillRect(-11 * pulse, -11 * pulse, 22 * pulse, 22 * pulse);
    context.strokeStyle = '#111';
    context.lineWidth = 3;
    context.strokeRect(-11 * pulse, -11 * pulse, 22 * pulse, 22 * pulse);
    context.restore();
    // Edge arrow pointing at the marker when it is off-screen.
    const sx = step.x;
    const sy = step.y;
    if (sx < cam.x || sx > cam.x + cam.w || sy < cam.y || sy > cam.y + cam.h) {
      const cx = cam.x + cam.w / 2;
      const cy = cam.y + cam.h / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const ax = cx + Math.cos(a) * (cam.w / 2 - 60);
      const ay = cy + Math.sin(a) * (cam.h / 2 - 60);
      context.save();
      context.translate(ax, ay);
      context.rotate(a);
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.moveTo(18, 0); context.lineTo(-12, -13); context.lineTo(-12, 13); context.closePath();
      context.fill();
      context.restore();
      textPlain(`${Math.round(Math.hypot(sx - state.player.x, sy - state.player.y))}m`, ax, ay + 26, 16, '#f2c94c', 'center', 'top');
    }
  }

  function drawHud(state, screen) {
    const p = state.player;
    // Top-left: money, health, ammo, mission tracker.
    context.fillStyle = PALETTE.hudPanel;
    roundRect(12, 12, 330, 108, 10);
    context.fill();
    text(`$ ${p.money.toLocaleString('en-US')}`, 26, 22, 26, PALETTE.gold, 'left', 'top');
    textPlain('HEALTH', 26, 56, 13, PALETTE.muted, 'left', 'top');
    context.fillStyle = '#333';
    roundRect(26, 74, 150, 12, 6);
    context.fill();
    context.fillStyle = p.health > 35 ? '#4ad87a' : '#e5534b';
    roundRect(26, 74, Math.max(0, 150 * p.health / 100), 12, 6);
    context.fill();
    textPlain(p.car ? `CAR ${Math.round(Math.abs(p.car.speed) * 0.12)} km/h` : `AMMO ${p.ammo}`, 190, 56, 13, PALETTE.text, 'left', 'top');
    textPlain(p.car ? 'E — exit car' : 'E — enter car   F — punch   Click — shoot', 190, 74, 12, PALETTE.muted, 'left', 'top');
    textPlain('Missions done: ' + state.missionDone + ' / 5', 26, 96, 13, PALETTE.muted, 'left', 'top');
    // Wanted stars, top centre.
    for (let i = 0; i < 5; i += 1) {
      context.fillStyle = i < state.wanted ? '#ffd23a' : 'rgba(255,255,255,0.22)';
      const sx = FIELD.width / 2 - 70 + i * 30;
      context.save();
      context.translate(sx, 34);
      context.beginPath();
      for (let k = 0; k < 5; k += 1) {
        const a = -Math.PI / 2 + k * (Math.PI * 2 / 5);
        const a2 = a + Math.PI / 5;
        context.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
        context.lineTo(Math.cos(a2) * 5.5, Math.sin(a2) * 5.5);
      }
      context.closePath();
      context.fill();
      context.restore();
    }
    if (state.wanted > 0) textPlain('WANTED', FIELD.width / 2, 52, 12, '#ff6a5a', 'center', 'top');
    // Clock + district, top centre under stars.
    const hh = Math.floor(state.clock);
    const mm = Math.floor((state.clock - hh) * 60);
    textPlain(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  •  PORTO VERDE`, FIELD.width / 2, 72, 14, PALETTE.text, 'center', 'top');
    // Mission tracker bottom-left.
    const step = state.missionStepTarget;
    context.fillStyle = PALETTE.hudPanel;
    roundRect(12, FIELD.height - 118, 430, 106, 10);
    context.fill();
    text(missionTitle(state.missionIndex), 26, FIELD.height - 106, 18, PALETTE.gold, 'left', 'top');
    textPlain(step ? step.text : missionBrief(state.missionIndex), 26, FIELD.height - 80, 15, PALETTE.text, 'left', 'top');
    if (state.missionTimer > 0) textPlain(`TIME LEFT: ${Math.ceil(state.missionTimer)}s`, 26, FIELD.height - 54, 15, '#ff8a7a', 'left', 'top');
    else if (step && step.count) textPlain(`Taken down: ${state.defeatCount} / ${step.count}`, 26, FIELD.height - 54, 15, PALETTE.text, 'left', 'top');
    // Minimap.
    drawMinimap(state);
    // Banner (mission intro / event).
    if (state.banner && state.bannerT > 0) {
      context.fillStyle = PALETTE.panel;
      roundRect(FIELD.width / 2 - 330, 108, 660, 86, 10);
      context.fill();
      text(state.banner.title, FIELD.width / 2, 122, 24, PALETTE.gold, 'center', 'top');
      textPlain(state.banner.text, FIELD.width / 2, 154, 15, PALETTE.text, 'center', 'top');
    }
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      text('PAUSED', FIELD.width / 2, 300, 54, PALETTE.text, 'center', 'top');
      textPlain('P / Esc — resume    G — save game    M — mute', FIELD.width / 2, 370, 18, PALETTE.muted, 'center', 'top');
    }
  }

  function drawMinimap(state) {
    const sx = MINIMAP.w / WORLD.width;
    const sy = MINIMAP.h / WORLD.height;
    context.fillStyle = PALETTE.hudPanel;
    roundRect(MINIMAP.x - 6, MINIMAP.y - 6, MINIMAP.w + 12, MINIMAP.h + 12, 10);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.clip();
    context.fillStyle = '#2c4a26';
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.fillStyle = '#3a4a55';
    for (const rx of ROADS_X) context.fillRect(MINIMAP.x + rx * sx - 2, MINIMAP.y, 4, MINIMAP.h);
    for (const ry of ROADS_Y) context.fillRect(MINIMAP.x, MINIMAP.y + ry * sy - 2, MINIMAP.w, 4);
    context.fillStyle = '#2a6ea8';
    context.fillRect(MINIMAP.x, MINIMAP.y + 2100 * sy, MINIMAP.w, MINIMAP.h - 2100 * sy);
    const step = state.missionStepTarget;
    if (step) {
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.arc(MINIMAP.x + step.x * sx, MINIMAP.y + step.y * sy, 6, 0, Math.PI * 2);
      context.fill();
    }
    for (const po of state.police) {
      context.fillStyle = '#5a8dff';
      context.beginPath();
      context.arc(MINIMAP.x + po.x * sx, MINIMAP.y + po.y * sy, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(MINIMAP.x + state.player.x * sx, MINIMAP.y + state.player.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#f2c94c';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(MINIMAP.x + state.player.x * sx, MINIMAP.y + state.player.y * sy, 8, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    textPlain('PORTO VERDE', MINIMAP.x + MINIMAP.w / 2, MINIMAP.y + MINIMAP.h + 10, 11, PALETTE.muted, 'center', 'top');
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 680;
    const h = 150 + lines.length * 30;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, w, h, 14);
    context.fill();
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 3;
    roundRect(x, y, w, h, 14);
    context.stroke();
    text(title, FIELD.width / 2, y + 34, 46, accent || PALETTE.gold, 'center', 'top');
    lines.forEach((line, i) => textPlain(line, FIELD.width / 2, y + 100 + i * 30, 18, PALETTE.text, 'center', 'top'));
    text(prompt, FIELD.width / 2, y + h - 44, 20, PALETTE.gold, 'center', 'top');
  }

  function draw(state, screen, best, saveExists) {
    const p = state.player;
    // Camera follows the player, clamped to the world.
    const cam = {
      x: Math.max(0, Math.min(WORLD.width - FIELD.width, p.x - FIELD.width / 2)),
      y: Math.max(0, Math.min(WORLD.height - FIELD.height, p.y - FIELD.height / 2)),
      w: FIELD.width,
      h: FIELD.height,
    };
    // When the player is near a world edge the view is smaller than the field;
    // keep the field centred on the camera instead.
    const vw = Math.min(FIELD.width, WORLD.width - cam.x);
    const vh = Math.min(FIELD.height, WORLD.height - cam.y);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = view.scale;
    context.setTransform(scale, 0, 0, scale, view.x + (FIELD.width - vw) * scale / 2 - cam.x * scale, view.y + (FIELD.height - vh) * scale / 2 - cam.y * scale);
    drawCity(state, { x: cam.x, y: cam.y, w: vw, h: vh });
    drawMarker(state, { x: cam.x, y: cam.y, w: vw, h: vh });
    // Pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(state.elapsed * 4 + pk.x) * 3;
      context.save();
      context.translate(pk.x, pk.y + bob);
      if (pk.kind === 'cash') {
        context.fillStyle = '#2fae5f';
        roundRect(-14, -9, 28, 18, 3);
        context.fill();
        context.fillStyle = '#fff';
        context.font = 'bold 13px ' + FONT;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('$', 0, 0);
      } else if (pk.kind === 'health') {
        context.fillStyle = '#fff';
        roundRect(-13, -13, 26, 26, 5);
        context.fill();
        context.fillStyle = '#e5534b';
        context.fillRect(-3, -9, 6, 18);
        context.fillRect(-9, -3, 18, 6);
      } else if (pk.kind === 'ammo') {
        context.fillStyle = '#f2c94c';
        roundRect(-12, -8, 24, 16, 3);
        context.fill();
        context.fillStyle = '#222';
        context.font = 'bold 10px ' + FONT;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('AMMO', 0, 0);
      } else {
        context.fillStyle = pk.kind === 'vault' ? '#ffd23a' : '#b07a2a';
        roundRect(-16, -12, 32, 24, 4);
        context.fill();
        context.strokeStyle = '#5a3a10';
        context.lineWidth = 2;
        context.strokeRect(-16, -12, 32, 24);
      }
      context.restore();
    }
    // Cars.
    for (const c of state.cars) drawCar(c.x, c.y, c.angle, c.color, c.driver === 'police');
    // Pedestrians.
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, false, false);
    // Enemies.
    for (const e of state.enemies) {
      if (!e.alive) continue;
      drawPerson(e.x, e.y, e.angle, '#3a3a3a', false, false);
      context.fillStyle = '#e5534b';
      context.fillRect(e.x - 16, e.y - 28, 32, 5);
      context.fillStyle = '#ff8a7a';
      context.fillRect(e.x - 16, e.y - 28, 32 * Math.max(0, e.health / 60), 5);
      textPlain(e.kind === 'guard' ? 'GUARD' : 'GOON', e.x, e.y - 44, 11, '#ff8a7a', 'center', 'top');
    }
    // Police.
    for (const po of state.police) {
      if (po.mode === 'car') continue;
      drawPerson(po.x, po.y, po.angle, '#3a6fd8', false, true);
      if (po.arrestTimer > 0) {
        context.fillStyle = '#ff8a7a';
        context.fillRect(po.x - 16, po.y - 28, 32 * (po.arrestTimer / 2.2), 5);
      }
    }
    // Bullets and particles.
    for (const b of state.bullets) {
      context.strokeStyle = '#ffd76a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.max);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // Player (unless inside a car — the car is the player then).
    if (!p.car) drawPerson(p.x, p.y, p.angle, PALETTE.playerShirt, true, false);
    // Day / night tint.
    const hour = state.clock;
    const night = hour < 6 || hour > 19 ? 0.34 : hour < 8 || hour > 17 ? 0.14 : 0;
    if (night > 0) {
      context.fillStyle = `rgba(10, 16, 48, ${night})`;
      context.fillRect(cam.x, cam.y, vw, vh);
    }
    // HUD in screen space.
    context.setTransform(scale, 0, 0, scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(8, 14, 24, 0.55)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      text('PORTO VERDE', FIELD.width / 2, 120, 72, PALETTE.gold, 'center', 'top');
      textPlain('An open-world crime story — 100% original', FIELD.width / 2, 205, 20, PALETTE.text, 'center', 'top');
      drawPanel('RAKA NEEDS $50,000', [
        'Steal cars, run missions, outrun the cops.',
        'WASD / Arrows — move & drive    E — enter / steal car',
        'F — punch    Mouse click — shoot    Shift — run    P — pause',
        'G — save    M — mute    Best: $' + best.toLocaleString('en-US'),
      ], saveExists ? 'Press Space to start  •  C to continue your save' : 'Press Space or click to start');
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_OVER) {
      const busted = state.over === 'busted';
      drawPanel(busted ? 'BUSTED!' : 'WASTED!', [
        busted ? 'The Porto Verde police caught up with Raka.' : 'Raka didn\u2019t make it out of Porto Verde.',
        `Money earned: $${state.stats.earned.toLocaleString('en-US')}   •   Missions done: ${state.missionDone} / 5`,
        'Your save is kept — press C to continue from your last mission.',
      ], 'Press Space to play again', '#ff6a5a');
    } else if (screen === SCREEN_WIN) {
      drawPanel('THE BIG SCORE!', [
        'Raka paid off Dimas. Porto Verde is his.',
        `Final money: $${p.money.toLocaleString('en-US')}   •   Missions done: 5 / 5`,
        'Free roam continues — cruise the city as long as you like.',
      ], 'Press Space to keep playing', PALETTE.gold);
    }
  }

  function cameraFor(p) {
    const cam = {
      x: Math.max(0, Math.min(WORLD.width - FIELD.width, p.x - FIELD.width / 2)),
      y: Math.max(0, Math.min(WORLD.height - FIELD.height, p.y - FIELD.height / 2)),
      w: 0,
      h: 0,
    };
    cam.w = Math.min(FIELD.width, WORLD.width - cam.x);
    cam.h = Math.min(FIELD.height, WORLD.height - cam.y);
    return cam;
  }

  function toWorld(cssX, cssY, p) {
    const ratio = window.devicePixelRatio || 1;
    const cam = cameraFor(p);
    const px = cssX * ratio;
    const py = cssY * ratio;
    return {
      x: (px - view.x - (FIELD.width - cam.w) * view.scale / 2) / view.scale + cam.x,
      y: (py - view.y - (FIELD.height - cam.h) * view.scale / 2) / view.scale + cam.y,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, cameraFor, toWorld };
}
