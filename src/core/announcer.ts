import type Phaser from 'phaser';
import type { AbilityId } from '../story/types';
import { getSettings } from './settings';
import { busDuck, busInput, hypeBus, isRecordMove, sampleBuffer, startRecordMove, startSfx, type SfxName, type Voice } from './sfx';
import { getAudioContext } from './songs';

/**
 * Battle hype: the MC, the DJ, the crowd and the stingers. Game code reports
 * what happened as a HypeEvent; cueFor turns it into sounds, and HypeMixer
 * keeps them from piling up: one big callout at a time (a second one is
 * dropped unless it outranks the first), one stinger at a time, one crowd
 * reaction at a time, and the MC never talks over itself. Hit sounds do not
 * go through here, so they stay crisp whatever the mixer is doing.
 *
 * The song is the main thing. It is not turned down for hype moments; the
 * hype sits under it (see the buses in sfx.ts), and the crowd and stingers
 * dip under the MC instead. Only a spinback (which replaces the song for a
 * moment) and a miss's brief dip move the song.
 *
 * What plays when (stinger parts share one channel; delays in seconds;
 * "callout" cues take the one callout slot):
 *
 *   combo 10        chirp scratch
 *   combo 25        baby scratch, crossfader-cut horn .36
 *   combo 50, 75    boom, transformer scratch, cheer, "COMBO!"            callout
 *   combo 100+      boom, scratch flourish .15, roar, "THE CROWD GOES WILD!"  callout
 *   round 1         needle drop, "ROUND ONE!"                             callout
 *   rounds 2+       the song spun back, needle drop .62, "ROUND TWO!" .8   callout, song cut for the spinback
 *   round won       boom, fanfare, roar                                   callout
 *   round lost      falling sting, boom .17, "ohh"                        callout
 *   hype start      riser, baby scratch .08, sub drop .48, horn, roar, "HYPE!"  callout
 *   hype end        the song spun back ("ohh" too if a miss broke it)    song cut for the spinback
 *   miss            the song scrubbed by the DJ's hand (stray misses not too often),
 *                   sometimes "ohh"; a broken streak (10+) gets "aww" every time, and
 *                   the MC now and then: "Ooh! Dropped it!", "Whoa! Off beat!",
 *                   "Come on, get it back!", "Ouch! The streak is over!", "Oh no!"
 *                   (MissReactor in src/play/battleLife.ts decides)      .22 to .5, brief
 *   drop            the crowd cheers as the song drops
 *   flawless        a soft chime, "FLAWLESS!" (the line at most every 24 s;  callout
 *                   in between only the chime)
 *   ability         whoosh, the ability's hit and a boom .12, cheer
 *   lets dance      needle drop, "LET'S DANCE!"
 *   countdown       a hit and a scratch on each of 3, 2, 1 with "THREE!" "TWO!" "ONE!",
 *                   a bigger hit and scratch on go with "LET'S DANCE!" (see countCue)
 *   battle won      slam, horn, roar, "WINNER!"                           callout, song dips .6
 *   battle lost     falling sting, boom .17, "ohh", "OH NO!"              callout, song dips .3
 *   fail            the song braked to a stop, boom .9, "ohh", "OH NO!"
 *   results         victory or defeat stinger, roar or "ohh"
 *   crew won        victory stinger, slam, roar, "THE CROWD GOES WILD!"
 *
 * The spinback and the brake are made live from the battle song (see
 * HypeAudio); elsewhere they fall back to prepared samples.
 */
export type HypeEvent =
  | { kind: 'combo'; combo: number }
  /** A round about to start: `round` counts from 0, out of `total`. */
  | { kind: 'roundIntro'; round: number; total: number }
  | { kind: 'roundWon' }
  | { kind: 'roundLost' }
  | { kind: 'hypeStart' }
  /** `broken` when a miss ended it rather than the streak running its course. */
  | { kind: 'hypeEnd'; broken: boolean }
  | { kind: 'flawless' }
  | { kind: 'flairFull' }
  | { kind: 'ability'; ability: AbilityId }
  /** A miss that broke a long streak. */
  | { kind: 'bigMiss' }
  /** A miss, sized by MissReactor: what plays and how far the song dips. */
  | { kind: 'miss'; scratch: boolean; crowd: SfxName | null; line: SfxName | null; duck: number; duckLength: number }
  /** The song drops (the notes pile in after a build). */
  | { kind: 'drop' }
  | { kind: 'letsDance' }
  | { kind: 'battleWon' }
  | { kind: 'battleLost' }
  | { kind: 'fail' }
  | { kind: 'resultsWon' }
  | { kind: 'resultsLost' }
  | { kind: 'crewWon' };

/** One call of the 3-2-1: 0 is "3" and 3 is go. */
export type CountCall = 0 | 1 | 2 | 3;

/**
 * stinger: the big one-offs, one at a time. mc: the announcer, one line at a
 * time, queued briefly. crowd: one reaction at a time. fx: small sounds that
 * always play. call: an MC line that must land on the beat (the countdown):
 * it cuts off whatever the MC was saying instead of waiting.
 */
export type Channel = 'stinger' | 'mc' | 'crowd' | 'fx' | 'call';

export interface CuePart {
  sound: SfxName;
  channel: Channel;
  /** Seconds after the cue. */
  delay?: number;
}

export interface Cue {
  /** Higher wins a busy channel. */
  priority: number;
  parts: CuePart[];
  /** How far the song dips under the cue, 0..1. */
  duck?: number;
  /** Seconds the dip lasts; by default until the cue's stingers and crowd finish. */
  duckLength?: number;
  /** Dip the song even if none of the cue's stingers or crowd get to play (a miss's short dip). */
  duckAlways?: boolean;
  /**
   * A big moment. Only one callout plays at a time: another one arriving
   * while it lasts is dropped (only its fx parts play) unless it has a higher
   * priority, which cuts the first one off.
   */
  callout?: boolean;
  /** With `key`: after this cue plays, the same key plays only its fx parts for this many seconds. */
  cooldown?: number;
  key?: string;
}

const fx = (sound: SfxName, delay?: number): CuePart => ({ sound, channel: 'fx', delay });
const sting = (sound: SfxName, delay?: number): CuePart => ({ sound, channel: 'stinger', delay });
const mc = (sound: SfxName, delay?: number): CuePart => ({ sound, channel: 'mc', delay });
const crowd = (sound: SfxName, delay?: number): CuePart => ({ sound, channel: 'crowd', delay });
const call = (sound: SfxName): CuePart => ({ sound, channel: 'call' });

const COUNT_HITS: readonly SfxName[] = ['count3', 'count2', 'count1', 'countGo'];
const COUNT_LINES: readonly SfxName[] = ['mcThree', 'mcTwo', 'mcOne', 'mcLetsDance'];

/**
 * One call of the countdown. The hit always plays; the MC calls the number
 * when `say` is set (not while he is calling a round), and on go only when
 * `letsDance` is set too (a battle with rounds gets "Round one!" instead).
 */
export function countCue(index: CountCall, say: boolean, letsDance: boolean): Cue {
  const line = say && (index < 3 || letsDance) ? [call(COUNT_LINES[index])] : [];
  return { priority: 3, parts: [fx(COUNT_HITS[index]), ...line] };
}

const ABILITY_HITS: Record<AbilityId, SfxName> = {
  steady: 'abilitySteady',
  secondWind: 'abilitySecondWind',
  eureka: 'abilityEureka',
  rind: 'abilityRind',
};

/** 1 at a 10 streak, 2 at 25, 3 at 50 and 75, 4 at 100 and every 50 after. */
export function comboTier(combo: number): 0 | 1 | 2 | 3 | 4 {
  if (combo >= 100) return 4;
  if (combo >= 50) return 3;
  if (combo >= 25) return 2;
  if (combo >= 10) return 1;
  return 0;
}

/** The MC's call for a round: "Round one!" and so on, with the last one "Final round!". */
export function roundLine(round: number, total: number): SfxName {
  if (total > 1 && round === total - 1) return 'mcFinal';
  const lines: SfxName[] = ['mcRound1', 'mcRound2', 'mcRound3', 'mcRound4'];
  return lines[Math.min(round, lines.length - 1)];
}

/** How long a spinback holds the song down: it comes back as the needle drops. */
const SPINBACK_CUT = 0.62;
/** Seconds between two "Flawless!" lines: clean phrases come every few seconds. */
export const FLAWLESS_COOLDOWN = 24;

export function cueFor(event: HypeEvent): Cue {
  switch (event.kind) {
    case 'combo': {
      const tier = comboTier(event.combo);
      if (tier <= 1) return { priority: 1, parts: [fx('combo'), sting('djChirp')] };
      if (tier === 2) return { priority: 2, parts: [fx('combo'), sting('djBaby'), sting('djCut', 0.36)] };
      if (tier === 3) {
        return {
          priority: 3,
          callout: true,
          parts: [fx('combo'), sting('boom'), sting('djTransform', 0.05), crowd('crowdCheer', 0.15), mc('mcCombo', 0.45)],
        };
      }
      // The biggest streak call: no horn, no slam, the MC straight in after the scratch.
      return {
        priority: 4,
        callout: true,
        parts: [fx('combo'), sting('boom'), sting('djFlare', 0.15), crowd('crowdRoar', 0.1), mc('mcCrowdWild', 0.45)],
      };
    }
    case 'roundIntro':
      // The first round drops the needle; later ones are a DJ fill: the song spun back, then dropped back in.
      if (event.round === 0) return { priority: 3, callout: true, parts: [sting('needleDrop'), mc(roundLine(event.round, event.total), 0.25)] };
      return {
        priority: 5,
        callout: true,
        duck: 0.85,
        duckLength: SPINBACK_CUT,
        parts: [sting('djRewind'), sting('needleDrop', SPINBACK_CUT), mc(roundLine(event.round, event.total), 0.8)],
      };
    case 'roundWon':
      return { priority: 4, callout: true, parts: [sting('boom'), sting('roundWin'), crowd('crowdRoar', 0.05)] };
    case 'roundLost':
      return { priority: 4, callout: true, parts: [sting('roundLose'), sting('boom', 0.17), crowd('crowdOhh', 0.05)] };
    case 'hypeStart':
      // A scratch over the riser, into the drop at about half a second: the sub, the horn and the MC hit there.
      return {
        priority: 5,
        callout: true,
        parts: [fx('hype'), sting('djBaby', 0.08), sting('subDrop', 0.48), sting('airhorn', 0.52), crowd('crowdRoar', 0.45), mc('mcHype', 0.6)],
      };
    case 'hypeEnd':
      return {
        priority: 2,
        duck: 0.7,
        duckLength: SPINBACK_CUT,
        parts: [fx('hypeOut'), sting('djRewind'), ...(event.broken ? [crowd('crowdOhh', 0.2)] : [])],
      };
    case 'flawless':
      // Every clean phrase earns one, so it is the lightest callout: no scratch or crowd, and the line not every time.
      return { priority: 2, callout: true, key: 'flawless', cooldown: FLAWLESS_COOLDOWN, parts: [fx('bonus'), mc('mcFlawless', 0.05)] };
    case 'flairFull':
      return { priority: 1, parts: [fx('ready')] };
    case 'ability':
      return { priority: 3, parts: [fx('whoosh'), sting(ABILITY_HITS[event.ability], 0.12), sting('boom', 0.12), crowd('crowdCheer', 0.2)] };
    case 'bigMiss':
      return { priority: 1, parts: [crowd('crowdOhh')] };
    case 'miss': {
      // The scratch always plays when asked (MissReactor spaces them); the crowd and MC queue like any other.
      const parts: CuePart[] = [];
      if (event.scratch) parts.push(fx('djScrub'));
      if (event.crowd) parts.push(crowd(event.crowd, 0.08));
      if (event.line) parts.push(mc(event.line, 0.3));
      return { priority: 1, duck: event.duck, duckLength: event.duckLength, duckAlways: true, parts };
    }
    case 'drop':
      return { priority: 1, parts: [crowd('crowdCheer')] };
    case 'letsDance':
      return { priority: 2, callout: true, parts: [sting('needleDrop'), mc('mcLetsDance', 0.25)] };
    case 'battleWon':
      return { priority: 6, callout: true, duck: 0.6, parts: [sting('slam'), sting('airhorn', 0.05), crowd('crowdRoar'), mc('mcWinner', 0.35)] };
    case 'battleLost':
      return { priority: 6, callout: true, duck: 0.3, parts: [sting('roundLose'), sting('boom', 0.17), crowd('crowdOhh', 0.05), mc('mcOhNo', 0.4)] };
    case 'fail':
      return { priority: 7, callout: true, parts: [sting('djBrake'), sting('boom', 0.9), crowd('crowdOhh', 0.4), mc('mcOhNo', 0.8)] };
    case 'resultsWon':
      return { priority: 6, callout: true, parts: [sting('victory'), crowd('crowdRoar', 0.15)] };
    case 'resultsLost':
      return { priority: 6, callout: true, parts: [sting('defeat'), crowd('crowdOhh', 0.1)] };
    case 'crewWon':
      return { priority: 6, callout: true, parts: [sting('victory'), sting('slam'), crowd('crowdRoar', 0.2), mc('mcCrowdWild', 0.7)] };
  }
}

/** Plays one sound `delay` seconds from now; null if it could not play. */
export type PlayFn = (sound: SfxName, delay: number) => Voice | null;

/** An MC line waits at most this long for the one before it to finish. */
const MC_WAIT = 1.2;
/** A short breath between two MC lines. */
const MC_GAP = 0.12;
/** A countdown line holds the MC this long: its echo may ring under what follows. */
const CALL_HOLD = 0.7;
const DUCK_ATTACK = 0.02;
const DUCK_RELEASE = 0.45;
/** A callout holds the slot at least this long, even if little of it played. */
const CALLOUT_MIN = 1.2;
/** How far the crowd and the stingers dip while the MC speaks (0.5 is -6 dB). */
export const VOICE_DUCK = 0.5;

interface Busy {
  until: number;
  priority: number;
  voices: Voice[];
  /** When its first sound starts. */
  from: number;
  /** The callout it belongs to, if any. */
  callout?: number;
}

interface Waiting {
  sound: SfxName;
  priority: number;
  /** Earliest time it may start. */
  at: number;
  /** Dropped if it cannot start by then. */
  expires: number;
  callout?: number;
}

interface Callout {
  id: number;
  priority: number;
  until: number;
}

/**
 * Decides which parts of each cue play. Time is in seconds on any clock that
 * moves forward (the audio clock in the game, a number in the tests).
 */
export class HypeMixer {
  private readonly play: PlayFn;
  private readonly announcer: () => boolean;
  private readonly busy = new Map<Channel, Busy>();
  private waiting: Waiting | null = null;
  /** The big callout playing now, if any. */
  private callout: Callout | null = null;
  private calloutCount = 0;
  /** When each keyed cue last played in full. */
  private readonly lastKeyed = new Map<string, number>();
  private duckFrom = 0;
  private duckUntil = -Infinity;
  private duckDepth = 0;

  constructor(play: PlayFn, announcer: () => boolean = () => true) {
    this.play = play;
    this.announcer = announcer;
  }

  cue(cue: Cue, now: number): void {
    const cooling = cue.key !== undefined && cue.cooldown !== undefined && now - (this.lastKeyed.get(cue.key) ?? -Infinity) < cue.cooldown;
    const current = this.callout && now < this.callout.until ? this.callout : null;
    if (cooling || (cue.callout && current && cue.priority <= current.priority)) {
      // Cooling down, or a bigger (or equal) callout is still going: only the small sounds.
      for (const part of cue.parts) if (part.channel === 'fx') this.play(part.sound, part.delay ?? 0);
      return;
    }
    let id: number | undefined;
    if (cue.callout) {
      if (current) this.cutCallout(current.id);
      id = ++this.calloutCount;
    }
    if (cue.key !== undefined) this.lastKeyed.set(cue.key, now);
    const byChannel = new Map<Channel, CuePart[]>();
    for (const part of cue.parts) {
      if ((part.channel === 'mc' || part.channel === 'call') && !this.announcer()) continue;
      byChannel.set(part.channel, [...(byChannel.get(part.channel) ?? []), part]);
    }
    let loudest = 0;
    let end = now;
    for (const [channel, parts] of byChannel) {
      if (channel === 'fx') {
        for (const part of parts) this.play(part.sound, part.delay ?? 0);
        continue;
      }
      if (channel === 'mc') {
        for (const part of parts) end = Math.max(end, this.say(part.sound, cue.priority, now + (part.delay ?? 0), now, id));
        continue;
      }
      if (channel === 'call') {
        for (const part of parts) this.call(part.sound, now);
        continue;
      }
      const until = this.claim(channel, parts, cue.priority, now, id);
      if (until !== null) loudest = Math.max(loudest, until);
    }
    if (id !== undefined) this.callout = { id, priority: cue.priority, until: Math.max(now + CALLOUT_MIN, loudest, end) };
    if (cue.duck && (loudest > now || cue.duckAlways)) this.duckFor(cue.duck, now, cue.duckLength !== undefined ? now + cue.duckLength : loudest);
  }

  /** True while a big callout holds the slot. */
  calloutBusy(now: number): boolean {
    return !!this.callout && now < this.callout.until;
  }

  /** 0..1: how loud the crowd and stingers should be right now: down under the MC while it speaks. */
  voiceDuck(now: number): number {
    const busy = this.busy.get('mc');
    return busy && now >= busy.from && now < busy.until ? VOICE_DUCK : 1;
  }

  /** Call every frame: starts a waiting MC line once the line before it is done. */
  update(now: number): void {
    const waiting = this.waiting;
    if (!waiting) return;
    if (now > waiting.expires) {
      this.waiting = null;
      return;
    }
    const busy = this.busy.get('mc');
    const free = !busy || now >= busy.until + MC_GAP;
    if (free && now >= waiting.at) {
      this.waiting = null;
      const until = this.start('mc', [{ sound: waiting.sound, channel: 'mc' }], waiting.priority, now, waiting.callout);
      const callout = this.callout;
      if (until !== null && callout && callout.id === waiting.callout) callout.until = Math.max(callout.until, until);
    }
  }

  /** 0..1: how loud the song should be right now. */
  duck(now: number): number {
    if (this.duckDepth <= 0) return 1;
    if (now < this.duckFrom) return 1;
    if (now < this.duckUntil) return 1 - this.duckDepth * Math.min(1, (now - this.duckFrom) / DUCK_ATTACK);
    const release = (now - this.duckUntil) / DUCK_RELEASE;
    if (release >= 1) {
      this.duckDepth = 0;
      return 1;
    }
    return 1 - this.duckDepth * (1 - release);
  }

  /** True while a channel is playing or (for the MC) has a line waiting. */
  isBusy(channel: Channel, now: number): boolean {
    if (channel === 'mc' && this.waiting) return true;
    const busy = this.busy.get(channel);
    return !!busy && now < busy.until;
  }

  /** Stop everything (pause, leaving the scene). */
  silence(): void {
    for (const busy of this.busy.values()) for (const voice of busy.voices) voice.stop();
    this.busy.clear();
    this.waiting = null;
    this.callout = null;
    this.duckDepth = 0;
  }

  /** A bigger callout takes over: the one playing stops, and its waiting MC line is forgotten. */
  private cutCallout(id: number): void {
    for (const [channel, busy] of this.busy) {
      if (busy.callout !== id) continue;
      for (const voice of busy.voices) voice.stop();
      this.busy.delete(channel);
    }
    if (this.waiting?.callout === id) this.waiting = null;
    this.callout = null;
  }

  /** Stingers and crowd: a free channel or a higher priority takes it, anything else is dropped. */
  private claim(channel: Channel, parts: CuePart[], priority: number, now: number, callout?: number): number | null {
    const busy = this.busy.get(channel);
    if (busy && now < busy.until) {
      if (priority <= busy.priority) return null;
      for (const voice of busy.voices) voice.stop();
    }
    return this.start(channel, parts, priority, now, callout);
  }

  private start(channel: Channel, parts: CuePart[], priority: number, now: number, callout?: number): number | null {
    const voices: Voice[] = [];
    let until = now;
    let from = Infinity;
    for (const part of parts) {
      const delay = Math.max(0, part.delay ?? 0);
      const voice = this.play(part.sound, delay);
      if (!voice) continue;
      voices.push(voice);
      from = Math.min(from, now + delay);
      until = Math.max(until, now + delay + voice.duration);
    }
    if (voices.length === 0) return null;
    this.busy.set(channel, { until, priority, voices, from, callout });
    return until;
  }

  /**
   * The MC: speak now if free, else wait a moment behind the current line (the
   * stronger of two waiting lines stays). Returns when the line ends, as far
   * as is known now.
   */
  private say(sound: SfxName, priority: number, at: number, now: number, callout?: number): number {
    const busy = this.busy.get('mc');
    const free = (!busy || at >= busy.until + MC_GAP) && !this.waiting;
    if (free) return this.start('mc', [{ sound, channel: 'mc', delay: at - now }], priority, now, callout) ?? now;
    if (this.waiting && this.waiting.priority > priority) return now;
    this.waiting = { sound, priority, at, expires: at + MC_WAIT, callout };
    return at;
  }

  /** A line on the beat: cut off the MC's current line and say it now, holding the MC only briefly. */
  private call(sound: SfxName, now: number): void {
    const busy = this.busy.get('mc');
    if (busy && now < busy.until) for (const voice of busy.voices) voice.stop();
    const voice = this.play(sound, 0);
    if (!voice) {
      this.busy.delete('mc');
      return;
    }
    this.busy.set('mc', { until: now + Math.min(voice.duration, CALL_HOLD), priority: 0, voices: [voice], from: now });
  }

  private duckFor(depth: number, now: number, until: number): void {
    const current = 1 - this.duck(now);
    if (now >= this.duckUntil) this.duckFrom = now;
    this.duckDepth = Math.max(depth, current);
    this.duckUntil = Math.max(this.duckUntil, until);
  }
}

/** The crowd bed fades towards its target over about this long. */
const BED_GLIDE = 0.6;
/** The bed's level at no streak and at full energy, before the crowd bus (BUS_LEVELS.crowd): low, tucked behind the song. */
const BED_QUIET = 0.35;
const BED_LOUD = 1.2;

/** The battle song and where it is, so the DJ can spin it back or brake it. */
export type SongTap = () => { buffer: AudioBuffer; time: number } | null;

/** Plays hype sounds on their buses (the MC, the crowd, the rest); the record moves are made from the song when there is one. */
function hypePlayer(game: Phaser.Game, song: SongTap = () => null): PlayFn {
  return (sound, delay) => {
    const playing = isRecordMove(sound) ? song() : null;
    // Too near the start of the song to make the move from it: the prepared sound stands in.
    if (playing && isRecordMove(sound)) return startRecordMove(game, sound, playing.buffer, playing.time + delay, delay) ?? startSfx(game, sound, delay, 1, 'hype');
    return startSfx(game, sound, delay, 1, hypeBus(sound));
  };
}

/**
 * The hype for one battle scene: the mixer wired to Web Audio, and a crowd
 * bed that swells with the player's streak and how far the bar leans their
 * way. The bed starts once its sample has loaded.
 */
export class HypeAudio {
  private readonly game: Phaser.Game;
  private readonly mixer: HypeMixer;
  private bed: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private bedWanted = false;
  private energy = 0;
  /** The crowd and stinger buses' level under the MC, as last set (unknown at first: the buses are shared, so the first update sets them). */
  private room = Number.NaN;

  /** `song` lets the DJ spin back or brake the battle song itself. */
  constructor(game: Phaser.Game, song?: SongTap) {
    this.game = game;
    this.mixer = new HypeMixer(hypePlayer(game, song), () => getSettings().announcer);
  }

  private get now(): number {
    return getAudioContext(this.game).currentTime;
  }

  event(event: HypeEvent): void {
    this.mixer.cue(cueFor(event), this.now);
  }

  /** One call of the countdown (see countCue). */
  count(index: CountCall, say: boolean, letsDance: boolean): void {
    this.mixer.cue(countCue(index, say, letsDance), this.now);
  }

  /** How loud the song should be right now, 0..1. */
  duck(): number {
    return this.mixer.duck(this.now);
  }

  /** Call every frame. `streak` is the combo, `bar` the health bar 0..1. */
  update(streak: number, bar: number): void {
    const now = this.now;
    this.mixer.update(now);
    // The crowd and the stingers make room for the MC.
    this.makeRoom(this.mixer.voiceDuck(now), now);
    this.energy = Math.min(1, Math.min(streak / 80, 1) * 0.6 + Math.max(0, bar - 0.3) * 0.6);
    if (this.bedWanted && !this.bed) this.startBed();
    const bed = this.bed;
    if (bed) bed.gain.gain.setTargetAtTime(this.bedLevel(), this.now, BED_GLIDE / 3);
  }

  /** Bring the crowd in (a battle starting) or out (paused, over). */
  setCrowd(on: boolean): void {
    this.bedWanted = on;
    const bed = this.bed;
    if (!on && bed) {
      const now = this.now;
      bed.gain.gain.cancelScheduledValues(now);
      bed.gain.gain.setTargetAtTime(0, now, 0.15);
      bed.source.stop(now + 0.8);
      this.bed = null;
    }
  }

  /** Cut everything short (pause, leaving the scene). */
  silence(): void {
    this.mixer.silence();
    this.setCrowd(false);
    this.makeRoom(1, this.now);
  }

  /** Set the crowd and stinger buses' level under the MC: down fast, back up gently. */
  private makeRoom(room: number, now: number): void {
    if (room === this.room) return;
    this.room = room;
    const ctx = getAudioContext(this.game);
    for (const bus of ['crowd', 'hype'] as const) busDuck(ctx, bus).setTargetAtTime(room, now, room < 1 ? 0.02 : 0.12);
  }

  private bedLevel(): number {
    return getSettings().sfxVolume * (BED_QUIET + (BED_LOUD - BED_QUIET) * this.energy);
  }

  private startBed(): void {
    const buffer = sampleBuffer('crowdBed');
    const ctx = getAudioContext(this.game);
    if (!buffer || ctx.state !== 'running' || getSettings().sfxVolume <= 0) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setTargetAtTime(this.bedLevel(), ctx.currentTime, 0.4);
    source.connect(gain).connect(busInput(ctx, 'crowd'));
    source.start(ctx.currentTime, Math.random() * buffer.duration);
    source.onended = () => gain.disconnect();
    this.bed = { source, gain };
  }
}

/** A one-off cue outside a battle (the results screens). */
export function playHype(game: Phaser.Game, event: HypeEvent): void {
  new HypeMixer(hypePlayer(game), () => getSettings().announcer).cue(cueFor(event), getAudioContext(game).currentTime);
}
