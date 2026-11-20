import type Phaser from 'phaser';
import type { AbilityId } from '../story/types';
import { getSettings } from './settings';
import { sampleBuffer, startSfx, type SfxName, type Voice } from './sfx';
import { getAudioContext } from './songs';

/**
 * Battle hype: the MC, the crowd and the stingers. Game code reports what
 * happened as a HypeEvent; cueFor turns it into sounds, and HypeMixer keeps
 * them from piling up: one stinger at a time, one crowd reaction at a time,
 * and the MC never talks over itself. Hit sounds do not go through here, so
 * they stay crisp whatever the mixer is doing.
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
  | { kind: 'letsDance' }
  | { kind: 'battleWon' }
  | { kind: 'battleLost' }
  | { kind: 'fail' }
  | { kind: 'resultsWon' }
  | { kind: 'resultsLost' }
  | { kind: 'crewWon' };

/**
 * stinger: the big one-offs, one at a time. mc: the announcer, one line at a
 * time, queued briefly. crowd: one reaction at a time. fx: small sounds that
 * always play.
 */
export type Channel = 'stinger' | 'mc' | 'crowd' | 'fx';

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
}

const fx = (sound: SfxName, delay?: number): CuePart => ({ sound, channel: 'fx', delay });
const sting = (sound: SfxName, delay?: number): CuePart => ({ sound, channel: 'stinger', delay });
const mc = (sound: SfxName, delay?: number): CuePart => ({ sound, channel: 'mc', delay });
const crowd = (sound: SfxName, delay?: number): CuePart => ({ sound, channel: 'crowd', delay });

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

export function cueFor(event: HypeEvent): Cue {
  switch (event.kind) {
    case 'combo': {
      const tier = comboTier(event.combo);
      if (tier <= 1) return { priority: 1, parts: [fx('combo'), sting('scratch')] };
      if (tier === 2) return { priority: 2, parts: [fx('combo'), sting('scratch'), sting('airhorn', 0.3)] };
      if (tier === 3) return { priority: 3, duck: 0.3, parts: [fx('combo'), sting('scratch'), sting('airhorn', 0.3), crowd('crowdCheer', 0.2), mc('mcCombo', 0.45)] };
      return { priority: 4, duck: 0.4, parts: [fx('combo'), sting('impact'), sting('airhorn', 0.1), crowd('crowdCheer', 0.1), mc('mcCrowdWild', 0.35)] };
    }
    case 'roundIntro':
      return { priority: 3, parts: [mc(roundLine(event.round, event.total))] };
    case 'roundWon':
      return { priority: 4, duck: 0.25, parts: [sting('roundWin'), crowd('crowdCheer', 0.1)] };
    case 'roundLost':
      return { priority: 4, parts: [sting('roundLose'), crowd('crowdOhh', 0.05)] };
    case 'hypeStart':
      // The riser lands at about half a second: the drop, the horn and the MC hit there.
      return { priority: 5, duck: 0.35, parts: [fx('hype'), sting('drop', 0.48), sting('airhorn', 0.5), crowd('crowdCheer', 0.45), mc('mcHype', 0.55)] };
    case 'hypeEnd':
      return { priority: 2, parts: [fx('hypeOut'), sting(event.broken ? 'tapeStop' : 'scratchDown')] };
    case 'flawless':
      return { priority: 3, parts: [fx('bonus'), crowd('crowdCheer', 0.1), mc('mcFlawless', 0.1)] };
    case 'flairFull':
      return { priority: 1, parts: [fx('ready')] };
    case 'ability':
      return { priority: 3, duck: 0.2, parts: [fx('whoosh'), sting(ABILITY_HITS[event.ability], 0.12), crowd('crowdCheer', 0.2)] };
    case 'bigMiss':
      return { priority: 1, parts: [crowd('crowdOhh')] };
    case 'letsDance':
      return { priority: 2, parts: [mc('mcLetsDance')] };
    case 'battleWon':
      return { priority: 6, duck: 0.4, parts: [sting('airhorn'), crowd('crowdCheer'), mc('mcWinner', 0.25)] };
    case 'battleLost':
      return { priority: 6, parts: [sting('roundLose'), crowd('crowdOhh', 0.05), mc('mcOhNo', 0.3)] };
    case 'fail':
      return { priority: 7, parts: [sting('scratchStop'), crowd('crowdOhh', 0.3), mc('mcOhNo', 0.6)] };
    case 'resultsWon':
      return { priority: 6, parts: [sting('victory'), crowd('crowdCheer', 0.15)] };
    case 'resultsLost':
      return { priority: 6, parts: [sting('defeat'), crowd('crowdOhh', 0.1)] };
    case 'crewWon':
      return { priority: 6, parts: [sting('victory'), crowd('crowdCheer', 0.2), mc('mcCrowdWild', 0.7)] };
  }
}

/** Plays one sound `delay` seconds from now; null if it could not play. */
export type PlayFn = (sound: SfxName, delay: number) => Voice | null;

/** An MC line waits at most this long for the one before it to finish. */
const MC_WAIT = 1.2;
/** A short breath between two MC lines. */
const MC_GAP = 0.12;
const DUCK_ATTACK = 0.08;
const DUCK_RELEASE = 0.45;

interface Busy {
  until: number;
  priority: number;
  voices: Voice[];
}

interface Waiting {
  sound: SfxName;
  priority: number;
  /** Earliest time it may start. */
  at: number;
  /** Dropped if it cannot start by then. */
  expires: number;
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
  private duckFrom = 0;
  private duckUntil = -Infinity;
  private duckDepth = 0;

  constructor(play: PlayFn, announcer: () => boolean = () => true) {
    this.play = play;
    this.announcer = announcer;
  }

  cue(cue: Cue, now: number): void {
    const byChannel = new Map<Channel, CuePart[]>();
    for (const part of cue.parts) {
      if (part.channel === 'mc' && !this.announcer()) continue;
      byChannel.set(part.channel, [...(byChannel.get(part.channel) ?? []), part]);
    }
    let loudest = 0;
    for (const [channel, parts] of byChannel) {
      if (channel === 'fx') {
        for (const part of parts) this.play(part.sound, part.delay ?? 0);
        continue;
      }
      if (channel === 'mc') {
        for (const part of parts) this.say(part.sound, cue.priority, now + (part.delay ?? 0), now);
        continue;
      }
      const end = this.claim(channel, parts, cue.priority, now);
      if (end !== null) loudest = Math.max(loudest, end);
    }
    if (cue.duck && loudest > now) this.duckFor(cue.duck, now, loudest);
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
      this.start('mc', [{ sound: waiting.sound, channel: 'mc' }], waiting.priority, now);
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
    this.duckDepth = 0;
  }

  /** Stingers and crowd: a free channel or a higher priority takes it, anything else is dropped. */
  private claim(channel: Channel, parts: CuePart[], priority: number, now: number): number | null {
    const busy = this.busy.get(channel);
    if (busy && now < busy.until) {
      if (priority <= busy.priority) return null;
      for (const voice of busy.voices) voice.stop();
    }
    return this.start(channel, parts, priority, now);
  }

  private start(channel: Channel, parts: CuePart[], priority: number, now: number): number | null {
    const voices: Voice[] = [];
    let until = now;
    for (const part of parts) {
      const delay = Math.max(0, part.delay ?? 0);
      const voice = this.play(part.sound, delay);
      if (!voice) continue;
      voices.push(voice);
      until = Math.max(until, now + delay + voice.duration);
    }
    if (voices.length === 0) return null;
    this.busy.set(channel, { until, priority, voices });
    return until;
  }

  /** The MC: speak now if free, else wait a moment behind the current line (the stronger of two waiting lines stays). */
  private say(sound: SfxName, priority: number, at: number, now: number): void {
    const busy = this.busy.get('mc');
    const free = (!busy || at >= busy.until + MC_GAP) && !this.waiting;
    if (free) {
      this.start('mc', [{ sound, channel: 'mc', delay: at - now }], priority, now);
      return;
    }
    if (this.waiting && this.waiting.priority > priority) return;
    this.waiting = { sound, priority, at, expires: at + MC_WAIT };
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
const BED_QUIET = 0.12;
const BED_LOUD = 0.55;

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

  constructor(game: Phaser.Game) {
    this.game = game;
    this.mixer = new HypeMixer(
      (sound, delay) => startSfx(game, sound, delay),
      () => getSettings().announcer,
    );
  }

  private get now(): number {
    return getAudioContext(this.game).currentTime;
  }

  event(event: HypeEvent): void {
    this.mixer.cue(cueFor(event), this.now);
  }

  /** How loud the song should be right now, 0..1. */
  duck(): number {
    return this.mixer.duck(this.now);
  }

  /** Call every frame. `streak` is the combo, `bar` the health bar 0..1. */
  update(streak: number, bar: number): void {
    this.mixer.update(this.now);
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
    source.connect(gain).connect(ctx.destination);
    source.start(ctx.currentTime, Math.random() * buffer.duration);
    source.onended = () => gain.disconnect();
    this.bed = { source, gain };
  }
}

/** A one-off cue outside a battle (the results screens). */
export function playHype(game: Phaser.Game, event: HypeEvent): void {
  new HypeMixer((sound, delay) => startSfx(game, sound, delay), () => getSettings().announcer).cue(cueFor(event), getAudioContext(game).currentTime);
}
