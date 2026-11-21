// Screenshot scenes behind ?shot=start|play|chase|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, so the frame is
// what a short game really looks like and the same seed always gives the same
// frame. ?shot=start shows the title over the living city; play shows Raka
// driving through traffic; chase shows a 3-star police pursuit; end shows the
// Big Score win screen.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

function driveControls() {
  return { up: true, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, mouseX: 0, mouseY: 0 };
}

function idleControls() {
  return { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, mouseX: 0, mouseY: 0 };
}

export function stageShot(name, world) {
  const s = world.state;
  world.reset();
  window.__shotInfo = { player: null, police: 0, wanted: 0 };
  if (name === 'end') {
    s.missionIndex = 5;
    s.missionDone = 5;
    s.player.money = 52350;
    s.won = true;
    s.banner = null;
    s.bannerT = 0;
    return { screen: SCREEN_WIN, best: 52350 };
  }
  // Put Raka in the parked car on the east avenue and drive straight down the
  // road, so the shot shows the car moving at speed instead of wedged on a kerb.
  function stageDrive(seconds, wanted) {
    let car = null;
    let bestD = Infinity;
    for (const c of s.cars) {
      if (c.traffic) continue;
      const d = Math.hypot(c.x - 420, c.y - 245);
      if (d < bestD) { bestD = d; car = c; }
    }
    car.driver = 'player';
    car.traffic = false;
    car.x = 420;
    car.y = 600;
    car.angle = 0;
    car.speed = 0;
    s.player.car = car;
    s.player.x = car.x;
    s.player.y = car.y;
    if (wanted) {
      s.wanted = wanted;
      s.policeTimer = 0;
    }
    const ctl = driveControls();
    for (let i = 0; i < 60 * seconds; i += 1) {
      world.step(STEP, ctl);
      if (s.over) break;
    }
    return car;
  }

  if (name === 'chase') {
    stageDrive(4.5, 3);
    s.banner = { title: 'WANTED — 3 STARS', text: 'Outrun the Porto Verde police!' };
    s.bannerT = 99;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'play') {
    stageDrive(3.5, 0);
    s.banner = { title: 'Mission 1 — First Wheels', text: 'Drive to the Plaza marker' };
    s.bannerT = 99;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // start: title over a living city — traffic moving, pedestrians walking.
  for (let i = 0; i < 60 * 6; i += 1) world.step(STEP, idleControls());
  s.banner = null;
  s.bannerT = 0;
  return { screen: SCREEN_TITLE, best: 0 };
}
