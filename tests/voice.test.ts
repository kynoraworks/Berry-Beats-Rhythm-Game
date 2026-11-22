import { describe, expect, it } from 'vitest';
import { BUS_LEVELS } from '../src/core/sfx';
import { VOICES, blipPitch, isSilence, isVoiced, overrideVoices, parseVoiceDoc, punctuationPause, voiceFor, voiceKey } from '../src/core/voice';
import { CAST } from '../src/story/cast';

describe('pixel voices', () => {
  it('has a voice for everyone in the cast and the placeholders for new faces', () => {
    for (const id of Object.keys(CAST)) expect(voiceFor(id), id).toBeDefined();
    for (const id of ['coach', 'strawberry', 'kidBerry', 'kidRaspberry', 'kidBlueberry', 'residentLow', 'residentHigh', 'residentOld', 'narrator', 'mc']) expect(VOICES[id], id).toBeDefined();
    for (const [id, voice] of Object.entries(VOICES)) {
      expect(voice.pitch, id).toBeGreaterThan(60);
      expect(voice.pitch, id).toBeLessThan(2000);
      expect(voice.blipMs, id).toBeGreaterThanOrEqual(15);
      expect(voice.every, id).toBeGreaterThanOrEqual(1);
      expect(voice.volume, id).toBeLessThanOrEqual(1);
    }
    // The kids sound younger than their grown-up selves.
    expect(VOICES.kidBerry.pitch).toBeGreaterThan(VOICES.berry.pitch);
    expect(VOICES.kidRaspberry.pitch).toBeGreaterThan(VOICES.raspberry.pitch);
    expect(VOICES.kidBlueberry.pitch).toBeGreaterThan(VOICES.blueberry.pitch);
    expect(VOICES.berry.breath).toBe(true);
    expect(VOICES.lemon.effect?.kind).toBe('shake');
  });

  it('gives station NPCs a steady resident voice by role, or their own if the table has one', () => {
    const cook = voiceFor('npc', 'COOK');
    expect(voiceFor('npc', 'COOK')).toEqual(cook);
    expect(voiceKey('Stall keeper')).toBe('stallKeeper');
    overrideVoices({ stallKeeper: { pitch: 300 } });
    expect(voiceFor('npc', 'STALL KEEPER').pitch).toBe(300);
    delete VOICES.stallKeeper;
  });

  it('only voices letters, and waits after punctuation', () => {
    expect(isVoiced('a')).toBe(true);
    expect(isVoiced('7')).toBe(true);
    expect(isVoiced(' ')).toBe(false);
    expect(isVoiced('!')).toBe(false);
    expect(punctuationPause('.', ' ', 'n')).toBeGreaterThan(punctuationPause(',', ' ', 'n'));
    expect(punctuationPause(',', ' ', 'n')).toBeGreaterThan(0);
    expect(punctuationPause('?', undefined, 'n')).toBeGreaterThan(0);
    expect(punctuationPause('a', 'b')).toBe(0);
    // A decimal point does not stop.
    expect(punctuationPause('.', ' ', 'r')).toBeGreaterThan(0);
    expect(punctuationPause('.', '5', '1')).toBe(0);
    expect(punctuationPause('.', '.', 'h')).toBeGreaterThan(0);
    expect(isSilence('...')).toBe(true);
    expect(isSilence('Last stop.')).toBe(false);
  });

  it('rises at the end of a question and follows its pattern', () => {
    const flat = { ...VOICES.blueberry, jitter: 0, pattern: 'flat' as const };
    expect(blipPitch(flat, 0, 0.1, false, 0.5)).toBeCloseTo(flat.pitch);
    expect(blipPitch(flat, 9, 1, true, 0.5)).toBeGreaterThan(flat.pitch);
    expect(blipPitch({ ...flat, pattern: 'fall' }, 9, 1, false, 0.5)).toBeLessThan(flat.pitch);
    expect(blipPitch({ ...flat, pattern: 'rise' }, 9, 1, false, 0.5)).toBeGreaterThan(flat.pitch);
  });

  it('plays on its own bus, under the music', () => {
    expect(BUS_LEVELS.talk).toBeLessThan(1);
    expect(BUS_LEVELS.talk).toBeGreaterThan(0);
  });

  it('reads overrides from a VOICES.md table or list, ignoring everything else', () => {
    const doc = [
      '# Voices',
      'Some prose about how everyone sounds.',
      '',
      '| Speaker | Wave | Pitch (Hz) | Jitter | Blip ms | Every | Volume | Pattern | Speed | Effect |',
      '|---|---|---|---|---|---|---|---|---|---|',
      '| `coach` | Triangle | 360 Hz | 1.2 | 40 ms | 2 | 0.5 | bounce | 1.1 | |',
      '| strawberry | sine | 240 | | | 3 | | fall | 0.8 | wave 0.2 |',
      '',
      '| Not | a | voice table |',
      '|---|---|---|',
      '| x | y | z |',
      '',
      '- `lemon`: wave=saw, pitch=640, effect=shake 0.4',
      '- just a bullet with no voice',
    ].join('\n');
    const parsed = parseVoiceDoc(doc);
    expect(Object.keys(parsed).sort()).toEqual(['coach', 'lemon', 'strawberry']);
    expect(parsed.coach).toMatchObject({ wave: 'triangle', pitch: 360, jitter: 1.2, blipMs: 40, every: 2, volume: 0.5, pattern: 'bounce', speed: 1.1 });
    expect(parsed.strawberry).toMatchObject({ wave: 'sine', pitch: 240, every: 3, pattern: 'fall', speed: 0.8, effect: { kind: 'wave', strength: 0.2 } });
    expect(parsed.lemon).toMatchObject({ wave: 'sawtooth', pitch: 640, effect: { kind: 'shake', strength: 0.4 } });
  });
});
