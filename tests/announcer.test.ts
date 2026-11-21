import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FLAWLESS_COOLDOWN, HypeMixer, VOICE_DUCK, comboTier, cueFor, roundLine, type Channel, type HypeEvent } from '../src/core/announcer';
import { BUS_LEVELS, LEVELS, SAMPLE_FILES, hypeBus, makeupCompensation, sampleSpec, type SfxName } from '../src/core/sfx';

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
    expect(sounds(10)).toEqual(['combo', 'djChirp']);
    expect(sounds(25)).toEqual(expect.arrayContaining(['djBaby', 'djCut']));
    expect(sounds(50)).toEqual(expect.arrayContaining(['boom', 'djTransform', 'crowdCheer', 'mcCombo']));
    expect(sounds(100)).toEqual(expect.arrayContaining(['boom', 'djFlare', 'crowdRoar', 'mcCrowdWild']));
    // The streak calls do not stack a horn on top of the MC.
    expect(sounds(50)).not.toContain('airhorn');
    expect(sounds(100)).not.toContain('airhorn');
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
    expect(cueFor({ kind: 'hypeEnd', broken: true }).parts.map((p) => p.sound)).toEqual(expect.arrayContaining(['djRewind', 'crowdOhh']));
    expect(cueFor({ kind: 'hypeEnd', broken: false }).parts.map((p) => p.sound)).toContain('djRewind');
    expect(cueFor({ kind: 'hypeStart' }).parts.map((p) => p.sound)).toEqual(expect.arrayContaining(['djBaby', 'subDrop']));
    expect(cueFor({ kind: 'fail' }).parts.map((p) => p.sound)).toContain('djBrake');
    expect(cueFor({ kind: 'roundWon' }).parts.map((p) => p.sound)).toContain('boom');
    expect(cueFor({ kind: 'ability', ability: 'eureka' }).parts.map((p) => p.sound)).toContain('abilityEureka');
    expect(cueFor({ kind: 'ability', ability: 'rind' }).parts.map((p) => p.sound)).toContain('abilityRind');
    expect(cueFor({ kind: 'flairFull' }).parts.map((p) => p.sound)).toEqual(['ready']);
  });

  it('drops the needle on the first round and spins the song back between rounds', () => {
    const first = cueFor({ kind: 'roundIntro', round: 0, total: 3 });
    expect(first.parts.map((p) => p.sound)).toEqual(['needleDrop', 'mcRound1']);
    const next = cueFor({ kind: 'roundIntro', round: 1, total: 3 });
    expect(next.parts.map((p) => p.sound)).toEqual(['djRewind', 'needleDrop', 'mcRound2']);
    // The needle lands as the spinback ends, and the MC comes in after it.
    const at = (sound: SfxName) => next.parts.find((p) => p.sound === sound)?.delay ?? 0;
    expect(at('needleDrop')).toBeCloseTo(next.duckLength ?? 0);
    expect(at('mcRound2')).toBeGreaterThan(at('needleDrop'));
    // It outranks the round's own sting, which may still be ringing.
    expect(next.priority).toBeGreaterThan(cueFor({ kind: 'roundWon' }).priority);
  });

  it('ships every recorded sample, small', () => {
    for (const file of SAMPLE_FILES) {
      const path = `public/${file}`;
      expect(existsSync(path), `${path} missing`).toBe(true);
      expect(statSync(path).size).toBeLessThan(80_000);
    }
  });
});

describe('the mix', () => {
  it('puts each battle sound on its bus', () => {
    expect(hypeBus('mcFlawless')).toBe('voice');
    expect(hypeBus('mcCrowdWild')).toBe('voice');
    expect(hypeBus('crowdRoar')).toBe('crowd');
    expect(hypeBus('crowdBed')).toBe('crowd');
    expect(hypeBus('airhorn')).toBe('hype');
    expect(hypeBus('djRewind')).toBe('hype');
  });

  it('keeps every hype bus and the busiest battle sounds under unity', () => {
    for (const level of Object.values(BUS_LEVELS)) expect(level).toBeLessThan(1);
    expect(BUS_LEVELS.crowd).toBeLessThan(BUS_LEVELS.voice);
    for (const name of ['perfect', 'good', 'hit', 'miss', 'combo', 'bonus', 'slam'] as SfxName[]) expect(LEVELS[name] ?? 1).toBeLessThan(1);
  });

  it('cuts the long tails of the big moments', () => {
    expect(sampleSpec('mcFlawless')?.length).toBeLessThanOrEqual(1.2);
    expect(sampleSpec('mcCrowdWild')?.length).toBeLessThan(3.1);
    expect(sampleSpec('crowdRoar')?.length).toBeLessThan(1.5);
  });

  it('takes the compressors\' makeup gain back off', () => {
    // The spec's makeup gain for a hard knee is (1 / curve(1))^0.6: a -10 dB, 20:1 limiter adds about 5.7 dB.
    expect(20 * Math.log10(makeupCompensation(-10, 20))).toBeCloseTo(-5.7, 1);
    expect(20 * Math.log10(makeupCompensation(-2, 20))).toBeCloseTo(-1.14, 2);
    expect(makeupCompensation(0, 4)).toBe(1);
  });
});

describe('hype mixer', () => {
  it('drops a smaller stinger while a bigger one plays', () => {
    const r = rig({ subDrop: 1, airhorn: 1.5 });
    r.cue({ kind: 'hypeStart' }, 0);
    r.cue({ kind: 'combo', combo: 10 }, 0.8);
    expect(r.sounds()).not.toContain('djChirp');
    // The small fx part of the cue still plays.
    expect(r.sounds().filter((s) => s === 'combo')).toHaveLength(1);
  });

  it('lets a bigger stinger cut a smaller one short', () => {
    const r = rig({}, 2);
    r.cue({ kind: 'combo', combo: 10 }, 0);
    r.cue({ kind: 'fail' }, 0.5);
    expect(r.stopped).toContain('djChirp');
    expect(r.sounds()).toContain('djBrake');
  });

  it('plays the next stinger once the channel is free', () => {
    const r = rig({ djChirp: 0.4 });
    r.cue({ kind: 'combo', combo: 10 }, 0);
    r.cue({ kind: 'combo', combo: 10 }, 1);
    expect(r.sounds().filter((s) => s === 'djChirp')).toHaveLength(2);
  });

  it('never lets the MC talk over itself, and queues the next line briefly', () => {
    const r = rig({ mcCombo: 0.8, mcDropped: 0.8 });
    r.cue({ kind: 'combo', combo: 50 }, 0); // "Combo!" at 0.45, until 1.25
    // A miss line (not a callout) wants 0.9: waits.
    r.cue({ kind: 'miss', scratch: false, crowd: null, line: 'mcDropped', duck: 0, duckLength: 0 }, 0.6);
    expect(r.sounds()).not.toContain('mcDropped');
    r.mixer.update(1.0);
    r.at(1.0);
    expect(r.sounds()).not.toContain('mcDropped');
    r.at(1.4);
    r.mixer.update(1.4);
    const line = r.played.find((p) => p.sound === 'mcDropped');
    expect(line?.at).toBeCloseTo(1.4);
  });

  it('plays one big callout at a time and drops the next, all but its small sounds', () => {
    const r = rig({ mcCrowdWild: 2.9, crowdRoar: 1.3, boom: 1.5, djFlare: 0.9 });
    r.cue({ kind: 'combo', combo: 100 }, 0);
    expect(r.mixer.calloutBusy(1)).toBe(true);
    // A clean phrase ends while "The crowd goes wild!" is still going.
    r.cue({ kind: 'flawless' }, 1);
    r.at(2);
    r.mixer.update(2);
    expect(r.sounds()).not.toContain('mcFlawless');
    expect(r.sounds()).toContain('bonus');
    // Nothing was waiting for it, either.
    r.at(5);
    r.mixer.update(5);
    expect(r.sounds()).not.toContain('mcFlawless');
    expect(r.mixer.calloutBusy(5)).toBe(false);
  });

  it('lets a bigger callout cut a smaller one off, MC line and all', () => {
    const r = rig({ mcFlawless: 1.1, bonus: 0.3 });
    r.cue({ kind: 'flawless' }, 0); // "Flawless!" at 0.05
    r.cue({ kind: 'combo', combo: 100 }, 0.3);
    expect(r.stopped).toContain('mcFlawless');
    // The MC is free at once for the bigger line.
    expect(r.played.find((p) => p.sound === 'mcCrowdWild')?.at).toBeCloseTo(0.75);
  });

  it('says "Flawless!" at most once per cooldown, with only the chime in between', () => {
    const r = rig({}, 1);
    r.cue({ kind: 'flawless' }, 0);
    r.cue({ kind: 'flawless' }, 8);
    r.cue({ kind: 'flawless' }, 16);
    expect(r.sounds().filter((s) => s === 'mcFlawless')).toHaveLength(1);
    expect(r.sounds().filter((s) => s === 'bonus')).toHaveLength(3);
    r.cue({ kind: 'flawless' }, FLAWLESS_COOLDOWN + 0.5);
    expect(r.sounds().filter((s) => s === 'mcFlawless')).toHaveLength(2);
  });

  it('dips the crowd and stingers while the MC speaks, not the song', () => {
    const r = rig({ mcHype: 1 }, 1);
    expect(r.mixer.voiceDuck(0)).toBe(1);
    r.cue({ kind: 'hypeStart' }, 0); // "Hype!" at 0.6 for 1 s
    expect(r.mixer.voiceDuck(0.3)).toBe(1);
    expect(r.mixer.voiceDuck(1)).toBe(VOICE_DUCK);
    expect(r.mixer.voiceDuck(1.7)).toBe(1);
    expect(r.mixer.duck(1)).toBe(1);
  });

  it('keeps the song up for every hype moment but the spinbacks and the end of the battle', () => {
    const during: HypeEvent[] = [
      { kind: 'combo', combo: 25 },
      { kind: 'combo', combo: 50 },
      { kind: 'combo', combo: 100 },
      { kind: 'hypeStart' },
      { kind: 'flawless' },
      { kind: 'roundWon' },
      { kind: 'roundLost' },
      { kind: 'ability', ability: 'steady' },
      { kind: 'drop' },
      { kind: 'roundIntro', round: 0, total: 3 },
    ];
    for (const event of during) expect(cueFor(event).duck ?? 0, event.kind).toBe(0);
    expect(cueFor({ kind: 'roundIntro', round: 1, total: 3 }).duck).toBeGreaterThan(0);
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
    r.cue({ kind: 'roundIntro', round: 0, total: 3 }, 0); // "Round one!" at 0.25, until 1.25
    r.cue({ kind: 'battleWon' }, 0.2);
    r.cue({ kind: 'letsDance' }, 0.3);
    r.at(1.4);
    r.mixer.update(1.4);
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
    expect(r.mixer.duck(0.5)).toBeCloseTo(0.4);
    expect(r.mixer.duck(30)).toBe(1);
  });

  it('cuts the song only for the length of a spinback', () => {
    const r = rig({}, 2);
    r.cue({ kind: 'roundIntro', round: 1, total: 3 }, 0);
    expect(r.mixer.duck(0.3)).toBeCloseTo(0.15);
    // Back as the needle drops, not when the MC finishes.
    expect(r.mixer.duck(0.62 + 0.45 + 0.01)).toBe(1);
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
