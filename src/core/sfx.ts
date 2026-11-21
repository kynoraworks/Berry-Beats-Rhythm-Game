import Phaser from 'phaser';
import { getSettings } from './settings';
import { getAudioContext } from './songs';

/**
 * Synthesised sound effects. Each effect is a short list of layers: pitched
 * tones with a pluck envelope, or filtered noise. Some sounds also have a
 * recorded sample (see SAMPLES below); the synthesised version plays until
 * the sample has loaded, or if it cannot be loaded. The MC's lines have no
 * synthesised version and stay silent until they load.
 */
export type SfxName =
  | 'move'
  | 'select'
  | 'back'
  | 'tick'
  | 'perfect'
  | 'good'
  | 'hit'
  | 'miss'
  | 'combo'
  | 'bonus'
  | 'banner'
  | 'round'
  | 'cheer'
  | 'win'
  | 'lose'
  | 'fail'
  | 'count'
  | 'go'
  | 'place'
  | 'remove'
  | 'flair'
  | 'ability'
  | 'warn'
  | 'zap'
  | 'hype'
  | 'hypeOut'
  | 'tapePlay'
  | 'tapeEject'
  | 'tapeForward'
  | 'tapeRewind'
  | 'tapeLift'
  | 'tapeSlide'
  | 'tapeInsert'
  | 'tapeMotor'
  | 'tapeSpring'
  | 'deskBump'
  | 'paperFlip'
  | 'marker'
  | 'doorChime'
  | 'doorHiss'
  | 'doorThunk'
  | 'stamp'
  // Micro sounds: one family of short taps and clicks (see MICRO below).
  | 'confirm'
  | 'locked'
  | 'toggleOn'
  | 'toggleOff'
  | 'sliderTick'
  | 'pageTurn'
  | 'listScroll'
  | 'talkBlip'
  | 'dialogNext'
  | 'lookAt'
  | 'npcHey'
  | 'unlock'
  | 'step'
  | 'doorSlide'
  | 'trainRoll'
  | 'brakeSqueal'
  | 'mapPin'
  | 'backupCycle'
  | 'cardPick'
  | 'cardDrop'
  | 'cardSwap'
  | 'countTick'
  | 'badgePop'
  | 'pauseOpen'
  | 'pauseClose'
  // The 3-2-1 before a battle: a hit and a scratch per number, and the MC.
  | 'count3'
  | 'count2'
  | 'count1'
  | 'countGo'
  | 'mcThree'
  | 'mcTwo'
  | 'mcOne'
  // Battle hype (see announcer.ts for when each plays).
  // Turntable: scratches, a crossfader cut, the record spun back or braked, the needle landing.
  | 'djBaby'
  | 'djChirp'
  | 'djTransform'
  | 'djFlare'
  | 'djCut'
  | 'djRewind'
  | 'djBrake'
  | 'needleDrop'
  // Low impacts: a boom, the biggest slam, the hype's sub drop.
  | 'boom'
  | 'slam'
  | 'subDrop'
  | 'whoosh'
  | 'ready'
  | 'roundWin'
  | 'roundLose'
  | 'abilitySteady'
  | 'abilitySecondWind'
  | 'abilityEureka'
  | 'abilityRind'
  | 'airhorn'
  | 'victory'
  | 'defeat'
  | 'crowdCheer'
  | 'crowdOhh'
  | 'crowdRoar'
  | 'crowdBed'
  | 'mcRound1'
  | 'mcRound2'
  | 'mcRound3'
  | 'mcRound4'
  | 'mcFinal'
  | 'mcHype'
  | 'mcFlawless'
  | 'mcCombo'
  | 'mcCrowdWild'
  | 'mcWinner'
  | 'mcOhNo'
  | 'mcLetsDance';

interface Layer {
  /** Oscillator shape, or 'noise' for a filtered noise burst. */
  type: OscillatorType | 'noise';
  /** Start and end frequency in Hz (for noise: the band-pass centre). */
  from: number;
  to?: number;
  dur: number;
  gain: number;
  delay?: number;
  /** Seconds taken to reach full volume. Defaults to a sharp 5 ms attack. */
  attack?: number;
  /** Band-pass sharpness for noise. Higher sounds more like a pitched scrape. */
  q?: number;
}

const note = (semitones: number, base = 523.25): number => base * 2 ** (semitones / 12);

/** A short run of plucked notes, one after another. */
function arpeggio(steps: number[], step: number, dur: number, gain: number, type: OscillatorType = 'triangle'): Layer[] {
  return steps.map((semi, i) => ({ type, from: note(semi), dur, gain, delay: i * step }));
}

/** One stroke of a record scratch: a narrow band of noise and a buzz sliding together. */
function stroke(from: number, to: number, dur: number, delay: number, gain = 0.22): Layer[] {
  return [
    { type: 'noise', from, to, dur, gain, delay, attack: 0.008, q: 4 },
    { type: 'sawtooth', from: from / 8, to: to / 8, dur, gain: gain * 0.35, delay, attack: 0.008 },
  ];
}

const WIN_RECIPE: Layer[] = [...arpeggio([0, 4, 7, 12, 16], 0.09, 0.3, 0.12), { type: 'triangle', from: note(-12), dur: 0.9, gain: 0.12, delay: 0.36 }];
const LOSE_RECIPE: Layer[] = arpeggio([7, 3, 0, -5], 0.14, 0.32, 0.11, 'sawtooth');
const DROP_RECIPE: Layer[] = [
  { type: 'sine', from: 130, to: 38, dur: 0.55, gain: 0.26 },
  { type: 'triangle', from: 70, to: 32, dur: 0.4, gain: 0.12 },
  { type: 'noise', from: 260, dur: 0.22, gain: 0.12 },
  { type: 'noise', from: 3800, dur: 0.12, gain: 0.05 },
];
const BABY_RECIPE: Layer[] = [...stroke(700, 3200, 0.07, 0), ...stroke(3200, 600, 0.09, 0.075), ...stroke(800, 3600, 0.06, 0.17), ...stroke(3600, 500, 0.12, 0.235)];
const AIRHORN_RECIPE: Layer[] = [
  { type: 'sawtooth', from: 466, dur: 0.55, gain: 0.05, attack: 0.02 },
  { type: 'sawtooth', from: 470, dur: 0.55, gain: 0.05, attack: 0.02 },
  { type: 'sawtooth', from: 233, dur: 0.55, gain: 0.05, attack: 0.02 },
];
const CHEER_RECIPE: Layer[] = [
  { type: 'noise', from: 1200, to: 2600, dur: 0.9, gain: 0.09, attack: 0.25 },
  { type: 'noise', from: 3200, dur: 0.7, gain: 0.04, delay: 0.1, attack: 0.3 },
];

/** A heavy countdown hit, `semi` semitones up: a pitched thump with a short scratch on top. */
const COUNT_HIT = (semi: number): Layer[] => [
  { type: 'sine', from: 170 * 2 ** (semi / 12), to: 60, dur: 0.3, gain: 0.26 },
  { type: 'noise', from: 300, dur: 0.12, gain: 0.12 },
  { type: 'noise', from: 2600, dur: 0.02, gain: 0.08 },
  ...stroke(900 * 2 ** (semi / 12), 3200, 0.07, 0.01, 0.12),
];

/**
 * The micro sounds: menus, talking, walking, the train. One family so they sit
 * together: a short bright tick (the snap of a tape-deck key), a soft low
 * thump where something lands, and plucked tones in C major pentatonic.
 * Everything is quiet and under a tenth of a second unless it is a moment
 * (the train, an unlock). Sounds that repeat fast are rate-limited and
 * slightly varied (see GAPS and JITTER).
 */
const snap = (from: number, gain: number, delay = 0, dur = 0.012): Layer => ({ type: 'noise', from, dur, gain, delay, q: 1.6 });
const pluck = (semi: number, dur: number, gain: number, delay = 0, type: OscillatorType = 'triangle'): Layer => ({ type, from: note(semi), dur, gain, delay });
const thump = (from: number, gain: number, delay = 0, dur = 0.05): Layer => ({ type: 'sine', from, to: from * 0.55, dur, gain, delay });
/** One wheel over a rail joint: a dull clack with a knock under it. */
const clack = (delay: number, gain = 1): Layer[] => [
  { type: 'noise', from: 900, dur: 0.035, gain: 0.07 * gain, delay, q: 1.2 },
  { type: 'sine', from: 120, to: 75, dur: 0.06, gain: 0.1 * gain, delay },
];

const MICRO = {
  // Focus or hover: a tick you barely notice.
  move: [snap(5200, 0.035, 0, 0.01), pluck(19, 0.028, 0.04)],
  // A press: the key's snap and thump, then a rising two-note blip.
  select: [snap(2600, 0.09, 0, 0.014), thump(190, 0.12), pluck(12, 0.05, 0.07, 0.012), pluck(19, 0.09, 0.06, 0.045)],
  // Back or cancel: the same press, falling.
  back: [snap(2200, 0.08, 0, 0.014), thump(170, 0.11), pluck(12, 0.05, 0.065, 0.012), pluck(7, 0.09, 0.055, 0.045)],
  // A bigger yes (resetting, riding): the press with a low root under it.
  confirm: [snap(2600, 0.09, 0, 0.014), thump(200, 0.14, 0, 0.07), pluck(12, 0.05, 0.07, 0.012), pluck(19, 0.12, 0.06, 0.045), pluck(-12, 0.22, 0.08, 0.045), pluck(24, 0.16, 0.025, 0.06, 'sine')],
  // Locked or not allowed: a dull bonk, two flat notes rubbing.
  locked: [
    { type: 'triangle', from: 196, to: 180, dur: 0.11, gain: 0.1 },
    { type: 'square', from: 98, to: 92, dur: 0.08, gain: 0.03 },
    { type: 'noise', from: 500, dur: 0.03, gain: 0.06, q: 1 },
  ],
  toggleOn: [snap(3000, 0.07, 0, 0.01), pluck(7, 0.04, 0.07), pluck(14, 0.07, 0.07, 0.04)],
  toggleOff: [snap(2400, 0.07, 0, 0.01), pluck(9, 0.04, 0.065), pluck(2, 0.07, 0.06, 0.04)],
  // A notch on a slider; played at a pitch that follows the value.
  sliderTick: [pluck(12, 0.022, 0.05), snap(6000, 0.025, 0, 0.008)],
  // A page or tab: a card flicked over.
  pageTurn: [{ type: 'noise', from: 1800, to: 5200, dur: 0.09, gain: 0.06, attack: 0.02 }, snap(4200, 0.03, 0.07, 0.02), pluck(7, 0.03, 0.03, 0.02)],
  // A list scrolling by one row.
  listScroll: [snap(4200, 0.045, 0, 0.01), pluck(24, 0.018, 0.04)],
  // A letter of dialogue; played at each speaker's own pitch.
  talkBlip: [pluck(7, 0.04, 0.026, 0, 'square'), pluck(7, 0.045, 0.045)],
  dialogNext: [snap(3400, 0.05), pluck(12, 0.03, 0.05), pluck(16, 0.05, 0.045, 0.03)],
  // Looking at something: a curious little lift.
  lookAt: [{ type: 'triangle', from: note(12), to: note(19), dur: 0.1, gain: 0.05 }, pluck(24, 0.14, 0.035, 0.08, 'sine')],
  // Walking up to someone to talk: "hey!"
  npcHey: [pluck(4, 0.05, 0.03, 0, 'square'), pluck(4, 0.05, 0.05), pluck(11, 0.08, 0.05, 0.06), pluck(11, 0.07, 0.02, 0.06, 'square')],
  // The way out opening: a latch, then a chime.
  unlock: [snap(2400, 0.06, 0, 0.02), thump(300, 0.08), ...arpeggio([0, 7, 12, 19], 0.06, 0.25, 0.07, 'sine').map((l) => ({ ...l, delay: (l.delay ?? 0) + 0.05 })), { type: 'noise', from: 7000, dur: 0.3, gain: 0.02, delay: 0.2 }],
  // A footstep, played a touch higher on wood and tiles than on the street.
  step: [{ type: 'noise', from: 380, dur: 0.045, gain: 0.05, q: 1.4 }, thump(110, 0.06, 0, 0.05), snap(2400, 0.015, 0, 0.012)],
  // The train doors running on their rollers.
  doorSlide: [{ type: 'noise', from: 300, to: 240, dur: 0.6, gain: 0.05, attack: 0.08, q: 1.2 }, { type: 'sine', from: 55, dur: 0.55, gain: 0.04, attack: 0.1 }],
  // Pulling away: wheels over the rail joints, faster and faster, over a low rumble.
  trainRoll: [
    ...clack(0, 0.7),
    ...clack(0.11, 0.6),
    ...clack(0.55, 0.85),
    ...clack(0.64, 0.75),
    ...clack(0.95),
    ...clack(1.02, 0.9),
    ...clack(1.27),
    ...clack(1.33, 0.9),
    { type: 'noise', from: 160, dur: 1.6, gain: 0.06, attack: 0.5, q: 0.8 },
  ],
  // Coming into a station: the brakes' squeal over the rumble dying away.
  brakeSqueal: [
    { type: 'sine', from: 2350, to: 2150, dur: 0.9, gain: 0.02, attack: 0.25 },
    { type: 'sine', from: 3480, to: 3200, dur: 0.8, gain: 0.01, attack: 0.3 },
    { type: 'noise', from: 3000, to: 2600, dur: 0.9, gain: 0.025, attack: 0.2, q: 12 },
    { type: 'noise', from: 400, to: 180, dur: 1.0, gain: 0.05, attack: 0.05, q: 0.8 },
  ],
  // A stop picked on the route map; each stop sits on its own note.
  mapPin: [snap(3200, 0.06), pluck(12, 0.04, 0.06), pluck(24, 0.08, 0.025, 0.02, 'sine')],
  // The backup changing: a card shuffled to the front.
  backupCycle: [{ type: 'noise', from: 2600, to: 5200, dur: 0.06, gain: 0.06, attack: 0.01 }, snap(3800, 0.05, 0.06, 0.015), pluck(9, 0.04, 0.045, 0.05)],
  // Line-up cards: picked up, put down, swapped.
  cardPick: [{ type: 'noise', from: 3000, to: 5600, dur: 0.05, gain: 0.05, attack: 0.01 }, { type: 'triangle', from: note(7), to: note(12), dur: 0.06, gain: 0.055 }],
  cardDrop: [thump(210, 0.12, 0, 0.07), snap(1400, 0.08, 0, 0.025), pluck(0, 0.05, 0.04, 0.01)],
  cardSwap: [{ type: 'noise', from: 2000, to: 5000, dur: 0.07, gain: 0.05, attack: 0.02 }, { type: 'noise', from: 5000, to: 2000, dur: 0.07, gain: 0.05, delay: 0.08, attack: 0.02 }, pluck(7, 0.04, 0.04, 0.07)],
  // The results' numbers counting up, and a badge popping in.
  countTick: [pluck(24, 0.018, 0.035), snap(7000, 0.02, 0, 0.006)],
  tick: [pluck(24, 0.018, 0.035), snap(7000, 0.02, 0, 0.006)],
  badgePop: [{ type: 'sine', from: 380, to: 1100, dur: 0.06, gain: 0.09 }, pluck(24, 0.1, 0.06, 0.04), { type: 'noise', from: 6000, dur: 0.05, gain: 0.025, delay: 0.04 }],
  // Pause: the tape winding down and the key clunking. Unpause: the reverse.
  pauseOpen: [{ type: 'sawtooth', from: 320, to: 70, dur: 0.22, gain: 0.05 }, { type: 'noise', from: 2400, to: 300, dur: 0.2, gain: 0.06 }, thump(140, 0.1, 0.2, 0.06), snap(800, 0.06, 0.2, 0.015)],
  pauseClose: [thump(150, 0.1, 0, 0.05), snap(700, 0.07, 0, 0.03), { type: 'sawtooth', from: 80, to: 330, dur: 0.2, gain: 0.025, delay: 0.04, attack: 0.05 }],
} satisfies Partial<Record<SfxName, Layer[]>>;

/** A reel winding for a moment: the motor's buzz and the tape's whirr gliding up (forward) or down (rewind), with the spools ticking. */
function wind(forward: boolean): Layer[] {
  const [lo, hi] = forward ? [1, 1.9] : [1.9, 1];
  // The spools tick faster as they get going, and slower as they run down.
  const ticks = forward ? [0.03, 0.075, 0.11, 0.14, 0.165, 0.185, 0.205] : [0.03, 0.05, 0.07, 0.095, 0.125, 0.16, 0.2];
  return [
    { type: 'sawtooth', from: 85 * lo, to: 85 * hi, dur: 0.24, gain: 0.016, attack: 0.05 },
    { type: 'noise', from: 1500 * lo, to: 1500 * hi, dur: 0.24, gain: 0.06, attack: 0.05, q: 2.5 },
    { type: 'noise', from: 6500, dur: 0.22, gain: 0.014, attack: 0.06 },
    ...ticks.map((delay, i) => snap(3800 * (forward ? 1 + i * 0.05 : 1.3 - i * 0.05), 0.022, delay, 0.006)),
  ];
}

/**
 * The main menu: a desk of cassettes and a tape deck. A tape is picked up
 * (tapeLift), its reels wind forward or back as the choice moves, a marker
 * ticks it; played, it slides over (tapeSlide), seats with the door shutting
 * (tapeInsert), the play key latches (tapePlay) and the motor spins up
 * (tapeMotor). Backing out presses eject and the door springs open. The lift,
 * insert and motor are recorded (see SAMPLES); these are their stand-ins.
 */
const CASSETTE = {
  tapeLift: [snap(3800, 0.04, 0, 0.008), snap(2600, 0.07, 0.025, 0.016), thump(260, 0.05, 0.025, 0.035)],
  tapeForward: wind(true),
  tapeRewind: wind(false),
  // A felt tip's check mark: a short stroke down, a longer flick up with a squeak in it.
  marker: [
    { type: 'noise', from: 2600, to: 2000, dur: 0.035, gain: 0.08, attack: 0.008, q: 3 },
    { type: 'noise', from: 3000, to: 4800, dur: 0.075, gain: 0.08, delay: 0.045, attack: 0.015, q: 3 },
    { type: 'sine', from: 2900, to: 3500, dur: 0.05, gain: 0.008, delay: 0.055, attack: 0.01 },
  ],
  // The tape gliding over the desk to the deck.
  tapeSlide: [{ type: 'noise', from: 900, to: 2600, dur: 0.3, gain: 0.03, attack: 0.18, q: 0.8 }],
  tapeInsert: [snap(2000, 0.1, 0, 0.02), thump(190, 0.12, 0, 0.06), snap(1500, 0.07, 0.07, 0.02), thump(150, 0.1, 0.07, 0.07)],
  // The play key: a clunk as it latches.
  tapePlay: [
    { type: 'noise', from: 700, dur: 0.05, gain: 0.14 },
    { type: 'triangle', from: 150, to: 80, dur: 0.09, gain: 0.14 },
    { type: 'noise', from: 3200, dur: 0.012, gain: 0.08, delay: 0.035 },
  ],
  tapeMotor: [
    { type: 'sawtooth', from: 55, to: 110, dur: 0.55, gain: 0.018, attack: 0.12 },
    { type: 'noise', from: 900, to: 1800, dur: 0.55, gain: 0.03, attack: 0.15, q: 2 },
    { type: 'noise', from: 6000, dur: 0.6, gain: 0.02, attack: 0.2, q: 0.6 },
  ],
  // The eject key and the door springing open...
  tapeEject: [
    { type: 'noise', from: 1400, to: 500, dur: 0.07, gain: 0.12 },
    { type: 'triangle', from: 260, to: 620, dur: 0.1, gain: 0.08, delay: 0.04 },
    { type: 'noise', from: 2600, dur: 0.02, gain: 0.07, delay: 0.12 },
  ],
  // ...and its spring ringing out: two detuned tones beating against each other, with a rattle.
  tapeSpring: [
    snap(3000, 0.04, 0, 0.012),
    { type: 'triangle', from: 540, to: 500, dur: 0.2, gain: 0.03 },
    { type: 'triangle', from: 556, to: 512, dur: 0.2, gain: 0.025 },
    { type: 'sine', from: 1320, to: 1260, dur: 0.12, gain: 0.012 },
    { type: 'noise', from: 2200, dur: 0.07, gain: 0.025, delay: 0.01, q: 6 },
  ],
  // Bumping the end of the row: a soft knock on the desk.
  deskBump: [thump(130, 0.08, 0, 0.08), { type: 'noise', from: 500, dur: 0.04, gain: 0.05, q: 1.2 }, snap(1800, 0.025, 0, 0.01)],
} satisfies Partial<Record<SfxName, Layer[]>>;

const RECIPES: Record<SfxName, Layer[]> = {
  // The train: a two-tone chime before the doors move, the air hiss as they slide, the bump as they meet.
  doorChime: [
    { type: 'sine', from: note(4), dur: 0.5, gain: 0.11, attack: 0.01 },
    { type: 'sine', from: note(16), dur: 0.35, gain: 0.03, attack: 0.01 },
    { type: 'sine', from: note(0), dur: 0.7, gain: 0.11, delay: 0.32, attack: 0.01 },
    { type: 'sine', from: note(12), dur: 0.45, gain: 0.03, delay: 0.32, attack: 0.01 },
  ],
  doorHiss: [
    { type: 'noise', from: 5200, to: 2400, dur: 0.5, gain: 0.07, attack: 0.03 },
    { type: 'noise', from: 900, to: 500, dur: 0.3, gain: 0.04, attack: 0.02 },
  ],
  doorThunk: [
    { type: 'sine', from: 140, to: 70, dur: 0.16, gain: 0.16 },
    { type: 'noise', from: 600, dur: 0.07, gain: 0.08 },
  ],
  // The rank landing on the results screen: a low thud with a paper slap.
  stamp: [
    { type: 'sine', from: 140, to: 55, dur: 0.22, gain: 0.22 },
    { type: 'noise', from: 900, dur: 0.08, gain: 0.12 },
    { type: 'noise', from: 3200, dur: 0.05, gain: 0.05, delay: 0.01 },
  ],
  ...MICRO,
  perfect: [
    { type: 'triangle', from: note(12), dur: 0.09, gain: 0.16 },
    { type: 'sine', from: note(19), dur: 0.14, gain: 0.1, delay: 0.02 },
    { type: 'noise', from: 6000, dur: 0.04, gain: 0.05 },
  ],
  good: [
    { type: 'triangle', from: note(7), dur: 0.08, gain: 0.14 },
    { type: 'noise', from: 4000, dur: 0.035, gain: 0.04 },
  ],
  hit: [
    { type: 'triangle', from: note(0), dur: 0.07, gain: 0.12 },
    { type: 'noise', from: 2500, dur: 0.03, gain: 0.035 },
  ],
  miss: [
    { type: 'sawtooth', from: 170, to: 70, dur: 0.16, gain: 0.13 },
    { type: 'noise', from: 400, dur: 0.1, gain: 0.08 },
  ],
  combo: arpeggio([0, 4, 7, 12], 0.05, 0.14, 0.12),
  bonus: [...arpeggio([12, 16, 19, 24], 0.04, 0.16, 0.1, 'sine'), { type: 'noise', from: 7000, dur: 0.25, gain: 0.03, delay: 0.1 }],
  banner: [{ type: 'noise', from: 500, to: 3500, dur: 0.22, gain: 0.07, attack: 0.12 }],
  round: [...arpeggio([0, 7, 12], 0.09, 0.22, 0.13, 'square'), { type: 'triangle', from: note(-12), dur: 0.4, gain: 0.12 }],
  cheer: CHEER_RECIPE,
  win: WIN_RECIPE,
  lose: LOSE_RECIPE,
  fail: [
    { type: 'sawtooth', from: 330, to: 220, dur: 0.25, gain: 0.14 },
    { type: 'sawtooth', from: 220, to: 90, dur: 0.5, gain: 0.14, delay: 0.25 },
  ],
  count: [{ type: 'square', from: 440, dur: 0.09, gain: 0.12 }],
  // Stand-ins for the countdown's recorded hits while they load.
  count3: COUNT_HIT(0),
  count2: COUNT_HIT(2),
  count1: COUNT_HIT(4),
  countGo: DROP_RECIPE,
  mcThree: [],
  mcTwo: [],
  mcOne: [],
  go: [
    { type: 'square', from: 880, dur: 0.2, gain: 0.12 },
    { type: 'triangle', from: 1320, dur: 0.24, gain: 0.08 },
  ],
  place: [{ type: 'triangle', from: 700, to: 900, dur: 0.04, gain: 0.16 }],
  remove: [{ type: 'triangle', from: 500, to: 300, dur: 0.05, gain: 0.16 }],
  flair: [...arpeggio([7, 12, 19], 0.06, 0.18, 0.1, 'sine'), { type: 'noise', from: 8000, dur: 0.12, gain: 0.03, delay: 0.12 }],
  ability: [
    { type: 'sawtooth', from: 220, to: 880, dur: 0.28, gain: 0.08 },
    ...arpeggio([12, 16, 19, 24], 0.05, 0.22, 0.11, 'square'),
    { type: 'noise', from: 1500, to: 6000, dur: 0.35, gain: 0.05, attack: 0.05 },
  ],
  warn: [
    { type: 'square', from: 990, dur: 0.06, gain: 0.08 },
    { type: 'square', from: 990, dur: 0.06, gain: 0.08, delay: 0.12 },
  ],
  zap: [
    { type: 'sawtooth', from: 1600, to: 180, dur: 0.22, gain: 0.09 },
    { type: 'noise', from: 3000, to: 600, dur: 0.25, gain: 0.06 },
  ],
  // A riser that lands on a bright chord as the stage tilts.
  hype: [
    { type: 'noise', from: 400, to: 7000, dur: 0.55, gain: 0.08, attack: 0.45 },
    { type: 'sawtooth', from: 110, to: 440, dur: 0.5, gain: 0.06, attack: 0.3 },
    { type: 'square', from: note(-12), to: note(0), dur: 0.5, gain: 0.05, attack: 0.35 },
    ...arpeggio([12, 16, 19, 24], 0.04, 0.3, 0.1, 'square').map((layer) => ({ ...layer, delay: (layer.delay ?? 0) + 0.48 })),
    { type: 'noise', from: 6000, dur: 0.4, gain: 0.05, delay: 0.5 },
  ],
  // The camera settling back: a short falling whoosh.
  hypeOut: [{ type: 'noise', from: 4000, to: 500, dur: 0.24, gain: 0.06, attack: 0.02 }],
  // The main menu's desk of tapes (see CASSETTE above).
  ...CASSETTE,
  // A card flicked over.
  paperFlip: [{ type: 'noise', from: 2200, to: 6500, dur: 0.14, gain: 0.07, attack: 0.03 }],

  // Battle hype. The turntable sounds are recorded scratches (see SAMPLES);
  // these rough stand-ins only play until the samples have loaded.
  djBaby: BABY_RECIPE,
  djChirp: [...stroke(700, 3200, 0.06, 0), ...stroke(800, 3400, 0.06, 0.15), ...stroke(800, 3600, 0.08, 0.3)],
  djTransform: BABY_RECIPE,
  djFlare: BABY_RECIPE,
  djCut: AIRHORN_RECIPE,
  djRewind: [...stroke(1000, 3400, 0.06, 0, 0.2), ...stroke(3400, 260, 0.38, 0.065, 0.2)],
  djBrake: [
    { type: 'sawtooth', from: 440, to: 36, dur: 0.8, gain: 0.07, attack: 0.01 },
    { type: 'square', from: 220, to: 22, dur: 0.8, gain: 0.04, attack: 0.01 },
    { type: 'noise', from: 2400, to: 160, dur: 0.7, gain: 0.05, attack: 0.01 },
  ],
  needleDrop: [
    { type: 'sine', from: 80, to: 45, dur: 0.14, gain: 0.2 },
    { type: 'noise', from: 3000, dur: 0.4, gain: 0.02, attack: 0.02 },
  ],
  boom: DROP_RECIPE,
  slam: DROP_RECIPE,
  subDrop: DROP_RECIPE,
  whoosh: [
    { type: 'noise', from: 500, to: 5200, dur: 0.26, gain: 0.14, attack: 0.2 },
    { type: 'noise', from: 5200, to: 1600, dur: 0.16, gain: 0.09, delay: 0.24, attack: 0.01 },
  ],
  // Flair full: a two-note ping that says "ready".
  ready: [
    { type: 'triangle', from: note(19), dur: 0.14, gain: 0.11 },
    { type: 'triangle', from: note(24), dur: 0.32, gain: 0.12, delay: 0.09 },
    { type: 'sine', from: note(36), dur: 0.22, gain: 0.03, delay: 0.09 },
  ],
  // A round taken: a quick fanfare. A round lost: a falling sting on the downbeat.
  roundWin: [
    ...arpeggio([0, 4, 7], 0.07, 0.16, 0.11, 'square'),
    { type: 'square', from: note(12), dur: 0.4, gain: 0.1, delay: 0.21 },
    { type: 'triangle', from: note(16), dur: 0.4, gain: 0.08, delay: 0.21 },
    { type: 'sine', from: note(-12), dur: 0.5, gain: 0.12, delay: 0.21 },
  ],
  roundLose: [
    { type: 'sawtooth', from: note(-5), dur: 0.16, gain: 0.08 },
    { type: 'sawtooth', from: note(-6), to: note(-13), dur: 0.5, gain: 0.08, delay: 0.17 },
    { type: 'sine', from: 90, to: 45, dur: 0.35, gain: 0.18, delay: 0.17 },
  ],
  // Each backup's ability lands with its own colour: Pear steady and low,
  // Second Wind lifting, Eureka sparkling, Rind a crunchy shell.
  abilitySteady: [
    { type: 'sine', from: 110, to: 70, dur: 0.3, gain: 0.2 },
    { type: 'triangle', from: note(-12), dur: 0.55, gain: 0.08, delay: 0.04 },
    { type: 'triangle', from: note(-5), dur: 0.55, gain: 0.07, delay: 0.04 },
  ],
  abilitySecondWind: [
    { type: 'triangle', from: note(0), to: note(12), dur: 0.32, gain: 0.1 },
    { type: 'noise', from: 900, to: 6000, dur: 0.35, gain: 0.05, attack: 0.1 },
    { type: 'triangle', from: note(19), dur: 0.3, gain: 0.08, delay: 0.3 },
  ],
  abilityEureka: [
    { type: 'sine', from: note(24), dur: 0.35, gain: 0.08 },
    { type: 'sine', from: note(28), dur: 0.35, gain: 0.07, delay: 0.06 },
    { type: 'sine', from: note(31), dur: 0.4, gain: 0.07, delay: 0.12 },
    { type: 'sine', from: note(36), dur: 0.45, gain: 0.05, delay: 0.18 },
    { type: 'noise', from: 8000, dur: 0.3, gain: 0.03, delay: 0.05 },
  ],
  abilityRind: [
    { type: 'square', from: 150, to: 60, dur: 0.2, gain: 0.1 },
    { type: 'noise', from: 900, dur: 0.14, gain: 0.12 },
    { type: 'triangle', from: 75, to: 45, dur: 0.3, gain: 0.16, delay: 0.02 },
  ],
  // Stand-ins for the recorded hype samples while they load.
  airhorn: AIRHORN_RECIPE,
  victory: WIN_RECIPE,
  defeat: LOSE_RECIPE,
  crowdCheer: CHEER_RECIPE,
  crowdOhh: [{ type: 'noise', from: 520, to: 360, dur: 0.9, gain: 0.07, attack: 0.15, q: 2 }],
  crowdRoar: CHEER_RECIPE,
  crowdBed: [],
  mcRound1: [],
  mcRound2: [],
  mcRound3: [],
  mcRound4: [],
  mcFinal: [],
  mcHype: [],
  mcFlawless: [],
  mcCombo: [],
  mcCrowdWild: [],
  mcWinner: [],
  mcOhNo: [],
  mcLetsDance: [],
};

/**
 * Recorded sounds, generated with Higgsfield and trimmed, made mono and
 * normalised. Menu sounds and the crowd come from the Mirelo sound model, the
 * stingers from ElevenLabs music, and the MC from ElevenLabs v4 (a shouted
 * arena read, put through a live-mic chain). The turntable sounds scratch a
 * shouted stab from the same voice; tools/build_sfx.py builds the MC, the
 * turntable, the impacts, the crowd roar and the menu's tape deck (a tape
 * lifted, a tape seating as the door shuts, the motor spinning up).
 */
const SAMPLES: Partial<Record<SfxName, { file: string; gain: number }>> = {
  tapeLift: { file: 'assets/audio/sfx/tape_lift.mp3', gain: 0.14 },
  tapeInsert: { file: 'assets/audio/sfx/tape_insert.mp3', gain: 0.4 },
  tapeMotor: { file: 'assets/audio/sfx/tape_motor.mp3', gain: 0.12 },
  tapePlay: { file: 'assets/audio/sfx/tape_play.mp3', gain: 0.45 },
  tapeEject: { file: 'assets/audio/sfx/tape_eject.mp3', gain: 0.5 },
  paperFlip: { file: 'assets/audio/sfx/paper_flip.mp3', gain: 0.5 },
  airhorn: { file: 'assets/audio/sfx/airhorn.mp3', gain: 0.38 },
  djBaby: { file: 'assets/audio/sfx/dj_baby.mp3', gain: 0.5 },
  djChirp: { file: 'assets/audio/sfx/dj_chirp.mp3', gain: 0.5 },
  djTransform: { file: 'assets/audio/sfx/dj_transform.mp3', gain: 0.5 },
  djFlare: { file: 'assets/audio/sfx/dj_flare.mp3', gain: 0.5 },
  djCut: { file: 'assets/audio/sfx/dj_cut.mp3', gain: 0.4 },
  djRewind: { file: 'assets/audio/sfx/dj_rewind.mp3', gain: 0.55 },
  djBrake: { file: 'assets/audio/sfx/dj_brake.mp3', gain: 0.55 },
  needleDrop: { file: 'assets/audio/sfx/needle_drop.mp3', gain: 0.4 },
  boom: { file: 'assets/audio/sfx/boom.mp3', gain: 0.75 },
  slam: { file: 'assets/audio/sfx/slam.mp3', gain: 0.8 },
  subDrop: { file: 'assets/audio/sfx/sub_drop.mp3', gain: 0.75 },
  crowdRoar: { file: 'assets/audio/sfx/crowd_roar.mp3', gain: 0.55 },
  victory: { file: 'assets/audio/sfx/stinger_victory.mp3', gain: 0.5 },
  defeat: { file: 'assets/audio/sfx/stinger_lose.mp3', gain: 0.5 },
  crowdCheer: { file: 'assets/audio/sfx/crowd_cheer.mp3', gain: 0.5 },
  crowdOhh: { file: 'assets/audio/sfx/crowd_ohh.mp3', gain: 0.45 },
  crowdBed: { file: 'assets/audio/sfx/crowd_bed.mp3', gain: 1 },
  mcRound1: { file: 'assets/audio/sfx/mc_round1.mp3', gain: 0.55 },
  mcRound2: { file: 'assets/audio/sfx/mc_round2.mp3', gain: 0.55 },
  mcRound3: { file: 'assets/audio/sfx/mc_round3.mp3', gain: 0.55 },
  mcRound4: { file: 'assets/audio/sfx/mc_round4.mp3', gain: 0.55 },
  mcFinal: { file: 'assets/audio/sfx/mc_final.mp3', gain: 0.55 },
  mcHype: { file: 'assets/audio/sfx/mc_hype.mp3', gain: 0.55 },
  mcFlawless: { file: 'assets/audio/sfx/mc_flawless.mp3', gain: 0.55 },
  mcCombo: { file: 'assets/audio/sfx/mc_combo.mp3', gain: 0.55 },
  mcCrowdWild: { file: 'assets/audio/sfx/mc_crowdwild.mp3', gain: 0.55 },
  mcWinner: { file: 'assets/audio/sfx/mc_winner.mp3', gain: 0.55 },
  mcOhNo: { file: 'assets/audio/sfx/mc_ohno.mp3', gain: 0.55 },
  mcLetsDance: { file: 'assets/audio/sfx/mc_letsdance.mp3', gain: 0.55 },
  mcThree: { file: 'assets/audio/sfx/mc_three.mp3', gain: 0.55 },
  mcTwo: { file: 'assets/audio/sfx/mc_two.mp3', gain: 0.55 },
  mcOne: { file: 'assets/audio/sfx/mc_one.mp3', gain: 0.55 },
  count3: { file: 'assets/audio/sfx/count_3.mp3', gain: 0.6 },
  count2: { file: 'assets/audio/sfx/count_2.mp3', gain: 0.6 },
  count1: { file: 'assets/audio/sfx/count_1.mp3', gain: 0.6 },
  countGo: { file: 'assets/audio/sfx/count_go.mp3', gain: 0.7 },
};

/** A sound's recorded sample and its level, if it has one (for offline renders). */
export function sampleSpec(name: SfxName): { file: string; gain: number } | undefined {
  return SAMPLES[name];
}

/** The sample files, for the asset checks. */
export const SAMPLE_FILES: readonly string[] = Object.values(SAMPLES).map((sample) => sample.file);

/** Decoded samples; null once a sample has failed, so it stops being retried. */
const decoded = new Map<SfxName, AudioBuffer | null>();
const pending = new Set<SfxName>();

/** Start fetching the recorded samples. Safe to call more than once. */
export function preloadSamples(game: Phaser.Game): void {
  const ctx = getAudioContext(game);
  for (const [name, sample] of Object.entries(SAMPLES) as [SfxName, { file: string; gain: number }][]) {
    if (decoded.has(name) || pending.has(name)) continue;
    pending.add(name);
    fetch(sample.file)
      .then((response) => {
        if (!response.ok) throw new Error(`${sample.file}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then(
        (buffer) => decoded.set(name, buffer),
        () => decoded.set(name, null),
      )
      .finally(() => pending.delete(name));
  }
}

let noiseBuffer: AudioBuffer | null = null;

function getNoise(ctx: BaseAudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** A sound that is playing, which can be cut short. */
export interface Voice {
  /** Seconds from its start to its end. */
  readonly duration: number;
  /** Fade it out quickly and stop it. */
  stop(): void;
}

/** A decoded sample, if it has loaded. */
export function sampleBuffer(name: SfxName): AudioBuffer | null {
  return decoded.get(name) ?? null;
}

/** How long a sound lasts: its sample once loaded, else its synthesised layers. */
export function sfxDuration(name: SfxName): number {
  const buffer = decoded.get(name);
  if (buffer && SAMPLES[name]) return buffer.duration;
  return RECIPES[name].reduce((end, layer) => Math.max(end, (layer.delay ?? 0) + layer.dur), 0);
}

/** Where a sound goes: straight out, or through the hype limiter. */
export type Bus = 'main' | 'hype';

const hypeBuses = new WeakMap<BaseAudioContext, AudioNode>();
const masterBuses = new WeakMap<BaseAudioContext, AudioNode>();

/**
 * A transparent safety ceiling just under full scale for the battle song and
 * the hype bus together, so a boom landing on a loud bar never clips.
 */
export function masterInput(ctx: BaseAudioContext): AudioNode {
  let input = masterBuses.get(ctx);
  if (!input) {
    const ceiling = ctx.createDynamicsCompressor();
    ceiling.threshold.value = -1.5;
    ceiling.knee.value = 0;
    ceiling.ratio.value = 20;
    ceiling.attack.value = 0.002;
    ceiling.release.value = 0.12;
    ceiling.connect(ctx.destination);
    masterBuses.set(ctx, ceiling);
    input = ceiling;
  }
  return input;
}

/**
 * The battle hype shares a limiter, so a pile-up of booms, horns, the crowd
 * and the MC can be loud without clipping. Hit and menu sounds skip it, so
 * they never pump.
 */
export function busInput(ctx: BaseAudioContext, bus: Bus): AudioNode {
  if (bus === 'main') return ctx.destination;
  let input = hypeBuses.get(ctx);
  if (!input) {
    const limiter = ctx.createDynamicsCompressor();
    // Low enough that the hype plus the (ducked) song stays under full scale.
    limiter.threshold.value = -10;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.15;
    limiter.connect(masterInput(ctx));
    hypeBuses.set(ctx, limiter);
    input = limiter;
  }
  return input;
}

/** Wrap scheduled sources as a Voice that disconnects `out` once they all end. */
function voiceOf(ctx: BaseAudioContext, out: GainNode, sources: AudioScheduledSourceNode[], duration: number): Voice {
  let playing = sources.length;
  for (const source of sources) source.onended = () => --playing === 0 && out.disconnect();
  return {
    duration,
    stop: () => {
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + 0.08);
      for (const source of sources) {
        try {
          source.stop(now + 0.1);
        } catch {
          // Already stopped.
        }
      }
    },
  };
}

/**
 * Sounds that can fire many times a second (a held key, a fast typewriter, a
 * dragged slider) play at most once per this many seconds, so they never buzz.
 */
export const GAPS: Partial<Record<SfxName, number>> = {
  move: 0.035,
  sliderTick: 0.035,
  listScroll: 0.05,
  talkBlip: 0.045,
  countTick: 0.04,
  tick: 0.04,
  step: 0.09,
  tapeLift: 0.05,
  marker: 0.05,
};

/** Sounds that repeat get up to this much random pitch spread (a ratio), so a run of them never sounds mechanical. */
export const JITTER: Partial<Record<SfxName, number>> = {
  step: 0.08,
  talkBlip: 0.04,
  move: 0.02,
  countTick: 0.02,
  listScroll: 0.03,
  tapeLift: 0.06,
  marker: 0.05,
};

const lastPlayed = new Map<SfxName, number>();

/** True if `name` may play at `now`: it was not heard within its gap. Records the play. */
export function allowRepeat(name: SfxName, now: number, last: Map<SfxName, number> = lastPlayed): boolean {
  const gap = GAPS[name];
  if (gap === undefined) return true;
  const before = last.get(name);
  if (before !== undefined && now - before < gap && now >= before) return false;
  last.set(name, now);
  return true;
}

/**
 * Start a sound `delay` seconds from now, scaled by `gain` and the Sound volume.
 * `rate` shifts its pitch (2 is an octave up). Returns null when nothing will
 * play (muted, audio locked, a sample-only sound that has not loaded, or a
 * fast-repeating sound inside its gap).
 */
export function startSfx(game: Phaser.Game, name: SfxName, delay = 0, gain = 1, bus: Bus = 'main', rate = 1): Voice | null {
  const volume = getSettings().sfxVolume * gain;
  if (volume <= 0) return null;
  const ctx = getAudioContext(game);
  if (ctx.state !== 'running') return null;
  const at = ctx.currentTime + delay;
  if (!allowRepeat(name, at)) return null;
  const spread = JITTER[name];
  if (spread) rate *= 1 + (Math.random() * 2 - 1) * spread;
  const out = ctx.createGain();
  out.connect(busInput(ctx, bus));
  const sources: AudioScheduledSourceNode[] = [];
  const buffer = decoded.get(name);
  const sample = SAMPLES[name];
  if (buffer && sample) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    out.gain.value = sample.gain * volume;
    source.connect(out);
    source.start(at);
    sources.push(source);
  } else {
    if (RECIPES[name].length === 0) {
      out.disconnect();
      return null;
    }
    sources.push(...scheduleRecipe(ctx, name, at, volume, out, rate));
  }
  return voiceOf(ctx, out, sources, sfxDuration(name) / (buffer && sample ? rate : 1));
}

/** How loud the menu's tape hiss sits, before the Sound volume: well under the menu music. */
export const DECK_HISS_GAIN = 0.0045;

/**
 * The tape deck on the menu desk, switched on: a faint hiss that loops for as
 * long as the menu is open, fading in so it is never noticed arriving. Null
 * when muted or when audio is still locked.
 */
export function startDeckHiss(game: Phaser.Game): Voice | null {
  const volume = getSettings().sfxVolume;
  if (volume <= 0) return null;
  const ctx = getAudioContext(game);
  if (ctx.state !== 'running') return null;
  // Its own few seconds of noise: the shared one-second buffer would be heard repeating once a second.
  const noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 4.3), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  // Tape hiss is mostly top end.
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 2500;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 9000;
  const out = ctx.createGain();
  const now = ctx.currentTime;
  out.gain.setValueAtTime(0, now);
  out.gain.linearRampToValueAtTime(DECK_HISS_GAIN * volume, now + 1.5);
  source.connect(high).connect(low).connect(out).connect(busInput(ctx, 'main'));
  source.start(now);
  return voiceOf(ctx, out, [source], Infinity);
}

/** The turntable moves that can be made live from the battle song. */
export type RecordMove = 'djRewind' | 'djBrake';

export function isRecordMove(name: SfxName): name is RecordMove {
  return name === 'djRewind' || name === 'djBrake';
}

const SPINBACK = 0.62;
const CATCH = 0.06;
const BRAKE = 1.0;
/** Song audio is mastered hot: a record move sits a little under the hype samples. */
const RECORD_GAIN = 0.6;

export function recordMoveDuration(move: RecordMove): number {
  return move === 'djRewind' ? SPINBACK : BRAKE;
}

/**
 * Schedule a turntable move on `song` at song position `position`: a spinback
 * (the record caught, then whipped backwards faster and faster, so you hear
 * the last second of the song in reverse) or a brake (the motor cut and the
 * platter coasting to a stop). Used live and to render the sounds offline.
 */
export function scheduleRecordMove(
  ctx: BaseAudioContext,
  move: RecordMove,
  song: AudioBuffer,
  position: number,
  at: number,
  volume: number,
  out: AudioNode,
): AudioScheduledSourceNode[] {
  const pos = Math.min(Math.max(position, 0), Math.max(0, song.duration - 0.05));
  const level = volume * RECORD_GAIN;
  if (move === 'djBrake') {
    const source = ctx.createBufferSource();
    source.buffer = song;
    source.playbackRate.setValueAtTime(1, at);
    source.playbackRate.linearRampToValueAtTime(0.03, at + BRAKE * 0.95);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, at);
    gain.gain.setValueAtTime(level, at + BRAKE - 0.25);
    gain.gain.linearRampToValueAtTime(0.0001, at + BRAKE);
    source.connect(gain).connect(out);
    source.start(at, pos);
    source.stop(at + BRAKE + 0.02);
    return [source];
  }
  // The hand lands on the record: a few milliseconds of the song slowing to a stop...
  const grab = ctx.createBufferSource();
  grab.buffer = song;
  grab.playbackRate.setValueAtTime(1, at);
  grab.playbackRate.linearRampToValueAtTime(0.05, at + CATCH);
  const grabGain = ctx.createGain();
  grabGain.gain.setValueAtTime(level, at);
  grabGain.gain.linearRampToValueAtTime(0.0001, at + CATCH);
  grab.connect(grabGain).connect(out);
  grab.start(at, pos);
  grab.stop(at + CATCH + 0.01);
  const span = Math.min(pos, 3);
  if (span < 0.3) return [grab];
  // ...then the song before that point, backwards, faster and faster.
  const rate = song.sampleRate;
  const length = Math.floor(span * rate);
  const from = Math.floor(pos * rate);
  const reversed = ctx.createBuffer(song.numberOfChannels, length, rate);
  for (let channel = 0; channel < song.numberOfChannels; channel++) {
    const src = song.getChannelData(channel);
    const dst = reversed.getChannelData(channel);
    for (let i = 0; i < length; i++) dst[i] = src[from - 1 - i];
  }
  const back = ctx.createBufferSource();
  back.buffer = reversed;
  const start = at + CATCH;
  const end = at + SPINBACK;
  back.playbackRate.setValueAtTime(0.3, start);
  back.playbackRate.exponentialRampToValueAtTime(5, end);
  const backGain = ctx.createGain();
  backGain.gain.setValueAtTime(0.0001, start);
  backGain.gain.linearRampToValueAtTime(level, start + 0.05);
  backGain.gain.setValueAtTime(level, end - 0.2);
  backGain.gain.linearRampToValueAtTime(0.0001, end);
  back.connect(backGain).connect(out);
  back.start(start, 0);
  back.stop(end + 0.02);
  return [grab, back];
}

/** A record move made from the battle song, through the hype limiter. Null when muted or locked. */
export function startRecordMove(game: Phaser.Game, move: RecordMove, song: AudioBuffer, position: number, delay = 0): Voice | null {
  const volume = getSettings().sfxVolume;
  if (volume <= 0) return null;
  const ctx = getAudioContext(game);
  if (ctx.state !== 'running') return null;
  const out = ctx.createGain();
  out.connect(busInput(ctx, 'hype'));
  const sources = scheduleRecordMove(ctx, move, song, position, ctx.currentTime + delay, volume, out);
  return voiceOf(ctx, out, sources, recordMoveDuration(move));
}

/** Play a sound now. `rate` shifts its pitch (a speaker's voice, a slider's value, a footstep's floor). */
export function playSfx(game: Phaser.Game, name: SfxName, rate = 1): void {
  startSfx(game, name, 0, 1, 'main', rate);
}

/** Schedule a sound's synthesised layers into `out` (also used to render the sounds offline). */
export function scheduleRecipe(ctx: BaseAudioContext, name: SfxName, at: number, volume: number, out: AudioNode, rate = 1): AudioScheduledSourceNode[] {
  return RECIPES[name].map((layer) => playLayer(ctx, rate === 1 ? layer : { ...layer, from: layer.from * rate, to: layer.to === undefined ? undefined : layer.to * rate }, at, volume, out));
}

/** How long a sound's synthesised layers last, in seconds. */
export function recipeLength(name: SfxName): number {
  return RECIPES[name].reduce((end, layer) => Math.max(end, (layer.delay ?? 0) + layer.dur), 0);
}

/** The loudest single layer of a sound's recipe (for the tests: micro sounds stay quiet). */
export function recipePeak(name: SfxName): number {
  return RECIPES[name].reduce((peak, layer) => Math.max(peak, layer.gain), 0);
}

/** Every sound name. */
export const SFX_NAMES = Object.keys(RECIPES) as SfxName[];

function playLayer(ctx: BaseAudioContext, layer: Layer, at: number, volume: number, out: AudioNode): AudioScheduledSourceNode {
  const start = at + (layer.delay ?? 0);
  const end = start + layer.dur;
  const attack = Math.min(layer.attack ?? 0.005, layer.dur * 0.8);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(layer.gain * volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(out);

  if (layer.type === 'noise') {
    const source = ctx.createBufferSource();
    source.buffer = getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = layer.q ?? 0.9;
    filter.frequency.setValueAtTime(layer.from, start);
    if (layer.to !== undefined) filter.frequency.linearRampToValueAtTime(layer.to, end);
    source.connect(filter).connect(gain);
    source.start(start, Math.random() * 0.5);
    source.stop(end + 0.02);
    return source;
  }
  const osc = ctx.createOscillator();
  osc.type = layer.type;
  osc.frequency.setValueAtTime(layer.from, start);
  if (layer.to !== undefined) osc.frequency.linearRampToValueAtTime(layer.to, end);
  osc.connect(gain);
  osc.start(start);
  osc.stop(end + 0.02);
  return osc;
}
