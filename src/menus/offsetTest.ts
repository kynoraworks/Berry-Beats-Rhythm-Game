import Phaser from 'phaser';
import { COLORS, CSS, GAME_W } from '../core/config';
import { getAudioContext } from '../core/songs';
import { addButton, addDim, addPanel, addText } from '../core/ui';

const TICKS = 16;
/** The first clicks let the player find the pulse and are not measured. */
const WARM_UP = 2;
const INTERVAL = 0.6;
const MIN_TAPS = 6;

/**
 * Measures how late (or early) the player taps against a metronome.
 *
 * The game draws and judges notes at `audio clock - output latency - offset`,
 * so the offset that centres a player's hits is their average tap error with
 * the browser's own latency estimate taken out. A positive result means the
 * taps came late, and the notes should therefore arrive later.
 */
export class OffsetTest {
  private readonly scene: Phaser.Scene;
  private readonly onDone: (offsetMs: number | null) => void;
  private readonly ctx: AudioContext;
  private readonly root: Phaser.GameObjects.Container;
  private readonly progress: Phaser.GameObjects.Text;
  private readonly readout: Phaser.GameObjects.Text;
  private readonly note: Phaser.GameObjects.Text;
  private readonly buttons: Phaser.GameObjects.Text[] = [];
  private readonly pulse: Phaser.GameObjects.Arc;
  private oscillators: OscillatorNode[] = [];
  private tickTimes: number[] = [];
  private errors: (number | undefined)[] = [];
  private phase: 'running' | 'result' = 'running';
  private result: number | null = null;

  constructor(scene: Phaser.Scene, onDone: (offsetMs: number | null) => void) {
    this.scene = scene;
    this.onDone = onDone;
    this.ctx = getAudioContext(scene.game);

    const dim = addDim(scene, 0.8).setInteractive();
    dim.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => this.tap(pointer.event.timeStamp));
    const cx = GAME_W / 2;
    const panel = addPanel(scene, cx - 430, 150, 860, 500, COLORS.night, 1);
    const title = addText(scene, cx, 206, 'offset test', 48, { color: CSS.yellow });
    const help = addText(scene, cx, 282, 'listen to the clicks and tap any key\n(or the screen) on every one', 24, { color: CSS.lilac });
    this.pulse = scene.add.circle(cx, 392, 34, COLORS.purple).setStrokeStyle(6, COLORS.ink);
    this.readout = addText(scene, cx, 392, '', 48);
    this.progress = addText(scene, cx, 472, '', 24);
    this.note = addText(scene, cx, 520, '', 24, { color: CSS.lilac, wrapWidth: 800 });
    this.buttons = [
      addButton(scene, cx - 270, 600, 'enter: use it', 32, () => this.finish(true)),
      addButton(scene, cx + 10, 600, 'r: retry', 32, () => this.start()),
      addButton(scene, cx + 270, 600, 'esc: cancel', 32, () => this.finish(false)),
    ];
    this.root = scene.add.container(0, 0, [dim, panel, title, help, this.pulse, this.readout, this.progress, this.note, ...this.buttons]).setDepth(200);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.start();
  }

  /** Handle a key press. Every key is consumed while the test is open. */
  handleKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.code === 'Escape') {
      this.finish(false);
    } else if (this.phase === 'running') {
      this.tap(event.timeStamp);
    } else if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      this.finish(this.result !== null);
    } else if (event.code === 'KeyR') {
      this.start();
    }
  }

  destroy(): void {
    this.stopAudio();
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.root.destroy(true);
  }

  /** The test ends on the audio clock, which keeps running true even if frames are slow. */
  private update(): void {
    if (this.phase === 'running' && this.ctx.currentTime > this.tickTimes[TICKS - 1] + 0.45) this.showResult();
  }

  private start(): void {
    this.stopAudio();
    this.phase = 'running';
    this.result = null;
    this.errors = [];
    this.readout.setText('').setColor(CSS.cream);
    this.pulse.setVisible(true);
    this.note.setText('');
    this.buttons.forEach((button, i) => button.setVisible(i === 2));
    if (this.ctx.state === 'suspended') void this.ctx.resume();

    const first = this.ctx.currentTime + 1;
    this.tickTimes = Array.from({ length: TICKS }, (_, i) => first + i * INTERVAL);
    for (const time of this.tickTimes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + 0.06);
      this.oscillators.push(osc);
    }
    this.showProgress();
  }

  private stopAudio(): void {
    for (const osc of this.oscillators) {
      try {
        osc.stop();
      } catch {
        // already finished
      }
      osc.disconnect();
    }
    this.oscillators = [];
  }

  private tap(timeStampMs: number): void {
    if (this.phase !== 'running') return;
    // Convert the event time to the audio clock.
    const at = this.ctx.currentTime - (performance.now() - timeStampMs) / 1000;
    const index = Math.round((at - this.tickTimes[0]) / INTERVAL);
    if (index < 0 || index >= TICKS) return;
    const error = at - this.tickTimes[index];
    this.scene.tweens.add({ targets: this.pulse, scale: { from: 1.25, to: 1 }, duration: 140 });
    if (index < WARM_UP || this.errors[index] !== undefined) return;
    this.errors[index] = error;
    this.showProgress();
  }

  private showProgress(): void {
    const taps = this.errors.filter((e) => e !== undefined).length;
    this.progress.setText(`taps measured: ${taps} of ${TICKS - WARM_UP}`);
  }

  private showResult(): void {
    this.phase = 'result';
    this.stopAudio();
    this.pulse.setVisible(false);
    const errors = this.errors.filter((e): e is number => e !== undefined).sort((a, b) => a - b);
    if (errors.length < MIN_TAPS) {
      this.result = null;
      this.readout.setText('not enough taps').setColor(CSS.miss);
      this.progress.setText('');
      this.note.setText('tap on at least six clicks');
      this.buttons.forEach((button, i) => button.setVisible(i !== 0));
      return;
    }
    // Drop the most extreme tap on each side when there are plenty.
    const kept = errors.length >= 8 ? errors.slice(1, -1) : errors;
    const mean = kept.reduce((sum, e) => sum + e, 0) / kept.length;
    const spread = Math.sqrt(kept.reduce((sum, e) => sum + (e - mean) ** 2, 0) / kept.length);
    const latency = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency;
    const baseline = typeof latency === 'number' && Number.isFinite(latency) ? Math.min(latency, 0.25) : 0;
    this.result = Phaser.Math.Clamp(Math.round((mean - baseline) * 1000), -500, 500);
    const sign = this.result > 0 ? '+' : '';
    this.readout.setText(`${sign}${this.result} ms`).setColor(CSS.yellow);
    this.progress.setText(`your taps varied by about ${Math.round(spread * 1000)} ms`);
    this.note.setText(this.result >= 0 ? 'you tap after the click: notes will arrive later' : 'you tap before the click: notes will arrive earlier');
    this.buttons.forEach((button) => button.setVisible(true));
  }

  private finish(apply: boolean): void {
    const result = apply ? this.result : null;
    this.destroy();
    this.onDone(result);
  }
}
