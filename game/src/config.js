// Porto Verde — every tuning number and colour in one place.
// The world is a fixed 3200x2400 city; the renderer scales a 1280x720 view of it
// to the window and follows the player, so no rule below depends on screen size.

export const FIELD = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 340,
  health: 100,
  punchDamage: 25,
  punchRange: 46,
  punchArc: 1.1,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 700,
  maxSpeed: 520,
  reverseMax: 160,
  turnRate: 2.6,
  health: 100,
};

export const POLICE = { footSpeed: 250, carSpeed: 560, arrestRange: 42, arrestTime: 2.2, shootRange: 380 };

export const GUN = { damage: 34, range: 520, fireRate: 0.22, startAmmo: 48, magSize: 12 };

export const WANTED_MAX = 5;
export const SAVE_KEY = 'porto-verde.save.v1';
export const BEST_KEY = 'porto-verde.best';

export const PALETTE = {
  backdrop: '#0d1520',
  grass: '#4a7c3a',
  grass2: '#558744',
  sand: '#d9c27a',
  water: '#2a6ea8',
  waterDeep: '#1d5488',
  road: '#33373d',
  roadLine: '#d8c95a',
  sidewalk: '#8d8f96',
  building: ['#c96f4a', '#7a6fb0', '#4a8fb0', '#b0a24a', '#8fb04a', '#b04a6f', '#5a6b7c', '#a8724a'],
  roof: '#2f333a',
  tree: '#2f6b2a',
  tree2: '#3f8b35',
  park: '#3e7a33',
  player: '#f2c94c',
  playerShirt: '#e5534b',
  ped: '#e8e0d0',
  police: '#3a6fd8',
  policeCar: '#e8e8e8',
  taxi: '#f2c94c',
  text: '#f2f0e8',
  muted: '#b8bcc4',
  gold: '#f2c94c',
  red: '#e5534b',
  panel: 'rgba(16, 22, 32, 0.92)',
  hudPanel: 'rgba(10, 16, 26, 0.72)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Road centrelines: a grid of avenues (x) and streets (y). Road half-width 45.
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_HALF = 45;

export const DISTRICTS = [
  { name: 'Marina Bay', x: 0, y: 2000, w: 3200, h: 400 },
  { name: 'Old Town', x: 0, y: 0, w: 1200, h: 1200 },
  { name: 'Market District', x: 1200, y: 800, w: 1200, h: 800 },
  { name: 'Hillcrest', x: 2400, y: 0, w: 800, h: 1200 },
  { name: 'Porto Verde Plaza', x: 1200, y: 0, w: 1200, h: 800 },
];

export const HIDEOUT = { x: 420, y: 420, name: 'Raka\u2019s Hideout' };
export const BANK = { x: 1500, y: 500, name: 'Verde National Bank' };
export const HARBOR = { x: 2400, y: 2150, name: 'Harbor Docks' };
export const MARKET = { x: 1600, y: 1200, name: 'Night Market' };
export const OLD_TOWN = { x: 500, y: 900, name: 'Old Town Square' };
