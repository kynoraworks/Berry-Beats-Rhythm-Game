import { Tex } from '../core/config';
import { CAST } from './cast';
import { SCRIPT } from './script';
import type { FruitId, GimmickId, StopRole, StopScript, TimeOfDay } from './types';

export type StopId = 'stop01' | 'stop02' | 'stop03' | 'stop04' | 'stop05' | 'stop06' | 'stop07' | 'stop08' | 'stop09' | 'stop10' | 'stop11' | 'stop12';

/** One stop on the Line. Station and street backgrounds are for Phase 3; time of day for Phase 5. */
export interface StopDef {
  id: StopId;
  /** 1 to 12. */
  number: number;
  /** Station name, as on the route map. */
  station: string;
  fruit: FruitId;
  role: StopRole;
  /** Stage of the hero's journey, from the bible's arc table. */
  journey: string;
  /** What happens here, from the bible's arc table. Writers' notes: not shown to players. */
  arc: string;
  /** Built-in song key. */
  song: string;
  chartId: string;
  chartUrl: string;
  /** Background the battle is danced on. Keys that are not loaded get a generated placeholder. */
  stage: string;
  /** The station the train pulls into (256x160). Stop 1's is Berry Town, where he boards for the first time. */
  stationBg: string;
  /**
   * The street the stop's fruit waits at the end of: its own wide art (640x160), or an
   * existing 256x160 stage where the bible reuses one. Null where there is no street
   * (stop 1 starts in Berry's room; stop 12's station leads straight to the stage).
   */
  streetBg: string | null;
  time: TimeOfDay;
  gimmick: GimmickId;
  /**
   * How well the stop's fruit dances (1 to 5, fractions blend; see rivalSkill in
   * core/battle.ts). Every battle must be won, so this climbs gently and the
   * charts and gimmicks carry most of the difficulty.
   */
  rivalLevel: number;
  /** The fruit who joins Berry's crew after this stop's win, if any. */
  joins?: FruitId;
  script: StopScript;
}

interface StopSeed {
  station: string;
  slug: string;
  fruit: FruitId;
  role: StopRole;
  journey: string;
  arc: string;
  song: string;
  /** An existing stage to dance on, or omitted for this stop's own (placeholder until drawn). */
  stage?: string;
  /** False for stops without a street. An existing stage is the street when the stop has one. */
  street?: boolean;
}

const SEEDS: StopSeed[] = [
  {
    station: 'Berry Town',
    slug: 'berry_town',
    fruit: 'raspberry',
    role: 'ally',
    journey: 'Ordinary World, Call, Mentor',
    arc: 'The Coach teaches the beat, Raspberry confronts Berry for hiding since summer, they battle, then the Coach hands over a ticket. Raspberry joins.',
    song: 'level1',
    stage: Tex.room,
    street: false,
  },
  {
    station: 'Peel Street',
    slug: 'peel_street',
    fruit: 'banana',
    role: 'local',
    journey: 'Crossing the Threshold',
    arc: 'First stop outside home. Berry barely speaks. A slapstick warm-up under a poster of Blueberry.',
    song: 'tutorial',
  },
  {
    station: 'Graffiti Corner',
    slug: 'graffiti_corner',
    fruit: 'pear',
    role: 'ally',
    journey: 'Allies',
    arc: "Pear joins. A wall mural shows a step-slide that looks like Berry's.",
    song: 'level_select',
    stage: Tex.stageStreet,
  },
  {
    station: 'Vine Crossing',
    slug: 'vine_crossing',
    fruit: 'grape',
    role: 'boss',
    journey: 'Enemies',
    arc: "First of Blueberry's crew. Grape says the step is their captain's.",
    song: 'menu',
  },
  {
    station: 'Citrus Labs',
    slug: 'citrus_labs',
    fruit: 'lemon',
    role: 'ally',
    journey: 'Allies',
    arc: "Lemon joins, with footage of Blueberry's crew using Berry's footwork.",
    song: 'pause',
    stage: Tex.stageLab,
  },
  {
    station: 'Plum Lantern Market',
    slug: 'lantern_market',
    fruit: 'plum',
    role: 'local',
    journey: 'Tests, false high',
    arc: "The crew's best night. Plum asks who is missing from Berry's dance. A scout in a dragon scarf takes notes.",
    song: 'title',
  },
  {
    station: 'The Club',
    slug: 'the_club',
    fruit: 'dragonfruit',
    role: 'boss',
    journey: 'Ordeal, low point',
    arc: 'Berry wins alone and the crew walks out because he never says what he feels. The crowd goes silent.',
    song: 'level1',
    stage: Tex.stageClub,
  },
  {
    station: 'Rooftop',
    slug: 'rooftop',
    fruit: 'watermelon',
    role: 'ally',
    journey: 'Reward',
    arc: 'Berry speaks his first full line and admits what happened in July. The crew returns. Watermelon makes five.',
    song: 'tutorial',
    stage: Tex.stageRooftop,
  },
  {
    station: 'The Tunnel',
    slug: 'the_tunnel',
    fruit: 'coconut',
    role: 'boss',
    journey: 'The Road Back',
    arc: "Blueberry's crew blocks the line. Coconut says the captain never laughs anymore.",
    song: 'title',
  },
  {
    station: 'Orange Plaza',
    slug: 'orange_plaza',
    fruit: 'orange',
    role: 'local',
    journey: 'Resurrection I',
    arc: "The Grand Dance opens. The crowd chants for Berry's face. He says not yet.",
    song: 'level_select',
  },
  {
    station: 'Pineapple Hall',
    slug: 'pineapple_hall',
    fruit: 'pineapple',
    role: 'boss',
    journey: 'Resurrection II',
    arc: 'Pineapple reveals the captain keeps asking about a hoodie who never answered.',
    song: 'pause',
  },
  {
    station: 'Grand Stage',
    slug: 'grand_stage',
    fruit: 'blueberry',
    role: 'final',
    journey: 'Return with the Elixir',
    arc: 'Five against five. Berry vs Blueberry. Berry finally says yes, the hood comes down, the trio reunites.',
    song: 'menu',
    street: false,
  },
];

/**
 * Rival skill per stop, 1 to 11 (stop 12 is the crew battle, with its own per round).
 * In accuracy this runs from about 60% to 72%, so a player who hits nine notes in
 * ten with ordinary timing can win every stop, and one who hits seven in ten cannot.
 */
const RIVAL_LEVELS = [2, 1.5, 2.2, 2.4, 2.6, 2.6, 2.8, 2.8, 3, 3, 3.1, 4];

/** Allies join the crew when their stop is won. */
const ALLIES: Partial<Record<FruitId, true>> = { raspberry: true, pear: true, lemon: true, watermelon: true };

function timeOfDay(stop: number): TimeOfDay {
  return stop <= 4 ? 'afternoon' : stop <= 8 ? 'dusk' : 'night';
}

export const STOPS: readonly StopDef[] = SEEDS.map((seed, i) => {
  const number = i + 1;
  const id = `stop${String(number).padStart(2, '0')}` as StopId;
  const script = SCRIPT.find((s) => s.stop === number);
  if (!script) throw new Error(`No dialogue for stop ${number}`);
  return {
    id,
    number,
    station: seed.station,
    fruit: seed.fruit,
    role: seed.role,
    journey: seed.journey,
    arc: seed.arc,
    song: seed.song,
    chartId: id,
    chartUrl: `charts/${id}.json`,
    stage: seed.stage ?? `stage_${seed.slug}`,
    stationBg: `station_${seed.slug}`,
    streetBg: seed.street === false ? null : (seed.stage ?? `street_${seed.slug}`),
    time: timeOfDay(number),
    gimmick: CAST[seed.fruit].gimmick ?? 'even',
    rivalLevel: RIVAL_LEVELS[i],
    joins: ALLIES[seed.fruit] ? seed.fruit : undefined,
    script,
  };
});

/** The Coach's lesson, played at the start of stop 1. */
export const TUTORIAL = { id: 'tutorial', chartUrl: 'charts/tutorial.json', song: 'tutorial', stage: Tex.room } as const;

export function stopById(id: string | undefined): StopDef | undefined {
  return STOPS.find((stop) => stop.id === id);
}

/** How well the rival dances a chart: its stop's level in the story, else the chart's own difficulty. */
export function rivalLevelFor(chart: { id: string; difficulty?: number }): number | undefined {
  return stopForChart(chart.id)?.rivalLevel ?? chart.difficulty;
}

/** The stop whose battle uses this chart. */
export function stopForChart(chartId: string): StopDef | undefined {
  return STOPS.find((stop) => stop.chartId === chartId);
}

/** Short line under a stop's name on the train. */
export function stopTeaser(stop: StopDef): string {
  switch (stop.role) {
    case 'ally':
      return 'Someone worth having on your side';
    case 'local':
      return 'A local who dances for fun';
    case 'boss':
      return "One of the captain's crew";
    case 'final':
      return 'The end of the Line';
  }
}

export const ROLE_LABELS: Record<StopRole, string> = { ally: 'Ally', local: 'Local', boss: 'Boss', final: 'Final' };
