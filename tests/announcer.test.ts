import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HypeMixer, comboTier, cueFor, roundLine, type Channel, type HypeEvent } from '../src/core/announcer';
import { SAMPLE_FILES, type SfxName } from '../src/core/sfx';

/** A fake output: every sound lasts `length` seconds unless listed in `lengths`. */
function rig(lengths: Partial<Record<SfxName, number>> = {}, length = 1) {
  const played: { sound: SfxName; at: number }[] = [];
  const stopped: SfxName[] = [];
  let now = 0;
  const mixer = new HypeMixer((sound, delay) => {
    played.push({ sound, at: now + delay });
    return { duration: lengths[sound] ?? length, stop: () => stopped.push(sound) };
  });
  return {
    mixer,
    played,
    stopped,
    sounds: () => played.map((p) => p.sound),
    at: (t: number) => (now = t),
    cue: (event: HypeEvent, t: number) => {
      now = t;
      mixer.cue(cueFor(event), t);
    },
  };
}

const channels = (event: HypeEvent): Channel[] => cueFor(event).parts.map((p) => p.channel);

describe('hype cues', () => {
  it('escalates combo milestones', () => {
    expect([9, 10, 25, 50, 75, 100, 150].map(comboTier)).toEqual([0, 1, 2, 3, 3, 4, 4]);
    const sounds = (combo: number) => cueFor({ kind: 'combo', combo }).parts.map((p) => p.sound);
    expect(sounds(10)).toEqual(['combo', 'scratch']);
    expect(sounds(25)).toContain('airhorn');
    expect(sounds(50)).toEqual(expect.arrayContaining(['airhorn', 'crowdCheer', 'mcCombo']));
    expect(sounds(100)).toEqual(expect.arrayContaining(['impact', 'airhorn', 'crowdCheer', 'mcCrowdWild']));
    expect(cueFor({ kind: 'combo', combo: 150 }).priority).toBeGreaterThan(cueFor({ kind: 'combo', combo: 10 }).priority);
  });

  it('calls the rounds, with the last one the final round', () => {
    expect(roundLine(0, 3)).toBe('mcRound1');
    expect(roundLine(1, 3)).toBe('mcRound2');
    expect(roundLine(2, 3)).toBe('mcFinal');
    expect([0, 1, 2, 3, 4].map((r) => roundLine(r, 5))).toEqual(['mcRound1', 'mcRound2', 'mcRound3', 'mcRound4', 'mcFinal']);
    expect(roundLine(0, 1)).toBe('mcRound1');
  });

  it('gives every big moment a sound, and the biggest ones the MC', () => {
    expect(channels({ kind: 'hypeStart' })).toEqual(expect.arrayContaining(['stinger', 'crowd', 'mc']));
    expect(channels({ kind: 'battleWon' })).toContain('mc');
    expect(channels({ kind: 'fail' })).toContain('stinger');
    expect(cueFor({ kind: 'hypeEnd', broken: true }).parts.map((p) => p.sound)).toContain('tapeStop');
    expect(cueFor({ kind: 'hypeEnd', broken: false }).parts.map((p) => p.sound)).toContain('scratchDown');
    expect(cueFor({ kind: 'ability', ability: 'eureka' }).parts.map((p) => p.sound)).toContain('abilityEureka');
    expect(cueFor({ kind: 'ability', ability: 'rind' }).parts.map((p) => p.sound)).toContain('abilityRind');
    expect(cueFor({ kind: 'flairFull' }).parts.map((p) => p.sound)).toEqual(['ready']);
  });

  it('ships every recorded sample, small', () => {
    for (const file of SAMPLE_FILES) {
      const path = `public/${file}`;
      expect(existsSync(path), `${path} missing`).toBe(true);
      expect(statSync(path).size).toBeLessThan(80_000);
    }
  });
});

describe('hype mixer', () => {
  it('drops a smaller stinger while a bigger one plays', () => {
    const r = rig({ drop: 1, airhorn: 1.5 });
    r.cue({ kind: 'hypeStart' }, 0);
    r.cue({ kind: 'combo', combo: 10 }, 0.8);
    expect(r.sounds()).not.toContain('scratch');
    // The small fx part of the cue still plays.
    expect(r.sounds().filter((s) => s === 'combo')).toHaveLength(1);
  });

  it('lets a bigger stinger cut a smaller one short', () => {
    const r = rig({}, 2);
    r.cue({ kind: 'combo', combo: 10 }, 0);
    r.cue({ kind: 'fail' }, 0.5);
    expect(r.stopped).toContain('scratch');
    expect(r.sounds()).toContain('scratchStop');
  });

  it('plays the next stinger once the channel is free', () => {
    const r = rig({ scratch: 0.4 });
    r.cue({ kind: 'combo', combo: 10 }, 0);
    r.cue({ kind: 'combo', combo: 10 }, 1);
    expect(r.sounds().filter((s) => s === 'scratch')).toHaveLength(2);
  });

  it('never lets the MC talk over itself, and queues the next line briefly', () => {
    const r = rig({ mcCombo: 0.8, mcFlawless: 0.8 });
    r.cue({ kind: 'combo', combo: 50 }, 0); // "Combo!" at 0.45, until 1.25
    r.cue({ kind: 'flawless' }, 0.6); // "Flawless!" wants 0.7: waits
    expect(r.sounds()).not.toContain('mcFlawless');
    r.mixer.update(1.0);
    r.at(1.0);
    expect(r.sounds()).not.toContain('mcFlawless');
    r.at(1.4);
    r.mixer.update(1.4);
    const line = r.played.find((p) => p.sound === 'mcFlawless');
    expect(line?.at).toBeCloseTo(1.4);
  });

  it('gives up on a queued MC line that waited too long', () => {
    const r = rig({ mcRound1: 5 });
    r.cue({ kind: 'roundIntro', round: 0, total: 3 }, 0);
    r.cue({ kind: 'letsDance' }, 0.1);
    r.at(6);
    r.mixer.update(6);
    expect(r.sounds()).not.toContain('mcLetsDance');
  });

  it('keeps the stronger of two waiting lines', () => {
    const r = rig({ mcRound1: 1 });
    r.cue({ kind: 'roundIntro', round: 0, total: 3 }, 0);
    r.cue({ kind: 'battleWon' }, 0.2);
    r.cue({ kind: 'letsDance' }, 0.3);
    r.at(1.3);
    r.mixer.update(1.3);
    expect(r.sounds()).toContain('mcWinner');
    expect(r.sounds()).not.toContain('mcLetsDance');
  });

  it('stays quiet when the announcer is off, but the rest still plays', () => {
    const played: SfxName[] = [];
    const mixer = new HypeMixer(
      (sound) => {
        played.push(sound);
        return { duration: 1, stop: () => undefined };
      },
      () => false,
    );
    mixer.cue(cueFor({ kind: 'hypeStart' }), 0);
    expect(played.some((s) => s.startsWith('mc'))).toBe(false);
    expect(played).toContain('airhorn');
  });

  it('dips the song under a big moment and brings it back', () => {
    const r = rig({}, 1);
    expect(r.mixer.duck(0)).toBe(1);
    r.cue({ kind: 'battleWon' }, 0);
    expect(r.mixer.duck(0.5)).toBeCloseTo(0.6);
    expect(r.mixer.duck(30)).toBe(1);
  });

  it('does not duck for small cues', () => {
    const r = rig();
    r.cue({ kind: 'combo', combo: 10 }, 0);
    expect(r.mixer.duck(0.3)).toBe(1);
  });

  it('treats a sound that could not play as silence', () => {
    const mixer = new HypeMixer(() => null);
    mixer.cue(cueFor({ kind: 'hypeStart' }), 0);
    expect(mixer.isBusy('stinger', 0.1)).toBe(false);
    expect(mixer.duck(0.2)).toBe(1);
  });
});
