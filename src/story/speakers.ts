import type { CharacterId } from './types';

/**
 * Who each speaker name in the bible is: a cast id, the role shown on the name
 * tag where it is not the cast name, and a voice (core/voice.ts, from
 * docs/story_v2/VOICES.md) where it is not the speaker's own. tests/story.test.ts
 * checks that every speaker in the bible is here.
 */
export interface Speaker {
  who: CharacterId;
  role?: string;
  voice?: string;
}

const cast = (who: CharacterId, extra: Omit<Speaker, 'who'> = {}): Speaker => ({ who, ...extra });
/** A generic resident: the stand-in NPC, named by role, voiced by their preset (VOICES.md 2.1). */
const resident = (role: string): Speaker => ({ who: 'npc', role });
/**
 * Prologue and epilogue speakers drawn by the cutscenes (src/cutscene/speakers.ts):
 * a resident line whose role is `@<id>`, as the cutscenes expect.
 */
const cutscene = (id: string): Speaker => ({ who: 'npc', role: `@${id}` });

export const SPEAKERS: Record<string, Speaker> = {
  Berry: cast('berry'),
  Coach: cast('coach'),
  Raspberry: cast('raspberry'),
  Blueberry: cast('blueberry'),
  Pear: cast('pear'),
  'Dr. Lemon': cast('lemon'),
  Watermelon: cast('watermelon'),
  Banana: cast('banana'),
  Grape: cast('grape'),
  Plum: cast('plum'),
  'Dragon Fruit': cast('dragonfruit'),
  Coconut: cast('coconut'),
  Orange: cast('orange'),
  Pineapple: cast('pineapple'),
  Strawberry: cast('strawberry'),
  'The Conductor': cast('strawberry', { role: 'The Conductor', voice: 'conductor' }),
  'Juice FM': cast('juiceFm', { voice: 'juiceFm' }),
  'Coach (text)': cast('phone', { role: 'Coach (text)', voice: 'phone' }),
  'Raspberry (text)': cast('phone', { role: 'Raspberry (text)', voice: 'phone' }),
  // Trainers.
  Lime: cast('lime'),
  Peach: cast('peach'),
  Bing: cast('bing'),
  Morello: cast('morello'),
  Grapefruit: cast('grapefruit'),
  Lychee: cast('lychee'),
  'Passion Fruit': cast('passionFruit'),
  Mango: cast('mango'),
  Fig: cast('fig'),
  Quince: cast('quince'),
  // Named residents.
  'Mrs. Damson': cast('mrsDamson'),
  'Postmaster Gooseberry': cast('gooseberry'),
  'Little Currant': cast('currant'),
  Kumquat: cast('kumquat'),
  'Clerk Date': cast('clerkDate'),
  'Mopper Sloe': cast('sloe'),
  'Mr. Olive': cast('olive'),
  Nib: cast('nib'),
  'Officer Elderberry': cast('elderberry'),
  Seedless: cast('seedless'),
  'Robot B-33': cast('b33'),
  Door: cast('b33', { role: 'Door' }),
  'Mrs. Satsuma': cast('satsuma'),
  'Auntie Longan': cast('longan'),
  Kiwi: cast('kiwi'),
  'Foreman Chestnut': cast('chestnut'),
  'Ms. Clementine': cast('clementine'),
  'Lord Medlar': cast('medlar'),
  // The prologue's and the finale's own (drawn by the cutscenes).
  'Kid Berry': cutscene('kidBerry'),
  'Kid Raspberry': cutscene('kidRaspberry'),
  'Kid Blueberry': cutscene('kidBlueberry'),
  Cranberry: cutscene('cranberry'),
  'Orange (young)': cutscene('orangeYoung'),
};

/** Generic residents by the role the bible gives them. */
const RESIDENTS = [
  'Sweeper',
  'Attendant',
  'Tourist',
  'Other Tourist',
  'Commuter',
  'Fence Sitter',
  'Other Fence Sitter',
  'Guard',
  'Cafe Owner',
  'Map Reader',
  'Lab Security',
  'Intern',
  'Clipboard Tech',
  'Stall Keeper',
  'Dumpling Cook',
  'Wish Board Kid',
  'Fanning Elder',
  'Queue Fan',
  'Bartender',
  'DJ',
  'Cook',
  'Diner',
  'Guest',
  'Worker',
  'Sleeping Worker',
  'Hot Cider Vendor',
  'Foam Finger Fan',
  'Confetti Tech',
  'Usher',
  'Waiter',
  'Stagehand',
  'Camera Operator',
  'Security',
];
for (const role of RESIDENTS) SPEAKERS[role] = resident(role);

/** The speaker of a bible name, or undefined for a name nobody has mapped. */
export function speakerOf(name: string): Speaker | undefined {
  return SPEAKERS[name];
}

/**
 * Berry's voice by where he is in the story (VOICES.md): the silent pillow tap
 * until his first sentence on the Rooftop, warmer after, brighter once the hood
 * is down for good.
 */
export function berryVoice(part: string, afterMic: boolean): string {
  const stop = /^s(\d\d)$/.exec(part);
  if (part === 'credits') return 'berryHoodDown';
  if (!stop) return 'berry';
  const n = Number(stop[1]);
  if (n < 8 || (n === 8 && !afterMic)) return 'berrySilent';
  return 'berry';
}
