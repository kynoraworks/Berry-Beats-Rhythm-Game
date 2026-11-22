import Phaser from 'phaser';
import { CSS, GAME_W, SceneKeys } from '../../core/config';
import { music } from '../../core/music';
import { FocusGroup, addBackdrop, addBody, addHeader, addHints, addUiButton, fadeIn, goTo, isLeaving, menuKeys, type UiButton } from '../../core/ui';
import { hasSeen } from '../../story/progress';
import { prologueFlow } from '../../cutscene/flow';
import { storyAudioUrl, storySong } from '../../cutscene/storyFiles';
import { cutsceneState, endingFlag } from '../../cutscene/storyState';

/** The story music the jukebox can play, in the order it is heard (MUSIC_LIST.md). */
export const JUKEBOX: readonly [string, string][] = [
  ['prologue_last_final', 'The Last Final'],
  ['kids_garden', 'The Garden'],
  ['sky_the_line', 'The Line (overture)'],
  ['town_berry_town', 'Get Up, Kid'],
  ['town_peel_street', 'Mind the Floor'],
  ['town_graffiti_corner', 'Wet Paint'],
  ['town_vine_crossing', 'Declare Nothing'],
  ['town_citrus_labs', 'Lab Coat Lullaby'],
  ['town_lantern_market', 'Lanterns On'],
  ['town_the_club', 'Velvet Rope'],
  ['town_rooftop_alone', 'Table for One'],
  ['town_rooftop_full', 'Table for One (crew back)'],
  ['town_the_tunnel', 'Echo, Echo'],
  ['town_orange_plaza', 'Fresh Squeezed'],
  ['town_pineapple_hall', 'Mind the Spikes'],
  ['town_grand_stage', "You'll Know"],
  ['train_between', 'Between Stops'],
  ['train_between_alone', 'Between Stops (alone)'],
  ['credits_same_garden', 'Same Garden'],
];

/**
 * Extras (SYSTEMS 22): the prologue tape (and the complete tape once every
 * rumour is in), the ending and credits once seen, the counts of what the
 * chapters collect, and a jukebox of the story's music.
 */
export class ExtrasScene extends Phaser.Scene {
  private jukeIndex = -1;
  private jukeButton: UiButton | null = null;
  private jukeLabel: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SceneKeys.Extras);
  }

  create(): void {
    fadeIn(this);
    music.play('menu');
    this.jukeIndex = -1;
    addBackdrop(this);
    const back = () => !isLeaving(this) && goTo(this, SceneKeys.Menu);
    addHeader(this, 'Extras', back);
    const here = { scene: SceneKeys.Extras };
    const state = cutsceneState();
    const ending = hasSeen('ending') || endingFlag('endingSeen');
    const complete = endingFlag('completeTape');
    const rumours = state.counters.rumours ?? 0;
    const postcards = state.counters.postcards ?? 0;
    const entries: { label: string; note: string; action: (() => void) | null }[] = [
      { label: 'The Last Final (tape)', note: 'The old final, the shed, the sky. Hold Enter to skip.', action: () => goTo(this, SceneKeys.Prologue, { flow: { ...prologueFlow(here, true), skippable: true } }) },
      {
        label: complete ? 'The Last Final (complete)' : 'The Last Final (complete): ???',
        note: complete ? 'All eight frames, recovered.' : `Collect every rumour on the Line (${rumours} of 11).`,
        action: complete ? () => goTo(this, SceneKeys.Prologue, { flow: { ...prologueFlow(here, true), skippable: true, complete: true } }) : null,
      },
      { label: ending ? 'The ending' : 'The ending: ???', note: ending ? 'Set three, the catch, the envelope.' : 'Win the Grand Dance.', action: ending ? () => goTo(this, SceneKeys.Finale, { then: here, replay: true }) : null },
      { label: ending ? 'Credits' : 'Credits: ???', note: 'Where they are now, then next summer.', action: ending ? () => goTo(this, SceneKeys.Credits, { then: here, replay: true }) : null },
      { label: `Rumour tapes: ${rumours} of 11`, note: 'Replay them from the notebook on the train.', action: null },
      { label: `Postcards: ${postcards} of 11`, note: 'Read them again in the shoebox on the train.', action: null },
      { label: 'Jukebox', note: 'The story music you have.', action: () => this.nextTrack() },
    ];
    const buttons: UiButton[] = [];
    const notes: Phaser.GameObjects.Text[] = [];
    entries.forEach((entry, i) => {
      const y = 150 + i * 82;
      const button = addUiButton(this, GAME_W / 2 - 160, y, entry.label, () => entry.action?.(), { width: 520, height: 64, size: 24, sfx: entry.action ? 'select' : null });
      if (!entry.action) button.setEnabled(false);
      buttons.push(button);
      notes.push(addBody(this, GAME_W / 2 + 130, y, entry.note, 20, { color: entry.action ? CSS.cream : CSS.grey, align: 'left' }).setOrigin(0, 0.5));
    });
    this.jukeButton = buttons[buttons.length - 1];
    this.jukeLabel = notes[notes.length - 1];
    const focus = new FocusGroup(this, buttons);
    menuKeys(this, { up: () => focus.move(-1), down: () => focus.move(1), confirm: () => focus.activate(), back });
    addHints(this, 'Up / Down: choose   Enter: play   Esc: back', 'Tap to play');
  }

  /** The jukebox steps through the story tracks that have landed. */
  private nextTrack(): void {
    const present = JUKEBOX.filter(([key]) => storyAudioUrl(key));
    if (present.length === 0) {
      this.jukeLabel?.setText('No story music yet.');
      return;
    }
    this.jukeIndex = (this.jukeIndex + 1) % present.length;
    const [key, title] = present[this.jukeIndex];
    music.play(storySong(key, 'menu', { title }), 400);
    this.jukeLabel?.setText(`Playing: ${title} (${this.jukeIndex + 1} of ${present.length})`);
    this.jukeButton?.setLabel('Jukebox: next');
  }
}
