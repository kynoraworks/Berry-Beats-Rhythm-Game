import Phaser from 'phaser';
import { CSS, GAME_W } from '../core/config';
import type { SfxName } from '../core/sfx';
import type { PlayNote } from '../core/engine';
import { getSettings } from '../core/settings';
import { Bark, VhsOverlay, confettiBurst } from '../cutscene/fx';
import type { PrologueFlow } from '../cutscene/flow';
import { BOG_STOMP, PROLOGUE_BARS, barAt, bibleBarOf, chartBars, prologueEvents, scaleBar, songBar, tugAt, type PrologueCues, type PrologueEvent } from '../cutscene/prologueCues';
import type { Chart } from '../core/chart';
import { Depth } from './layout';

/**
 * PlayScene's scripted mode (SYSTEMS 19): the prologue battle is a showcase,
 * not a test. It cannot be failed, misses only flash, the tug-of-war bar
 * follows the script, hype switches on and off by bar, Bog Stomp fires by
 * itself, Strawberry flashes the field once, and at bar 84 beat 3.5 the
 * picture freezes and cuts to static. This director reads the script and
 * drives the scene through a few hooks, so PlayScene only gains a branch.
 */
export interface ScriptedPlay {
  kind: 'prologue';
  cues: PrologueCues;
  flow: PrologueFlow;
  /** The song and chart are stand-ins until the generated ones land. */
  standIn?: boolean;
}

export interface ScriptedHooks {
  hype(on: boolean): void;
  duel(value: number): void;
  callout(text: string, color?: string): void;
  flash(color: number, alpha: number): void;
  sfx(name: SfxName): void;
  /** Make these player notes glow gold (null: none). */
  glow(ids: ReadonlySet<number> | null): void;
  /** The player's notes. */
  notes(): readonly PlayNote[];
  /** Cover the top of the player's field with light for a moment (Strawberry's flash). */
  fieldFlash(seconds: number): void;
  /** The burst: lights flicker and both dancers show off. */
  burst(): void;
  /** Bog Stomp: shake, mud up the lanes, Cranberry's special. */
  stomp(): void;
  /** The finisher: just the two of them. */
  finisher(): void;
  /** Bar 84, beat 3.5. */
  freeze(): void;
}

/** Labels for whose turn it is, in place of "Your turn!" and "Watch". */
export const SCRIPTED_TURNS = { player: 'CRANBERRY!', rival: 'STRAWBERRY!', both: 'FACE-OFF!' } as const;

export class ScriptedDirector {
  readonly play: ScriptedPlay;
  private readonly scene: Phaser.Scene;
  private readonly hooks: ScriptedHooks;
  private readonly events: PrologueEvent[];
  private readonly bars: number;
  private readonly bark: Bark;
  readonly vhs: VhsOverlay;
  private next = 0;
  private glowIds: Set<number> | null = null;
  private frozen = false;
  private clock = 0;

  constructor(scene: Phaser.Scene, play: ScriptedPlay, chart: Chart, hooks: ScriptedHooks) {
    this.scene = scene;
    this.play = play;
    this.hooks = hooks;
    this.bars = play.cues.source === 'density' ? chartBars(chart) : PROLOGUE_BARS;
    this.events = prologueEvents(play.cues, this.bars);
    this.bark = new Bark(scene, 268, Depth.overlay + 4, 760);
    this.vhs = new VhsOverlay(scene, { date: 'SAT 23:44', depth: Depth.overlay + 5, start: 38, compact: true });
    if (play.standIn) {
      addStandInNote(scene);
    }
  }

  /** The bible bar at a chart beat (stretched back for a stand-in chart, for the tug curve). */
  private bibleBar(bar: number): number {
    // The real song: its drops are not on the bible's bars, so the curve is read through the cue file's anchors.
    if (this.play.cues.source === 'file') return bibleBarOf(this.play.cues, bar);
    if (this.play.cues.source !== 'density') return bar;
    return 1 + ((bar - 1) * (PROLOGUE_BARS - 1)) / Math.max(1, this.bars - 1);
  }

  /** Every frame with the song's time and beat. */
  update(time: number, beat: number, dt: number): void {
    this.clock += dt;
    this.bark.update(dt);
    this.vhs.update(dt);
    if (this.frozen) return;
    const bar = barAt(beat, this.play.cues.bar1Beat);
    // The bar sits dead centre and trembles from bar 73.
    const tremble = this.bibleBar(bar) >= 73 && !getSettings().reduceMotion ? Math.sin(this.clock * 40) * 0.03 : 0;
    this.hooks.duel(tugAt(this.bibleBar(bar)) + tremble);
    while (this.next < this.events.length && bar >= this.events[this.next].bar) {
      const event = this.events[this.next++];
      // Events long gone (a seek, a long frame) go by quietly, except hype and the freeze.
      if (bar - event.bar > 1 && event.kind !== 'hype' && event.kind !== 'freeze') continue;
      this.fire(event, time);
      if (this.frozen) return;
    }
    if (this.glowIds) {
      // The glow lasts for the next eight notes, until each is played (or missed).
      for (const note of this.hooks.notes()) if (this.glowIds.has(note.id) && note.state !== 'pending' && note.state !== 'holding') this.glowIds.delete(note.id);
      if (this.glowIds.size === 0) this.endGlow();
    }
  }

  private fire(event: PrologueEvent, time: number): void {
    const hooks = this.hooks;
    switch (event.kind) {
      case 'hype':
        hooks.hype(event.on);
        if (event.on) hooks.sfx('airhorn');
        else hooks.sfx('djRewind');
        return;
      case 'callout': {
        const { callout } = event;
        if (callout.banner) hooks.callout(callout.text, callout.who === 'strawberry' ? '#ff7aa8' : '#ff5a6a');
        else this.bark.say({ who: callout.who, mood: 'bold', text: callout.text }, 2400);
        if (callout.sfx) hooks.sfx(callout.sfx as SfxName);
        return;
      }
      case 'stomp': {
        hooks.stomp();
        hooks.callout('BOG STOMP: next 8 notes score triple', CSS.yellow);
        const notes = hooks.notes().filter((n) => n.state === 'pending' && n.t >= time - 0.05).slice(0, BOG_STOMP.notes);
        this.glowIds = new Set(notes.map((n) => n.id));
        hooks.glow(this.glowIds);
        return;
      }
      case 'flash':
        hooks.fieldFlash(0.5);
        return;
      case 'burst':
        hooks.burst();
        hooks.callout('BURST!', '#ffaa66');
        return;
      case 'halfTime':
        if (!getSettings().reduceMotion) confettiBurst(this.scene, GAME_W / 2, 200, 60, Depth.effects);
        return;
      case 'finisher':
        hooks.finisher();
        return;
      case 'freeze':
        this.frozen = true;
        this.endGlow();
        this.bark.hide();
        hooks.freeze();
        return;
    }
  }

  private endGlow(): void {
    if (!this.glowIds) return;
    this.glowIds = null;
    this.hooks.glow(null);
  }

  get isFrozen(): boolean {
    return this.frozen;
  }

  /** Where a stand-in's script is stretched: the bar at which the bible's bar falls. */
  barFor(bibleBar: number): number {
    return this.play.cues.source === 'density' ? scaleBar(bibleBar, this.bars) : songBar(this.play.cues, bibleBar);
  }
}

/** A small note while the prologue's own song has not landed yet. */
function addStandInNote(scene: Phaser.Scene): void {
  const note = scene.add.text(GAME_W / 2, 776, 'Stand-in song: "The Last Final" is on its way', { fontFamily: '"Pixelify Sans"', fontSize: '16px', color: '#c9adff' }).setOrigin(0.5).setDepth(Depth.overlay + 6).setAlpha(0.7);
  scene.time.delayedCall(6000, () => scene.tweens.add({ targets: note, alpha: 0, duration: 600, onComplete: () => note.destroy() }));
}
