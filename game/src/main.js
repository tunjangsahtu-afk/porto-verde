// Porto Verde boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between title, play, paused, game over and win screens, with
// save / continue through localStorage.
//
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, GUN, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SAVE, ACTION_SHOOT, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.getSave()));
    return true;
  } catch {
    return false;
  }
}

function missionTarget() {
  const step = world.currentStep();
  if (!step) return null;
  if (step.type === 'goto' || step.type === 'escape') return { x: step.x, y: step.y, text: step.text, count: step.count };
  if (step.type === 'defeat') {
    const e = world.state.enemies.find((en) => en.alive);
    return { x: e ? e.x : world.state.player.x, y: e ? e.y : world.state.player.y, text: step.text, count: step.count };
  }
  if (step.type === 'collect') {
    const pk = world.state.pickups.find((p) => p.kind === 'crate' || p.kind === 'vault');
    return pk ? { x: pk.x, y: pk.y, text: step.text } : { x: world.state.player.x, y: world.state.player.y, text: step.text };
  }
  return { x: world.state.player.x, y: world.state.player.y, text: step.text };
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__shotInfo = {
    player: { x: Math.round(world.state.player.x), y: Math.round(world.state.player.y), inCar: !!world.state.player.car, speed: Math.round(world.state.player.car ? world.state.player.car.speed : 0) },
    police: world.state.police.length,
    wanted: world.state.wanted,
    cars: world.state.cars.length,
  };
  world.state.missionStepTarget = missionTarget();
  let painted = 0;
  function paint() {
    world.state.missionStepTarget = missionTarget();
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let saveExists = !!readSave();
  let accumulator = 0;
  let last = performance.now();
  let fireCooldown = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) world.reset();
    accumulator = 0;
    fireCooldown = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Porto Verde.');
  }

  function continueGame() {
    const save = readSave();
    if (!save) return;
    world.loadSave(save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Continuing your save.');
  }

  function endGame(busted) {
    screen = SCREEN_OVER;
    world.state.over = busted ? 'busted' : 'wasted';
    const money = world.state.player.money;
    if (money > best) {
      best = money;
      saveBest(best);
    }
    writeSave();
    audio.fail();
    announce(busted ? 'Busted by the police.' : 'Wasted.');
  }

  function winGame() {
    screen = SCREEN_WIN;
    const money = world.state.player.money;
    if (money > best) {
      best = money;
      saveBest(best);
    }
    writeSave();
    audio.mission();
    announce('The Big Score — you won!');
  }

  function stepWorld(dt, actions) {
    const mw = renderer.toWorld(input.mouse.x, input.mouse.y, world.state.player);
    fireCooldown -= dt;
    const ctl = {
      up: input.held.up,
      down: input.held.down,
      left: input.held.left,
      right: input.held.right,
      run: input.held.run,
      enter: !!(actions & ACTION_ENTER),
      punch: !!(actions & ACTION_PUNCH),
      shoot: !!(actions & ACTION_SHOOT) && fireCooldown <= 0,
      mouseX: mw.x,
      mouseY: mw.y,
    };
    if (ctl.shoot) fireCooldown = GUN.fireRate;
    const events = world.step(dt, ctl);
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) audio.mission();
    if (events & EVENT_WIN) winGame();
    else if (events & EVENT_WASTED) endGame(false);
    else if (events & EVENT_BUSTED) endGame(true);
    return events;
  }

  // Returns the gameplay actions (enter / punch / shoot) for this frame's
  // first world step; screen changes are handled here.
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_SAVE && screen === SCREEN_PLAY) {
      announce(writeSave() ? 'Game saved.' : 'Save failed.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(true);
      else if (actions & ACTION_ENTER && saveExists) continueGame();
      return 0;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame(true);
      else if (actions & ACTION_ENTER && saveExists) continueGame();
      return 0;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepWorld(STEP, first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
      audio.update(STEP, world.state.wanted, !!world.state.player.car);
      audio.engine(world.state.player.car ? Math.abs(world.state.player.car.speed) / 520 : 0);
    } else {
      accumulator = 0;
      audio.engineOff();
    }
    world.state.missionStepTarget = missionTarget();
    renderer.draw(world.state, screen, best, saveExists);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // C on the title screen continues a save (E is also bound to enter-car in play).
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) && saveExists) {
      continueGame();
    }
  });

  announce('Porto Verde. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
