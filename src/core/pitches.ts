/** Pitches for the micro sounds that change note: who is talking, which stop is picked. All C major pentatonic. */

/** Voice pitches for the blips, in semitones: the C major pentatonic around Berry's. */
const VOICE_STEPS = [-5, -3, 2, 4, 7, 9, -8, 12];

/**
 * How high a speaker's voice blips are, as a playback rate. Berry sits at 1;
 * everyone else gets a note of the pentatonic from their name, so the same
 * person always sounds the same and two people rarely share a pitch.
 */
export function voiceRate(who: string, name: string): number {
  if (who === 'berry') return 1;
  let hash = 0;
  for (const c of name.toLowerCase()) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return 2 ** (VOICE_STEPS[hash % VOICE_STEPS.length] / 12);
}

/** The route map's note for stop `index`: up the C major pentatonic, an octave every five stops. */
export function stopPitch(index: number): number {
  const scale = [0, 2, 4, 7, 9];
  const semi = scale[index % 5] + 12 * Math.floor(index / 5);
  return 2 ** ((semi - 7) / 12);
}
