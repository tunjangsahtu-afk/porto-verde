// Porto Verde story: Raka, a courier who owes the wrong people money, climbs from
// a stolen scooter to the biggest score in the city. Each mission is a list of
// steps; the world checks them off in order. All names, places and story are
// original — nothing from any commercial game.
import { BANK, HARBOR, HIDEOUT, MARKET, OLD_TOWN } from './config.js';

export const STORY_INTRO = [
  'Porto Verde. Sun, sea, and debts.',
  'Raka owes the loan shark Dimas 50,000 verde.',
  'One week to pay it back — or swim with the harbour fish.',
];

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Mission 1 — First Wheels',
    brief: 'Mira needs a driver. Steal any car (walk up and press E) and drive it to the blue marker at the Plaza.',
    reward: 200,
    steps: [
      { type: 'stealCar', text: 'Steal a car — walk up to one and press E' },
      { type: 'goto', x: 1500, y: 300, r: 90, text: 'Drive to the Plaza marker', inCar: true },
    ],
  },
  {
    id: 'delivery',
    title: 'Mission 2 — Delivery Run',
    brief: 'Mira has a package for the Night Market. Deliver it in 90 seconds. The cops are jumpy — don\u2019t hit anyone.',
    reward: 350,
    timeLimit: 90,
    steps: [
      { type: 'goto', x: MARKET.x, y: MARKET.y, r: 90, text: 'Deliver the package to the Night Market' },
    ],
  },
  {
    id: 'debt',
    title: 'Mission 3 — Debt Collection',
    brief: 'Dimas\u2019s goons are shaking down Old Town Square. Teach all three a lesson — fists or pistol, your call.',
    reward: 500,
    steps: [
      { type: 'goto', x: OLD_TOWN.x, y: OLD_TOWN.y, r: 110, text: 'Go to Old Town Square' },
      { type: 'defeat', count: 3, text: 'Deal with the 3 goons (F to punch, click to shoot)' },
    ],
  },
  {
    id: 'heist',
    title: 'Mission 4 — Harbor Heist',
    brief: 'A crate of "imported" phones waits at the Harbor Docks. Grab it and lose the cops — get back to the Hideout.',
    reward: 800,
    steps: [
      { type: 'goto', x: HARBOR.x, y: HARBOR.y, r: 100, text: 'Reach the Harbor Docks crate' },
      { type: 'collect', count: 1, text: 'Grab the crate (walk over it)' },
      { type: 'escape', x: HIDEOUT.x, y: HIDEOUT.y, r: 110, text: 'Escape to the Hideout — lose the cops on the way' },
    ],
  },
  {
    id: 'score',
    title: 'Mission 5 — The Big Score',
    brief: 'The Verde National Bank. Grab the vault cash, then outrun a 4-star wanted level back to the Hideout. Pay Dimas. Be free.',
    reward: 2000,
    steps: [
      { type: 'goto', x: BANK.x, y: BANK.y, r: 110, text: 'Reach the Verde National Bank' },
      { type: 'defeat', count: 4, text: 'Deal with the 4 bank guards' },
      { type: 'collect', count: 1, text: 'Grab the vault cash' },
      { type: 'escape', x: HIDEOUT.x, y: HIDEOUT.y, r: 110, text: 'Escape to the Hideout with the cash!' },
    ],
  },
];

export function missionTitle(index) {
  return index < MISSIONS.length ? MISSIONS[index].title : 'Free Roam — Porto Verde is yours';
}

export function missionBrief(index) {
  return index < MISSIONS.length ? MISSIONS[index].brief : 'All missions complete! Cruise the city, earn cash, and stay out of trouble.';
}
