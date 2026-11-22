import Phaser from 'phaser';
import {
  Battle,
  FLAWLESS_BONUS,
  FLAWLESS_PUSH,
  FlawlessTracker,
  PlannedPlayer,
  RIVAL_PULL,
  buildPhrases,
  buildRounds,
  buildTurns,
  planRival,
  rivalPersonality,
  seededRandom,
  type Side,
  type Turn,
  type TurnSegment,
} from '../core/battle';
import { COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys, Tex, type Lane } from '../core/config';
import { beatToSec, secToBeat, toTimedNotes, type Chart } from '../core/chart';
import { HypeAudio, type CountCall, type HypeEvent } from '../core/announcer';
import { Conductor } from '../core/conductor';
import { Engine, START_HEALTH, type JudgeEvent, type PlayNote } from '../core/engine';
import type { BattleSummary, PlayData, ResultsData } from '../core/flow';
import { LaneInput } from '../core/input';
import { isRotateNoticeShown, isTouch, onRotateNoticeChange } from '../core/mobile';
import { music, pauseSongFor } from '../core/music';
import { getSettings, keyLabel } from '../core/settings';
import { playSfx, preloadSamples, type SfxName } from '../core/sfx';
import { getAudioContext, loadLeadBuffer, loadSongBuffer } from '../core/songs';
import { HitLayer } from '../core/hitLayer';
import { TouchLanes } from '../core/touchLanes';
import { onBackGesture } from '../core/backGesture';
import { SCHEME_INFO } from '../core/touchSchemes';
import { FocusGroup, UiButton, addBody, addBox, addDim, addText, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { createPlayer, createRival, createSheetDancer, type Dancer } from '../play/characters';
import { SCRIPTED_TURNS, ScriptedDirector, type ScriptedPlay } from '../play/scripted';
import { actorArt } from '../cutscene/actors';
import { staticSting, sustainedNote } from '../cutscene/audio';
import { HoldToSkip, StaticScreen } from '../cutscene/fx';
import { finishPrologue } from '../cutscene/flow';
import { Dialogue, consumeSkipIntro, skipNextIntro } from '../play/Dialogue';
import { Hud } from '../play/Hud';
import { BASE_SCROLL_SPEED, Depth, PLAYER_FIELD_CENTER, PLAYER_LANES, PLAYER_X, RECEPTOR_Y, RIVAL_LANES, RIVAL_X } from '../play/layout';
import { NoteField } from '../play/NoteField';
import { rivalProfile, rivalTexture, type RivalProfile } from '../play/rivals';
import { BattleEffects } from '../play/BattleEffects';
import { effectChips } from '../play/fighterCard';
import { HypeMode } from '../play/HypeMode';
import { DuoStage } from '../play/DuoStage';
import { StageFx } from '../play/StageFx';
import { BattleCamera } from '../play/BattleCamera';
import { MissReactor, cameraLevel, phraseEnds, songShape, type SongShape } from '../play/battleLife';
import { VersusCard } from '../play/VersusCard';
import { Countdown } from '../play/Countdown';
import { planCountdown } from '../play/countdownPlan';
import { ABILITIES } from '../story/abilities';
import { CAST } from '../story/cast';
import { cycleBackup, getBackup, listAvailable } from '../story/crew';
import { crewAt } from '../story/places';
import type { FruitId } from '../story/types';
import { GIMMICK_TRAITS, NO_RULES, battleRules, type BattleRules } from '../story/gimmicks';
import { STOPS, battleForChart, rivalLevelFor, stopById, stopForChart } from '../story/stops';
import { CREW_ROUNDS, checkpointSession, endSession, getSession, recordRound, setVerdict, type CrewRoundPlay, type RoundResult } from '../story/crewBattle';
import { segmentAt } from '../story/flow';
import { characterSheet, stageTexture } from '../story/placeholders';
import { feetY } from '../explore/floors';
import { markBattleWon, markSeen } from '../story/progress';
import { windowsFor } from '../core/difficulty';
import { nextRef, playSegment } from '../story/run';
import type { Line } from '../story/types';

type State = 'loading' | 'playing' | 'paused' | 'resuming' | 'ended';

/**
 * Development aid: "Auto-hit" in the pause menu makes the game hit every note.
 * It stays on for the rest of the session (every battle after it), so a tester
 * can run through the story; results played with it are never saved as scores.
 */
let devAutoHit = false;

/**
 * Play data with battle rules set by the caller (the crew battle sets each
 * round's gimmick and ability). Without them a story stop's own apply.
 */
export type RuledPlayData = PlayData & { rules?: BattleRules; crew?: CrewRoundPlay; scripted?: ScriptedPlay };

/** What the results screen gets on top of the usual: how often the Flair was fired. */
export type FlairResults = ResultsData & { flairUsed?: number; abilityName?: string };

/** Silent lead-in before the song starts, with a 3-2-1 countdown. */
const LEAD_IN = 2.4;
/** Lead-in when starting part-way through a song from the composer. */
const PRACTICE_LEAD_IN = 1.5;
const COUNT_STEP = 0.6;
/** Events that count as a user gesture for unlocking audio (phones need the "up" events). */
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;
/** Combos that earn a showpiece move. After the last one it repeats every 50. */
const COMBO_MILESTONES = [10, 25, 50, 75, 100];
/** A turn is announced this long before its first bar, while its notes are already on the way. */
const TURN_LEAD = 0.45;
/** A round is settled this long after its last bar, once late notes have been judged. */
const ROUND_SETTLE = 0.3;
/** Mean timing error is only reported from this many hits. */
const MIN_ERROR_SAMPLES = 20;
/** Perfects in a row from which each one bursts a ring out of its receptor. */
const PERFECT_RUN = 8;
/** Camera kicks (zoom added): the end of a phrase, a milestone, the drop, a round lost. */
const PHRASE_PUNCH = 0.03;
const MILESTONE_PUNCH = 0.055;
const DROP_PUNCH = 0.085;
const ROUND_PUNCH = 0.05;
/** Seconds the camera holds the wide shot after a round. */
const ROUND_WIDE = 1.8;
/** How far up from the dancers' feet the camera looks on a turn: about chest height. */
const CHEST = 28 * PX;

const TURN_LABELS: Record<'battle' | 'lesson', Record<Exclude<Turn, 'rest'>, string>> = {
  battle: { player: 'Your turn!', rival: "'s turn", both: 'Face-off!' },
  lesson: { player: 'Your turn!', rival: 'Watch', both: 'Together!' },
};
const TURN_COLORS: Record<Exclude<Turn, 'rest'>, string> = { player: CSS.blue, rival: CSS.pink, both: CSS.yellow };

/** The crew battle's music fades out over this long as a round ends. */
const ROUND_FADE = 1.6;

/** Tint for the dancer who is not speaking during a conversation. */
const LISTENER_TINT = 0x7a7896;
/** Tempo of the standing idle while no music is playing. */
const IDLE_BPM = 77;

export class PlayScene extends Phaser.Scene {
  private playData!: RuledPlayData;
  /** A round of the crew battle, when this is one. */
  private crew: CrewRoundPlay | null = null;
  /** Song time where play starts: 0, or a crew round's first bar. */
  private origin = 0;
  private rules: BattleRules = NO_RULES;
  private effects: BattleEffects | null = null;
  private hype: HypeMode | null = null;
  private backupLabel: Phaser.GameObjects.Text | null = null;
  private backupButton: UiButton | null = null;
  private chart!: Chart;
  private state: State = 'loading';
  private conductor: Conductor | null = null;
  /** The song's lead, heard only while notes are being hit (core/hitLayer.ts). Null for songs without one. */
  private hitLayer: HitLayer | null = null;
  /** The MC, crowd and stingers of a battle. */
  private hypeAudio: HypeAudio | null = null;
  private engine!: Engine;
  private laneInput: LaneInput | null = null;
  private touchLanes: TouchLanes | null = null;
  private pauseButton!: Phaser.GameObjects.Image;
  /** The pause menu is open outside a song (over a conversation or loading). */
  private menuOnly = false;
  /** A song that finished loading while that menu was open. */
  private pendingBuffer: AudioBuffer | null = null;
  private stopRotateWatch: (() => void) | null = null;
  private playerField!: NoteField;
  private rivalField: NoteField | null = null;
  private rivalEngine: Engine | null = null;
  private rivalDriver: PlannedPlayer | null = null;
  private rivalName = '';
  private rivalLook: RivalProfile = rivalProfile(undefined);
  private battle: Battle | null = null;
  private flawless: FlawlessTracker | null = null;
  private turns: TurnSegment[] = [];
  private turnIndex = 0;
  private currentTurn: Turn = 'rest';
  private roundAnnounced = false;
  /** True while the song is dipped under a hype cue, so it is put back afterwards. */
  private ducked = false;
  private roundsSettled = 0;
  private introTime = 0;
  private versus: VersusCard | null = null;
  private errorSum = 0;
  private errorCount = 0;
  private stage!: StageFx;
  private player!: Dancer;
  private rival: Dancer | null = null;
  /** Berry and the rival dancing together in the free bars and at the end (src/play/duo.ts). */
  private duo: DuoStage | null = null;
  private hud!: Hud;
  private speed = BASE_SCROLL_SPEED;
  private offsetSec = 0;
  private lastNoteEnd = 0;
  private countdown: Countdown | null = null;
  /** Plays the countdown's hits and MC: the battle's hype audio, or one of its own outside a battle. */
  private countAudio: HypeAudio | null = null;
  private countText!: Phaser.GameObjects.Text;
  private pauseLayer!: Phaser.GameObjects.Container;
  private pauseFocus!: FocusGroup;
  private dialogue: Dialogue | null = null;
  /** The story segment being played, if this is part of the story. */
  private story: ReturnType<typeof segmentAt> = null;
  private buffer: AudioBuffer | null = null;
  private leadBuffer: AudioBuffer | null = null;
  private introDone = true;
  private loadingBack: UiButton | null = null;
  private idleClock = 0;
  private autoHeld: (PlayNote | null)[] = [null, null, null, null];
  private nextMilestone = COMBO_MILESTONES[0];
  /** The stage camera (null with camera motion off). */
  private camera: BattleCamera | null = null;
  /** The song's drops and intense bars, read from the chart. */
  private shape: SongShape = { drops: [], intense: [] };
  private dropIndex = 0;
  /** Ids of the notes that end a phrase, for a small camera punch when they land. */
  private playerEnds = new Set<number>();
  private rivalEnds = new Set<number>();
  private missReactor = new MissReactor(Math.random);
  /** The combo as it stood after the last hit, so a miss knows what it broke. */
  private lastCombo = 0;
  private perfectRun = 0;
  /** True once auto-hit was on at any point in this song, so its result is not saved as a score. */
  private autoUsed = false;
  private autoTag: Phaser.GameObjects.Text | null = null;
  private autoButton: UiButton | null = null;
  /** The prologue's scripted battle (src/play/scripted.ts), when this is it. */
  private director: ScriptedDirector | null = null;
  /** The freeze frame is up: nothing moves but the tape counter and the static. */
  private frozen = false;
  private staticScreen: StaticScreen | null = null;
  private skipRing: HoldToSkip | null = null;

  constructor() {
    super(SceneKeys.Play);
  }

  init(data: RuledPlayData): void {
    this.playData = devAutoHit && !data.autoplay ? { ...data, autoplay: true } : data;
    this.autoUsed = !!this.playData.autoplay;
    this.autoTag = null;
    this.autoButton = null;
    this.crew = data.crew ?? null;
    this.origin = data.crew?.start ?? 0;
    this.rules = NO_RULES;
    this.effects = null;
    this.hype = null;
    this.backupLabel = null;
    this.backupButton = null;
    this.chart = data.chart;
    this.state = 'loading';
    this.conductor = null;
    this.hitLayer = null;
    this.hypeAudio = null;
    this.laneInput = null;
    this.rivalField = null;
    this.rival = null;
    this.duo = null;
    this.rivalEngine = null;
    this.rivalDriver = null;
    this.rivalName = '';
    this.rivalLook = rivalProfile(undefined);
    this.battle = null;
    this.flawless = null;
    this.turns = [];
    this.turnIndex = 0;
    this.currentTurn = 'rest';
    this.roundAnnounced = false;
    this.ducked = false;
    this.roundsSettled = 0;
    this.introTime = 0;
    this.versus = null;
    this.errorSum = 0;
    this.errorCount = 0;
    this.countdown = null;
    this.countAudio = null;
    this.dialogue = null;
    this.story = null;
    this.buffer = null;
    this.leadBuffer = null;
    this.introDone = true;
    this.loadingBack = null;
    this.idleClock = 0;
    this.touchLanes = null;
    this.menuOnly = false;
    this.pendingBuffer = null;
    this.stopRotateWatch = null;
    this.autoHeld = [null, null, null, null];
    this.nextMilestone = COMBO_MILESTONES[0];
    this.camera = null;
    this.shape = { drops: [], intense: [] };
    this.dropIndex = 0;
    this.playerEnds = new Set();
    this.rivalEnds = new Set();
    this.missReactor = new MissReactor(seededRandom(`${data.chart.id}:misses`));
    this.lastCombo = 0;
    this.perfectRun = 0;
    this.director = null;
    this.frozen = false;
    this.staticScreen = null;
    this.skipRing = null;
  }

  create(): void {
    fadeIn(this);
    music.stop(300);
    const settings = getSettings();
    this.speed = BASE_SCROLL_SPEED * settings.scrollSpeed;
    this.offsetSec = settings.audioOffsetMs / 1000;
    const chart = this.chart;
    const story = (this.story = this.playData.practice ? null : segmentAt(this.playData.story));
    const segment = story?.segment;
    const startAt = this.playData.startAt ?? 0;
    const rivalKind = chart.rivalCharacter ?? 'raspberry';
    const rivalChart = rivalKind === 'none' ? [] : (chart.rival ?? []);
    const hasRival = rivalKind !== 'none';
    const isCoach = rivalKind === 'dancer';
    this.rivalLook = rivalProfile(rivalKind);
    this.rivalName = this.rivalLook.name;
    // A scored battle needs notes on both sides. The Coach only demonstrates, and a
    // test play from the middle of a song would start with rounds already half over.
    const scripted = this.playData.scripted ?? null;
    const isBattle = !scripted && hasRival && !isCoach && rivalChart.length > 0 && chart.notes.length > 0 && startAt === 0 && segment?.kind !== 'lesson';
    const crew = this.crew;
    // A lesson cannot be failed: the Coach just keeps counting.
    // The prologue is a showcase, not a test: it cannot be failed either.
    const noFail = settings.noFail || !!this.playData.practice || segment?.kind === 'lesson' || !!scripted;

    this.engine = new Engine(toTimedNotes(chart, chart.notes), { noFail });
    // Easy gives a little more timing slack (core/difficulty.ts).
    this.engine.mods.windows = windowsFor(this.playData.difficulty);
    // The crew battle's bar carries over from the round before.
    if (crew) this.engine.adjustHealth(crew.health - START_HEALTH);
    this.rules = isBattle ? this.resolveRules() : NO_RULES;
    let rivalPlan: ReturnType<typeof planRival> = [];
    if (hasRival) {
      this.rivalEngine = new Engine(toTimedNotes(chart, rivalChart), { noFail: true });
      const notes = this.rivalEngine.notes;
      rivalPlan = planRival(notes.length, rivalLevelFor(chart, this.playData.difficulty), chart.id, { flawless: !isBattle, personality: rivalPersonality(rivalKind), notes });
      this.rivalDriver = new PlannedPlayer(this.rivalEngine, rivalPlan);
      this.turns = buildTurns(chart, chart.notes, rivalChart);
    }
    if (isBattle) {
      // A crew round is one round from its first bar to its last.
      this.battle = new Battle(crew ? [{ startBar: crew.startBar, endBar: crew.endBar, start: crew.start, end: crew.end }] : buildRounds(chart, chart.notes, rivalChart));
      this.flawless = new FlawlessTracker(buildPhrases(chart, this.turns, chart.notes));
      if (!this.playData.practice) this.introTime = VersusCard.DURATION;
    }
    if (startAt > 0) {
      this.engine.skipBefore(startAt);
      this.rivalEngine?.skipBefore(startAt);
      while (this.turnIndex < this.turns.length && this.turns[this.turnIndex].end <= startAt) this.turnIndex++;
    }
    const ends = [...this.engine.notes, ...(this.rivalEngine?.notes ?? [])].map((n) => n.end);
    this.lastNoteEnd = ends.reduce((latest, end) => Math.max(latest, end), 0);

    const playerX = hasRival ? PLAYER_X : GAME_W / 2;
    const place = story?.stop ?? (crew ? stopById('stop12') : undefined);
    let stageKey = segment?.stage ?? (crew ? place?.stage : undefined) ?? chart.stage ?? Tex.room;
    // A stop's stage not drawn yet is cut from its street, or stood in for, also when its chart is played on its own.
    const owner = place ?? STOPS.find((stop) => stop.stage === stageKey);
    if (owner && !this.textures.exists(stageKey)) stageKey = stageTexture(this, stageKey, owner.station, owner.time, CAST[owner.fruit].color);
    this.stage = new StageFx(this, stageKey, playerX, hasRival ? RIVAL_X : null, settings.reduceMotion);
    this.playerField = new NoteField(this, PLAYER_LANES, this.engine.notes);
    // Feet go on the stage art's own floor line under each dancer.
    const stageFloor = this.stage.layers.background.texture.key;
    if (scripted) {
      // The prologue: the player dances as Cranberry, in her own sheet once it is drawn (the Coach's until then).
      const cran = actorArt(this, 'cranberry');
      this.player = createSheetDancer(this, playerX, feetY(stageFloor, playerX), cran.texture, cran.layout === 'lite' ? 'lite' : 'berry', 1, { seed: chart.id, calm: settings.reduceMotion });
    } else {
      this.player = createPlayer(this, playerX, feetY(stageFloor, playerX), crew?.ally ?? 'berry', { seed: chart.id, calm: settings.reduceMotion });
    }
    this.player.setSchedule(this.engine.notes.map((n) => secToBeat(chart, n.t)), 60 / chart.bpm);
    const rounds = this.battle && this.battle.rounds.length > 1 ? this.battle.rounds.length : 0;
    const session = crew ? getSession() : null;
    this.hud = new Hud(this, {
      rivalScore: isBattle,
      rounds,
      rival: rivalKind,
      player: scripted ? 'coach' : (crew?.ally ?? 'berry'),
      crew: crew ? { round: crew.round, results: session?.results ?? [] } : null,
      gimmick: this.rules.gimmick,
      calm: settings.reduceMotion,
    });
    this.hud.setBattle(this.battle, 60 / chart.bpm);
    if (this.rivalEngine) {
      this.rivalField = new NoteField(this, RIVAL_LANES, this.rivalEngine.notes, true);
      if (scripted) {
        // Strawberry, the Summer Legend: her sheet when drawn, else Raspberry's in her red.
        const straw = actorArt(this, 'strawberry');
        this.rival = createSheetDancer(this, RIVAL_X, feetY(stageFloor, RIVAL_X), straw.texture, straw.layout === 'lite' ? 'lite' : 'berry', -1, { seed: chart.id, calm: settings.reduceMotion });
        if (straw.tint !== undefined) this.rival.sprite.setTint(straw.tint);
        this.rivalName = 'Strawberry';
      } else {
        this.rival = createRival(this, rivalKind, RIVAL_X, feetY(stageFloor, RIVAL_X), { seed: chart.id, calm: settings.reduceMotion });
      }
      const rivalNotes = this.rivalEngine.notes;
      this.rival?.setSchedule(rivalNotes.map((n) => secToBeat(chart, n.t)), 60 / chart.bpm);
      const beats = (notes: readonly { t: number; end: number }[]): number[] => notes.flatMap((n) => (n.end > n.t ? [secToBeat(chart, n.t), secToBeat(chart, n.end)] : [secToBeat(chart, n.t)]));
      if (this.rival) {
        this.duo = new DuoStage({ player: this.player, rival: this.rival, kind: rivalKind, playerBeats: beats(this.engine.notes), rivalBeats: beats(rivalNotes), secondsPerBeat: 60 / chart.bpm });
      }
    } else {
      this.hud.setSolo();
      this.stage.setTurn('player');
    }

    // The stage camera, the song's shape and the phrase ends (src/play/battleLife.ts).
    this.shape = songShape([...chart.notes, ...rivalChart].map((n) => n.b));
    this.dropIndex = startAt > 0 ? this.shape.drops.filter((b) => beatToSec(chart, b) < startAt).length : 0;
    this.camera = BattleCamera.create(this, cameraLevel(settings.cameraMotion, settings.reduceMotion), {
      width: GAME_W,
      height: GAME_H,
      playerX,
      rivalX: this.rival ? RIVAL_X : null,
      bodyY: feetY(stageFloor, playerX) - CHEST,
    }, this.shape);
    const camera = this.camera;
    this.stage.setPunchTarget(camera ? (size) => camera.punch(size) : null);
    this.playerEnds = phraseEndIds(chart, this.engine.notes);
    this.rivalEnds = this.rivalEngine ? phraseEndIds(chart, this.rivalEngine.notes) : new Set();

    if (this.rules.gimmick || this.rules.ability) {
      const hud = this.hud;
      this.effects = new BattleEffects(this, {
        chart,
        rules: this.rules,
        engine: this.engine,
        field: this.playerField,
        battle: this.battle,
        rivalNotes: this.rivalEngine?.notes ?? [],
        rivalPlan,
        rivalName: this.rivalName,
        rivalColor: this.rivalLook.color,
        rivalCss: this.rivalLook.css,
        calm: settings.reduceMotion,
        touch: isTouch(),
        // In the crew battle each ally fires their ability once in their round.
        maxFires: crew ? 1 : undefined,
        hooks: {
          callout: (text, color) => hud.callout(text, color),
          sfx: (name) => this.effectSfx(name),
          flash: (color, alpha) => this.stage.flash(color, alpha),
          cheer: () => {
            this.stage.cheer();
            this.player.special();
          },
        },
      });
    }

    // The Flair meter sits first in the HUD's effect row.
    this.hud.setFlair(!!(this.rules.ability && this.rules.abilityOwner));

    // Hype: the player's streak reward in a battle (not in the Coach's lessons).
    if (this.rival && segment?.kind !== 'lesson') {
      this.hype = new HypeMode(this, {
        chart, engine: this.engine, stage: this.stage, player: this.player, rival: this.rival,
        playerField: this.playerField, rivalField: this.rivalField, playerLanes: PLAYER_LANES, rivalLanes: RIVAL_LANES, playerX, rivalX: RIVAL_X,
        camera: settings.hypeCamera && !settings.reduceMotion,
        hooks: { sfx: (name) => this.hypeModeSfx(name), flash: (color, alpha) => this.stage.flash(color, alpha), cheer: () => this.stage.cheer(), punch: () => this.stage.punch(0.075) },
      });
    }

    if (scripted) this.startScripted(scripted);

    const pause = (this.pauseButton = this.add.image(14, 18, Tex.pauseButton)).setOrigin(0).setScale(4).setDepth(Depth.hud).setInteractive({ useHandCursor: true });
    pause.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.openPause();
    });

    this.countText = addText(this, GAME_W / 2, 390, '', 64).setDepth(Depth.overlay);
    const tag = this.playData.practice ? 'Test play' : this.playData.autoplay ? 'Autoplay' : '';
    this.autoTag = addBody(this, GAME_W / 2, 776, tag, 16, { color: CSS.yellow, bold: true, stroke: true }).setAlpha(0.8).setDepth(Depth.hud);


    this.buildPauseMenu();
    this.setupInput();

    preloadSamples(this.game);
    // Like hype mode, the crowd and MC are for battles, not the Coach's lessons.
    // The DJ spins back and brakes the battle song itself.
    const song = () => (this.conductor ? { buffer: this.conductor.buffer, time: this.conductor.time } : null);
    this.hypeAudio = this.rival && this.story?.segment?.kind !== 'lesson' ? new HypeAudio(this.game, song) : null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);

    // Story stages open with a conversation, unless this is a retry of one just seen.
    const retry = consumeSkipIntro();
    const intro = retry || startAt > 0 ? [] : (segment?.before ?? crew?.before ?? []);
    if (intro.length > 0) {
      this.introDone = false;
      this.touchLanes?.setGuideVisible(false);
      this.startDialogue(intro, () => {
        this.introDone = true;
        this.maybeBegin();
      });
    } else {
      this.showLoading();
    }

    Promise.all([loadSongBuffer(this.game, chart.song), loadLeadBuffer(this.game, chart.song)]).then(
      ([buffer, lead]) => {
        this.leadBuffer = lead;
        this.buffer = buffer;
        this.maybeBegin();
      },
      (error: unknown) => this.showLoadError(error instanceof Error ? error.message : 'Could not load the song'),
    );
  }

  /** Who is with Berry at this stop as the story has it, so a replay never borrows a later ally. */
  private storyCrew(): FruitId[] {
    const stop = this.story?.stop ?? stopForChart(this.chart.id);
    return stop ? crewAt(stop) : [];
  }

  /**
   * The battle's rules: given by the caller (the crew battle), or a story
   * stop's own gimmick with the chosen backup's ability. Custom maps and test
   * plays get none.
   */
  private resolveRules(): BattleRules {
    if (this.playData.rules) return this.playData.rules;
    if (this.playData.practice) return NO_RULES;
    const stop = this.story?.stop ?? stopForChart(this.chart.id);
    if (!stop) return NO_RULES;
    // The gimmick is the opponent's: at Orange Plaza, battles A and B are Banana and Plum.
    return battleRules(battleForChart(this.chart.id)?.gimmick ?? stop.gimmick, getBackup(crewAt(stop)));
  }

  // ---------------------------------------------------------------------
  // Start, pause, finish
  // ---------------------------------------------------------------------

  /** The song starts once it has loaded and the opening conversation is over. */
  private maybeBegin(): void {
    if (!this.introDone) return;
    if (this.buffer) this.begin(this.buffer);
    else if (this.state === 'loading') this.showLoading();
  }

  /** "Loading..." with a way out, in case the song is slow or never arrives. */
  private showLoading(): void {
    if (this.loadingBack || !this.sys.isActive()) return;
    this.countText.setText('Loading...');
    this.loadingBack = addUiButton(this, GAME_W / 2, 480, 'Back', () => this.quit(), { width: 200, icon: 'icon_back', sfx: 'back' }).setDepth(Depth.overlay);
  }

  private hideLoading(): void {
    this.loadingBack?.destroy();
    this.loadingBack = null;
  }

  private begin(buffer: AudioBuffer): void {
    if (!this.sys.isActive() || this.state !== 'loading' || isLeaving(this)) return;
    // The song waits while the pause menu is open over the loading screen.
    if (this.menuOnly) {
      this.pendingBuffer = buffer;
      return;
    }
    const ctx = getAudioContext(this.game);
    if (ctx.state !== 'running') {
      // Browsers keep audio locked until the page is clicked or a key is pressed.
      this.countText.setText(isTouch() ? 'Tap to start' : 'Click to start').setFontSize(48);
      const unlock = () => {
        for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock);
        void ctx.resume().then(() => this.begin(buffer));
      };
      for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unlock);
      return;
    }
    this.hideLoading();
    this.countText.setFontSize(64);
    this.touchLanes?.setGuideVisible(true);
    this.conductor = new Conductor(ctx, buffer, getSettings().musicVolume);
    if (this.leadBuffer) {
      const notes = [...this.engine.notes, ...(this.rivalEngine?.notes ?? [])];
      this.hitLayer = new HitLayer(ctx, this.conductor.setLayer(this.leadBuffer), this.chart.bpm, notes);
    }
    const startAt = this.playData.startAt ?? 0;
    // A crew round enters its song part-way through, after a silent count-in.
    if (this.crew) this.conductor.play(this.origin - LEAD_IN - this.introTime, this.origin);
    else this.conductor.play(startAt > 0 ? startAt - PRACTICE_LEAD_IN : -LEAD_IN - this.introTime);
    this.countText.setText('');
    this.startCountdown(startAt > 0 ? startAt : this.origin, startAt > 0 ? PRACTICE_LEAD_IN : LEAD_IN);
    if (this.introTime > 0) {
      const texture = rivalTexture(this, this.chart.rivalCharacter ?? 'raspberry') ?? Tex.raspberry;
      const gimmick = this.rules.gimmick;
      const look = gimmick ? { ...this.rivalLook, trait: GIMMICK_TRAITS[gimmick] } : this.rivalLook;
      const ability = this.rules.ability ? ABILITIES[this.rules.ability] : null;
      const backup = ability && this.rules.abilityOwner ? `${CAST[this.rules.abilityOwner].name}: ${ability.name}\n${isTouch() ? 'Tap the meter' : 'Space'} when Flair is full` : '';
      const ally = this.crew && this.crew.ally !== 'berry' ? this.crew.ally : null;
      const player = ally ? { name: CAST[ally].name, texture: characterSheet(this, ally).texture, color: CAST[ally].css } : undefined;
      // In the crew battle the ally fires their own ability, so the line under them says how.
      const label = ally && ability ? `${ability.name}, once this round\n${isTouch() ? 'Tap the meter' : 'Space'} when Flair is full` : backup;
      this.versus = new VersusCard(this, this.rivalName, texture, look, label, player);
      playSfx(this.game, 'banner');
    }
    this.hypeAudio?.setCrowd(true);
    this.showSongCredit();
    if (!this.playData.autoplay) {
      if (isTouch()) this.showTouchHint();
      else this.showKeyHints();
    }
    this.state = 'playing';
  }

  /**
   * Title and artist, shown above the countdown once the versus card has
   * cleared. It is gone before the first turn label and round call-out need the space.
   */
  private showSongCredit(): void {
    const { title, artist } = this.chart;
    // High up, clear of the countdown that runs at the same time.
    const name = addText(this, GAME_W / 2, 196, title, 28, { color: CSS.lilac }).setDepth(Depth.overlay);
    const by = addBody(this, GAME_W / 2, 228, artist, 20, { stroke: true }).setDepth(Depth.overlay);
    const lines = [name, by];
    if (this.introTime > 0) {
      lines.forEach((line) => line.setAlpha(0));
      this.tweens.add({ targets: lines, alpha: 1, delay: this.introTime * 1000, duration: 200 });
    }
    this.tweens.add({ targets: lines, alpha: 0, delay: 1500 + this.introTime * 1000, duration: 300, onComplete: () => lines.forEach((line) => line.destroy()) });
  }

  private showLoadError(message: string): void {
    if (!this.sys.isActive()) return;
    this.dialogue?.destroy();
    this.dialogue = null;
    this.introDone = true;
    this.hideLoading();
    this.pauseButton.setVisible(false);
    addBox(this, GAME_W / 2 - 400, 250, 800, 320, 'panel').setDepth(Depth.overlay);
    this.countText.setText('Song unavailable').setFontSize(48).setY(316).setDepth(Depth.overlay + 1);
    addBody(this, GAME_W / 2, 406, message, 24, { wrapWidth: 700 }).setDepth(Depth.overlay + 1);
    const back = addUiButton(this, GAME_W / 2, 502, 'Back', () => this.quit(), { width: 200, icon: 'icon_back', sfx: 'back' }).setDepth(Depth.overlay + 1);
    back.setFocused(true);
    menuKeys(this, { confirm: () => back.click() });
  }

  // ---------------------------------------------------------------------
  // Conversations before and after a story stage
  // ---------------------------------------------------------------------

  /** Run a conversation over the stage, lighting whoever is speaking. */
  private startDialogue(lines: readonly Line[], onDone: () => void, hoodDown = false): void {
    const onStage = this.crew ? this.chart.rivalCharacter : (battleForChart(this.chart.id)?.opponent ?? this.story?.stop.fruit);
    const playerWho = this.crew?.ally ?? 'berry';
    this.dialogue = new Dialogue(this, {
      lines,
      hoodDown,
      depth: Depth.overlay + 6,
      onLine: (line) => {
        // Berry and the stop's fruit are on stage. Anyone else speaks from the wings.
        const side = line.who === playerWho ? 'player' : this.rival && line.who === onStage ? 'rival' : null;
        this.stage.setTurn(side ?? 'both');
        this.player.sprite.setTint(side === 'player' ? 0xffffff : LISTENER_TINT);
        this.rival?.sprite.setTint(side === 'rival' ? 0xffffff : LISTENER_TINT);
      },
      onDone: () => {
        this.dialogue = null;
        this.player.sprite.clearTint();
        this.rival?.sprite.clearTint();
        onDone();
      },
    });
    // A conversation that starts while the pause menu is open waits behind it.
    if (this.menuOnly) this.dialogue.setSuspended(true);
  }

  private pauseGame(): void {
    if (!this.conductor) return;
    if (this.state === 'resuming') {
      // Interrupted during the 3-2-1 (tab hidden, window blurred, phone rotated): stay paused.
      this.state = 'paused';
      this.countText.setText('');
      this.tweens.pauseAll();
      this.pauseLayer.setVisible(true);
      this.playPauseMusic();
      return;
    }
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.conductor.pause();
    this.hypeAudio?.silence();
    if (this.laneInput) this.laneInput.enabled = false;
    this.touchLanes?.setGuideVisible(false);
    this.tweens.pauseAll();
    this.pauseFocus.focus(0, true);
    this.pauseLayer.setVisible(true);
    this.playPauseMusic();
    playSfx(this.game, 'pauseOpen');
  }

  /** One stage dances to the pause screen's own track; pausing there plays another. */
  private playPauseMusic(): void {
    music.play(pauseSongFor(this.chart.song), 400);
  }

  /**
   * Every way of asking to stop comes here: the pause button, P, the back
   * gesture and the touch gestures. In a song it pauses; anywhere else (a
   * conversation, loading, the lines after a song) it opens the same menu over
   * what is on screen, so Exit is always one tap away.
   */
  private openPause(): void {
    if (isLeaving(this)) return;
    if (this.state === 'playing' || this.state === 'resuming') {
      this.pauseGame();
      return;
    }
    if (this.state === 'paused' || this.menuOnly) return;
    this.menuOnly = true;
    this.dialogue?.setSuspended(true);
    this.pauseFocus.focus(0, true);
    this.pauseLayer.setVisible(true);
    playSfx(this.game, 'pauseOpen');
  }

  private closeMenuOnly(): void {
    if (!this.menuOnly) return;
    this.menuOnly = false;
    this.pauseLayer.setVisible(false);
    playSfx(this.game, 'pauseClose');
    this.dialogue?.setSuspended(false);
    const buffer = this.pendingBuffer;
    this.pendingBuffer = null;
    if (buffer) this.begin(buffer);
  }

  /** True while the pause menu is on screen, over a paused song or over anything else. */
  private pauseOpen(): boolean {
    return this.state === 'paused' || this.menuOnly;
  }

  private resumeGame(): void {
    if (this.menuOnly) {
      this.closeMenuOnly();
      return;
    }
    if (this.state !== 'paused' || isRotateNoticeShown()) return;
    this.state = 'resuming';
    this.pauseLayer.setVisible(false);
    playSfx(this.game, 'pauseClose');
    this.tweens.resumeAll();
    music.stop(200);
    const steps = ['3', '2', '1'];
    steps.forEach((label, i) => {
      this.time.delayedCall(i * 450, () => {
        if (this.state !== 'resuming') return;
        this.countText.setText(label).setAlpha(1).setScale(1);
        playSfx(this.game, 'count');
      });
    });
    this.time.delayedCall(steps.length * 450, () => {
      if (this.state !== 'resuming') return;
      this.countText.setText('');
      if (this.laneInput) this.laneInput.enabled = true;
      this.touchLanes?.setGuideVisible(true);
      this.conductor?.resume();
      this.hypeAudio?.setCrowd(true);
      this.state = 'playing';
      this.dropUnheldHolds();
    });
  }

  /** Holds whose key or finger was let go while the game was paused do not finish themselves. */
  private dropUnheldHolds(): void {
    if (this.playData.autoplay) return;
    const time = this.heardTime();
    for (const lane of [0, 1, 2, 3] as Lane[]) {
      const down = this.laneInput?.isDown(lane) || this.touchLanes?.isDown(lane);
      if (this.engine.heldNote(lane) && !down) this.handleEvents(this.engine.release(lane, time));
    }
  }

  /** Play the next segment of the story, or go back to the train if this was the last. */
  private continueStory(): void {
    const ref = this.playData.story;
    const next = ref ? nextRef(ref) : null;
    if (!next) {
      this.quit();
      return;
    }
    playSegment(this, next, { autoplay: this.playData.autoplay }).catch(() => this.quit());
  }

  /** Straight back into a lost battle, without its opening conversation. */
  private rematch(): void {
    if (isLeaving(this)) return;
    this.restart();
  }

  private restart(): void {
    // The player has just seen this stage's opening: go straight back into the song.
    skipNextIntro();
    music.stop(200);
    goTo(this, SceneKeys.Play, this.playData);
  }

  private quit(): void {
    music.stop(200);
    if (this.playData.scripted) {
      finishPrologue(this, this.playData.scripted.flow, 250);
      return;
    }
    // Leaving a crew round gives up the battle; the order is kept for the next try.
    if (this.crew) endSession();
    goTo(this, this.playData.returnTo.scene, this.playData.returnTo.data);
  }

  private finish(failed: boolean): void {
    // The prologue never ends on a result: it freezes and cuts to static.
    if (this.director) {
      if (!this.frozen) this.freezeFrame();
      return;
    }
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.touchLanes?.setGuideVisible(false);
    if (this.laneInput) this.laneInput.enabled = false;

    let summary: BattleSummary | undefined;
    if (this.battle && this.rivalEngine) {
      // Running out of health hands her the battle whatever the rounds so far say.
      const result = this.battle.result(failed ? this.roundsSettled : undefined);
      if (!failed) for (let i = this.roundsSettled; i < this.battle.rounds.length; i++) this.hud.setRound(i, this.battle.roundWinner(i));
      summary = {
        rivalName: this.rivalName,
        rivalTexture: rivalTexture(this, this.chart.rivalCharacter ?? 'raspberry') ?? Tex.raspberry,
        playerRounds: result.playerRounds,
        rivalRounds: result.rivalRounds,
        rivalAccuracy: result.rivalAccuracy,
        rivalScore: this.rivalEngine.stats.score,
        won: result.won && !failed,
      };
    }
    this.effects?.finish();
    this.hype?.finish();
    // The turn label and any queued call-outs belong to the song, not to what follows it.
    this.hud.endOfSong();
    const results: FlairResults = { play: { ...this.playData, autoplay: this.autoUsed || this.playData.autoplay }, stats: this.engine.stats, failed, battle: summary };
    if (this.effects && this.rules.ability) {
      results.flairUsed = this.effects.flairUsed;
      results.abilityName = ABILITIES[this.rules.ability].name;
    }
    if (this.errorCount >= MIN_ERROR_SAMPLES) results.meanErrorMs = (this.errorSum / this.errorCount) * 1000;

    const playerOnTop = !failed && (summary?.won ?? true);
    this.camera?.setTurn(playerOnTop ? 'player' : 'rival');
    this.camera?.wide(1.2);
    // The stop's duo closes the song, then the final poses (straight away after a fail).
    const settle = () => {
      this.player.finish(playerOnTop);
      this.rival?.finish(!playerOnTop);
    };
    if (failed || !this.duo?.outro(playerOnTop, settle, (ms, callback) => this.time.delayedCall(ms, callback))) settle();
    this.stage.setTurn(playerOnTop ? 'player' : 'rival');
    const toResults = () => goTo(this, SceneKeys.Results, results, 400);
    let outro: readonly Line[] = [];
    let after = toResults;
    let hoodDown = false;
    const segment = this.story?.segment;
    const crew = this.crew;
    if (crew) {
      ({ outro, after, hoodDown } = this.settleCrewRound(failed, playerOnTop));
    } else if (this.story && segment?.kind === 'lesson') {
      // The lesson flows straight into the rest of the stop.
      outro = segment.after;
      after = () => this.continueStory();
    } else if (this.story && segment?.kind === 'battle') {
      // The story only moves on after a won battle. A loss earns a line of banter and a rematch.
      // A chart without rival notes has no battle to win: getting through it is enough.
      if (playerOnTop && (summary ? summary.won : true)) {
        // Each of the stop's three battles ends on its results; the next one is offered there.
        markBattleWon(segment.battle);
        outro = segment.win;
        hoodDown = segment.hoodDown;
        after = toResults;
      } else {
        outro = segment.lose;
        after = () => this.rematch();
      }
    }
    const wrapUp = () => {
      if (outro.length === 0 || isLeaving(this)) after();
      else {
        this.countText.setText('');
        this.startDialogue(outro, after, hoodDown);
      }
    };
    if (failed) {
      this.conductor?.pause();
      this.cheer({ kind: 'fail' }, 'fail');
      if (!getSettings().reduceMotion) this.cameras.main.shake(350, 0.008);
      this.camera?.shake(12);
      this.countText.setText('Failed').setColor(CSS.miss).setAlpha(1).setScale(1);
      this.time.delayedCall(1300, wrapUp);
    } else {
      if (summary) {
        this.cheer(summary.won ? { kind: 'battleWon' } : { kind: 'battleLost' }, summary.won ? 'cheer' : 'round');
        const yours = this.crew && this.crew.ally !== 'berry' ? `${CAST[this.crew.ally].name} takes it!` : 'You win!';
        this.hud.callout(summary.won ? yours : `${this.rivalName} wins!`, summary.won ? CSS.blue : this.rivalLook.css);
        this.stage.flash(summary.won ? COLORS.blue : this.rivalLook.color, 0.3);
        if (summary.won) this.stage.cheer();
      }
      this.time.delayedCall(summary ? 1900 : 1400, wrapUp);
    }
  }

  /** Record a crew round, carry the bar forward, and say what comes next. */
  private settleCrewRound(failed: boolean, won: boolean): { outro: readonly Line[]; after: () => void; hoodDown: boolean } {
    const final = stopById('stop12');
    const set = getSession()?.set ?? 0;
    const script = final?.script.battles[set];
    const battle = this.battle;
    const result: RoundResult = {
      playerAccuracy: battle?.accuracy('player') ?? 0,
      rivalAccuracy: battle?.accuracy('rival') ?? 0,
      playerScore: this.engine.stats.score,
      won: won && !failed,
    };
    const toLineup = (data: object) => goTo(this, SceneKeys.Lineup, { ...data, autoplay: this.playData.autoplay }, 400);
    const lose = { outro: script?.lose ?? [], after: () => { endSession(); toLineup({ lost: true, set }); }, hoodDown: false };
    // An empty bar loses the set, whatever the points say.
    if (failed) return lose;
    recordRound(result, this.engine.stats.health);
    const session = getSession();
    // The crew battle is danced in three sets (story/crewBattle.ts): a lost set is danced again.
    const state = setVerdict();
    if (state === 'lost') return lose;
    if (state === 'won' && final && set < 2) {
      markBattleWon(final.battles[set]);
      checkpointSession();
      return { outro: script?.win ?? [], after: () => { endSession(); toLineup({ setWon: set }); }, hoodDown: false };
    }
    if (state === 'won') {
      if (final) markBattleWon(final.battles[2]);
      checkpointSession();
      markSeen('ending');
      const results = session?.results.slice() ?? [];
      const order = session?.order.slice() ?? [];
      return { outro: script?.win ?? [], after: () => { endSession(); goTo(this, SceneKeys.CrewEnd, { results, order }, 600); }, hoodDown: true };
    }
    return { outro: [], after: () => toLineup({ between: true }), hoodDown: false };
  }

  private cleanup(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    this.laneInput?.destroy();
    this.laneInput = null;
    this.touchLanes?.destroy();
    this.touchLanes = null;
    this.stopRotateWatch?.();
    this.conductor?.destroy();
    this.conductor = null;
    this.hitLayer = null;
    this.hypeAudio?.silence();
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.pauseGame();
  };

  private readonly onBlur = (): void => this.pauseGame();

  /** Explains the touch controls until the song starts. */
  private showTouchHint(): void {
    const backing = addBox(this, GAME_W / 2 - 380, 530, 760, 140, 'panel').setDepth(Depth.hud);
    const text = `${SCHEME_INFO[getSettings().touchScheme].hint}\nDouble-tap the top edge to pause`;
    const hint = addBody(this, GAME_W / 2, 600, text, 24, { color: CSS.yellow }).setDepth(Depth.hud);
    this.tweens.add({
      targets: [backing, hint],
      alpha: 0,
      delay: 4200 + this.introTime * 1000,
      duration: 500,
      onComplete: () => {
        backing.destroy();
        hint.destroy();
      },
    });
  }

  /** Labels above the receptors showing which keys play each lane, shown until the song starts. */
  private showKeyHints(): void {
    const keys = getSettings().keys;
    const hints = PLAYER_LANES.map((x, lane) => {
      // Arrow keys are obvious from the receptor shapes, so prefer showing a letter binding.
      const labels = keys[lane].map(keyLabel);
      const label = labels.find((l) => l.length === 1) ?? labels[0];
      return addText(this, x, RECEPTOR_Y - 84, label, label.length === 1 ? 32 : 16, { color: CSS.yellow }).setDepth(Depth.hud);
    });
    this.tweens.add({ targets: hints, alpha: 0, delay: 4200 + this.introTime * 1000, duration: 500, onComplete: () => hints.forEach((h) => h.destroy()) });
  }

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------

  /** Song time as the player hears it, in seconds. */
  private heardTime(): number {
    const c = this.conductor;
    return c ? c.time - c.outputLatency - this.offsetSec : this.origin - LEAD_IN;
  }

  /** Song time at which an input event happened, given its performance.now() timestamp. */
  private eventTime(timeMs: number): number {
    const age = Math.max(0, Math.min(100, performance.now() - timeMs)) / 1000;
    return this.heardTime() - age;
  }

  private setupInput(): void {
    // Built even under autoplay, so auto-hit can be switched off from the pause menu.
    {
      this.laneInput = new LaneInput({
        down: (lane, timeMs) => this.laneDown(lane, timeMs),
        up: (lane, timeMs) => this.laneUp(lane, timeMs),
      });

      // Touch and mouse: the scheme chosen in Options (columns, bottom pads, thumb pads or swipes).
      const settings = getSettings();
      this.touchLanes = new TouchLanes(
        { down: (lane, timeMs) => this.laneDown(lane, timeMs), up: (lane, timeMs) => this.laneUp(lane, timeMs) },
        (event) => this.state !== 'playing' || this.isOverPauseButton(event) || this.isOverFlair(event),
        { scheme: settings.touchScheme, alwaysShowGuide: settings.touchGuides, onPause: () => this.openPause() },
      );
    }
    this.stopRotateWatch = onRotateNoticeChange((shown) => shown && this.pauseGame());

    menuKeys(this, {
      left: () => this.state === 'paused' && this.backupButton !== null && this.pauseFocus.index === 1 && this.swapBackup(-1),
      right: () => this.state === 'paused' && this.backupButton !== null && this.pauseFocus.index === 1 && this.swapBackup(1),
      up: () => this.pauseOpen() && this.pauseFocus.move(-1),
      down: () => this.pauseOpen() && this.pauseFocus.move(1),
      confirm: () => this.pauseOpen() && this.pauseFocus.activate(),
      back: () => {
        if (this.menuOnly) {
          this.closeMenuOnly();
          return;
        }
        // A conversation reads Esc itself (skip); that press must not also pause or leave.
        if (this.dialogue?.busy) return;
        if (this.state === 'playing') this.pauseGame();
        else if (this.state === 'paused') this.resumeGame();
        else if (this.state === 'loading') this.quit();
      },
    });
    this.input.keyboard?.on('keydown-P', () => {
      if (!this.pauseOpen()) this.openPause();
    });
    // The browser's or phone's back gesture: the first opens the pause menu, a second one leaves.
    onBackGesture(this, () => {
      if (this.pauseOpen()) this.quit();
      else this.openPause();
    });
    // Space fires the backup's ability, unless the player has given Space to a lane.
    const spaceIsLane = getSettings().keys.some((codes) => codes.includes('Space'));
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.state === 'playing' && !spaceIsLane && !this.playData.autoplay) this.effects?.fire(this.heardTime());
    });
  }

  /** A browser pointer event's position on the canvas, in game pixels. */
  private canvasPoint(event: PointerEvent): { x: number; y: number } {
    const canvas = this.game.canvas.getBoundingClientRect();
    return { x: ((event.clientX - canvas.left) / canvas.width) * GAME_W, y: ((event.clientY - canvas.top) / canvas.height) * this.scale.height };
  }

  /** True if a browser pointer event landed on the pause button, which handles its own taps. */
  private isOverPauseButton(event: PointerEvent): boolean {
    const { x, y } = this.canvasPoint(event);
    return this.pauseButton.getBounds().contains(x, y);
  }

  /** True if a pointer event landed on the Flair meter, which fires the ability itself. */
  private isOverFlair(event: PointerEvent): boolean {
    if (!this.effects) return false;
    const { x, y } = this.canvasPoint(event);
    return this.effects.isOverWidget(x, y);
  }

  private laneDown(lane: Lane, timeMs: number): void {
    if (this.state !== 'playing' || this.playData.autoplay) return;
    this.playerField.setPressed(lane, true);
    const held = ([0, 1, 2, 3] as Lane[]).filter((l) => l !== lane && (this.laneInput?.isDown(l) || this.touchLanes?.isDown(l)));
    this.player.dance(lane, held);
    this.handleEvents(this.engine.press(lane, this.eventTime(timeMs)));
  }

  private laneUp(lane: Lane, timeMs: number): void {
    if (this.playData.autoplay) return;
    this.playerField.setPressed(lane, false);
    if (this.state !== 'playing') return;
    this.handleEvents(this.engine.release(lane, this.eventTime(timeMs)));
  }

  private handleEvents(events: JudgeEvent[]): void {
    for (const event of events) {
      const { judgement, note, part } = event;
      const hyped = !!this.hype?.active;
      this.battle?.record('player', note.t, judgement);
      this.flawless?.record(note.t, judgement);
      this.effects?.record(event);
      this.hype?.record(event);
      if (judgement === 'miss') {
        // A missed hold reports its head and tail together: show it once.
        if (part === 'holdEnd' && note.state === 'missed') continue;
        if (event.absorbed) {
          // Rind took it: no stumble, the combo lives on.
          this.hud.callout('Rind!', CSS.perfect);
          this.playerField.hitFx(note.lane, 0.3);
          playSfx(this.game, 'remove');
          continue;
        }
        // A miss that ends hype already spins the record back (a slip in hype's first beats does not end it).
        this.reactToMiss(note.t, hyped && !this.hype?.active);
        this.hitLayer?.miss(Math.max(note.t, this.heardTime()));
        this.nextMilestone = COMBO_MILESTONES[0];
        continue;
      }
      this.lastCombo = this.engine.stats.combo;
      this.player.landed();
      if (part !== 'holdEnd') this.hitLayer?.hit('player', note.t, note.end);
      if (part !== 'holdEnd') this.perfectRun = judgement === 'perfect' ? this.perfectRun + 1 : 0;
      const burst = this.perfectRun >= PERFECT_RUN && judgement === 'perfect' && !getSettings().reduceMotion;
      this.hud.showJudgement(judgement, this.engine.stats.combo, this.perfectRun);
      this.playerField.hitFx(note.lane, judgement === 'perfect' ? 1 : judgement === 'good' ? 0.6 : 0.3, burst);
      if (part !== 'holdEnd' && this.playerEnds.has(note.id)) this.camera?.punch(PHRASE_PUNCH);
      if (part !== 'holdEnd') {
        if (getSettings().hitSounds) playSfx(this.game, judgement);
        if (!this.playData.autoplay) {
          this.hud.showError(event.delta, judgement);
          this.errorSum += event.delta;
          this.errorCount++;
        }
      }
      const combo = this.engine.stats.combo;
      if (combo >= this.nextMilestone) {
        // The milestone shows in the dancer's showpiece and the combo count by the lanes, not a centre call-out.
        this.player.special();
        this.stage.flash(COLORS.yellow, 0.22);
        this.stage.punch(MILESTONE_PUNCH);
        this.hud.kick(0.8);
        this.cheer({ kind: 'combo', combo }, 'combo');
        const index = COMBO_MILESTONES.indexOf(this.nextMilestone);
        this.nextMilestone = index >= 0 && index < COMBO_MILESTONES.length - 1 ? COMBO_MILESTONES[index + 1] : this.nextMilestone + 50;
      }
    }
  }

  /**
   * A miss lands: Berry is knocked back, the stage camera shakes, the edges
   * flush red, the song is muffled and dips, and in a battle the DJ scrubs the
   * record, the crowd groans and now and then the MC has something to say.
   * A broken streak gets all of it, harder; MissReactor sizes it. Nothing here
   * touches the song's clock or the timing of the next notes.
   */
  private reactToMiss(time: number, endedHype: boolean): void {
    if (this.director) {
      // The prologue: a miss flashes and makes its sound, and the routine carries on.
      this.lastCombo = 0;
      this.perfectRun = 0;
      this.hud.showJudgement('miss', 0, 0, 0);
      this.player.flash();
      playSfx(this.game, 'miss');
      if (this.engine.stats.health < START_HEALTH) this.engine.adjustHealth(START_HEALTH - this.engine.stats.health);
      return;
    }
    const lost = this.lastCombo;
    this.lastCombo = 0;
    this.perfectRun = 0;
    const reaction = this.missReactor.react(time, lost);
    const force = reaction.tier === 'stray' ? 0.35 : reaction.tier === 'break' ? 0.7 : 1;
    this.hud.showJudgement('miss', 0, 0, lost);
    // A lone miss only flashes Berry red and he dances on; misses in a row knock him back (Dancer.miss).
    this.player.miss(force, -1);
    this.camera?.shake(reaction.shake);
    this.stage.missSting(force);
    this.conductor?.muffle(reaction.muffle);
    playSfx(this.game, 'miss');
    if (this.hypeAudio) {
      const { scratch, crowd, line, duck, duckLength } = reaction;
      this.hypeAudio.event({ kind: 'miss', scratch: scratch && !endedHype, crowd, line, duck, duckLength });
    }
    if (reaction.tier !== 'stray') this.rival?.getReady('boast', 0.4);
  }

  /** The song drops: a flash, a punch, the HUD kicks and the crowd jumps. */
  private drop(): void {
    this.stage.flash(0xffffff, 0.24);
    this.stage.punch(DROP_PUNCH);
    this.stage.cheer();
    this.hud.kick(1);
    if (this.hypeAudio) this.hypeAudio.event({ kind: 'drop' });
  }

  /** Battle hype: the MC, crowd and stingers. Outside a battle only `fallback` plays. */
  private cheer(event: HypeEvent, fallback?: SfxName): void {
    if (this.hypeAudio) this.hypeAudio.event(event);
    else if (fallback) playSfx(this.game, fallback);
  }

  /** Flair and abilities report through the hype mixer; their other sounds play as they are. */
  private effectSfx(name: SfxName): void {
    const ability = this.rules.ability;
    if (name === 'flair') this.cheer({ kind: 'flairFull' }, 'flair');
    else if (name === 'ability' && ability) this.cheer({ kind: 'ability', ability }, 'ability');
    else playSfx(this.game, name);
  }

  /** Hype mode's riser and cheer become one hype cue; a miss (combo back to 0) ends it with a tape stop. */
  private hypeModeSfx(name: SfxName): void {
    if (name === 'hype') this.cheer({ kind: 'hypeStart' }, 'hype');
    else if (name === 'hypeOut') this.cheer({ kind: 'hypeEnd', broken: this.engine.stats.combo === 0 }, 'hypeOut');
    else if (!this.hypeAudio) playSfx(this.game, name);
  }

  private handleRivalEvents(events: JudgeEvent[]): void {
    const field = this.rivalField;
    for (const event of events) {
      const { judgement, note, part } = event;
      if (this.battle) {
        this.battle.record('rival', note.t, judgement);
        this.engine.adjustHealth(RIVAL_PULL[judgement]);
      }
      if (judgement === 'miss') {
        if (part !== 'holdEnd' || note.state !== 'missed') this.rival?.miss(0.3, 1);
        continue;
      }
      if (part !== 'holdEnd' && this.rivalEnds.has(note.id)) this.camera?.punch(PHRASE_PUNCH * 0.8);
      if (part === 'holdEnd') {
        field?.setPressed(note.lane, false);
        continue;
      }
      this.hitLayer?.hit('rival', note.t, note.end);
      this.rival?.landed();
      field?.hitFx(note.lane, 0.5);
      field?.setPressed(note.lane, true);
      this.rival?.dance(note.lane);
      if (part === 'tap') this.time.delayedCall(90, () => !this.rivalEngine?.heldNote(note.lane) && field?.setPressed(note.lane, false));
    }
  }

  // ---------------------------------------------------------------------
  // Battle: turns, rounds and bonuses
  // ---------------------------------------------------------------------

  private updateBattle(time: number): void {
    while (this.turnIndex < this.turns.length && time >= this.turns[this.turnIndex].start - TURN_LEAD) {
      const { turn } = this.turns[this.turnIndex++];
      if (turn !== 'rest' && turn !== this.currentTurn) this.setTurn(turn);
    }

    const flawless = this.flawless?.collect(time) ?? 0;
    if (flawless > 0) {
      this.engine.addBonus(FLAWLESS_BONUS * flawless);
      this.engine.adjustHealth(FLAWLESS_PUSH * flawless);
      this.hud.callout('Flawless!', CSS.perfect);
      this.stage.flash(COLORS.perfect, 0.2);
      this.cheer({ kind: 'flawless' }, 'bonus');
    }

    const battle = this.battle;
    if (!battle || battle.rounds.length < 2) return;
    if (!this.roundAnnounced && time >= battle.rounds[0].start - COUNT_STEP) {
      this.roundAnnounced = true;
      this.hud.callout('Round 1', CSS.cream);
      if (!this.crew) this.cheer({ kind: 'roundIntro', round: 0, total: battle.rounds.length });
    }
    while (this.roundsSettled < battle.rounds.length && time >= battle.rounds[this.roundsSettled].end + ROUND_SETTLE) {
      this.settleRound(this.roundsSettled++, battle);
    }
  }

  private setTurn(turn: Exclude<Turn, 'rest'>): void {
    this.currentTurn = turn;
    const labels = TURN_LABELS[this.battle ? 'battle' : 'lesson'];
    const label = this.director ? SCRIPTED_TURNS[turn] : turn === 'rival' && this.battle ? `${this.rivalName}${labels.rival}` : labels[turn];
    this.hud.setTurn(label, turn === 'rival' ? this.rivalLook.css : TURN_COLORS[turn]);
    this.stage.setTurn(turn);
    this.camera?.setTurn(turn);
    this.playerField.setDimmed(turn === 'rival');
    this.rivalField?.setDimmed(turn === 'player');
    if (turn === 'both') playSfx(this.game, 'banner');
  }

  private settleRound(index: number, battle: Battle): void {
    const winner: Side = battle.roundWinner(index);
    const mine = winner === 'player';
    this.hud.setRound(index, winner);
    this.hud.callout(mine ? 'Round to you!' : `Round to ${this.rivalName}`, mine ? CSS.blue : this.rivalLook.css);
    if (index + 1 < battle.rounds.length) {
      this.hud.callout(`Round ${index + 2}`, CSS.cream);
      // After the round's sting, so the MC is heard on its own.
      if (!this.crew) this.time.delayedCall(900, () => this.state === 'playing' && this.cheer({ kind: 'roundIntro', round: index + 1, total: battle.rounds.length }));
    }
    this.stage.flash(mine ? COLORS.blue : this.rivalLook.color, 0.28);
    this.cheer(mine ? { kind: 'roundWon' } : { kind: 'roundLost' }, 'round');
    // The camera pulls back to take in both of them, with a kick.
    this.camera?.wide(ROUND_WIDE);
    this.hud.kick(0.9);
    if (mine) {
      this.player.special();
      this.rival?.stumble(0.5, 1);
      this.stage.cheer();
      this.stage.punch(ROUND_PUNCH * 1.3);
      if (!this.hypeAudio) playSfx(this.game, 'cheer');
    } else {
      this.rival?.special();
      this.player.stumble(0.5, -1);
      this.stage.punch(ROUND_PUNCH);
    }
  }

  // ---------------------------------------------------------------------
  // Frame update
  // ---------------------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
    const conductor = this.conductor;
    const dt = deltaMs / 1000;
    this.skipRing?.update(dt);
    if (this.frozen) {
      // The freeze frame: only the tape counter and the static move.
      this.director?.update(0, 0, dt);
      this.staticScreen?.update(dt);
      return;
    }
    if (!conductor || this.state === 'loading') {
      // No music yet: the dancers idle and the lights follow the conversation.
      this.idleClock += dt;
      const idleBeat = (this.idleClock * IDLE_BPM) / 60;
      this.player.update(dt, idleBeat);
      this.rival?.update(dt, idleBeat);
      this.stage.update(idleBeat, dt);
      // No beat bumps over a conversation: the camera only settles.
      this.camera?.update(-1, dt, 0);
      return;
    }
    const time = this.heardTime();
    const beat = secToBeat(this.chart, time);

    if (this.state === 'playing') {
      this.updateCountdown(conductor.time);
      this.effects?.update(time, dt);
      if (this.playData.autoplay) this.autoplay(time);
      this.handleEvents(this.engine.update(time));
      if (this.rivalDriver) this.handleRivalEvents(this.rivalDriver.step(time));
      this.hitLayer?.update(time);
      this.updateBattle(time);
      this.director?.update(time, beat, dt);
      if (this.frozen) return;
      this.duo?.update(beat);
      const drops = this.shape.drops;
      while (this.dropIndex < drops.length && beat >= drops[this.dropIndex]) {
        // A drop already passed (a seek, a long frame) goes by quietly.
        if (beat < drops[this.dropIndex] + 1) this.drop();
        this.dropIndex++;
      }

      const crew = this.crew;
      const fade = crew && time > crew.end - ROUND_FADE ? Phaser.Math.Clamp((crew.end + 0.4 - time) / ROUND_FADE, 0, 1) : 1;
      const hype = this.hypeAudio;
      if (hype) hype.update(this.engine.stats.combo, this.engine.stats.health);
      // The song dips a little under the biggest hype moments.
      const duck = hype?.duck() ?? 1;
      if (fade < 1 || duck < 1 || this.ducked) conductor.setVolume(getSettings().musicVolume * fade * duck);
      this.ducked = duck < 1;
      if (this.engine.stats.failed) {
        this.finish(true);
      } else if (crew && time >= crew.end + 0.4) {
        this.finish(false);
      } else if (conductor.ended) {
        this.finish(false);
      } else if (time > this.lastNoteEnd + 4 && conductor.duration - time > 6) {
        // Nothing left to play and a long tail remains: wrap up early.
        conductor.setVolume(0);
        this.finish(false);
      }
    }

    this.playerField.update(time, this.speed);
    this.rivalField?.update(time, this.speed);
    if (this.state !== 'paused') {
      if (this.state === 'playing') {
        this.player.setHolding(([0, 1, 2, 3] as Lane[]).some((lane) => this.engine.heldNote(lane) !== null));
        this.player.setHype(this.engine.stats.multiplier >= 4 || !!this.hype?.active);
        this.player.setGrooving(time >= 0);
        this.rival?.setGrooving(time >= 0);
        const rivalEngine = this.rivalEngine;
        this.rival?.setHolding(!!rivalEngine && ([0, 1, 2, 3] as Lane[]).some((lane) => rivalEngine.heldNote(lane) !== null));
      }
      this.player.update(dt, beat);
      this.rival?.update(dt, beat);
      this.stage.update(beat, dt);
      this.hype?.update(time, dt, this.speed, this.state === 'playing');
      this.camera?.update(this.state === 'playing' ? beat : -1, dt, this.hype?.tiltAmount ?? 0);
      const progress = this.crew ? (time - this.crew.start) / (this.crew.end - this.crew.start) : time / conductor.duration;
      this.hud.update(this.engine.stats, this.battle ? (this.rivalEngine?.stats ?? null) : null, { time, beat, progress: Phaser.Math.Clamp(progress, 0, 1), effects: this.effectList(time) }, dt);
      this.playerField.setOutline(this.state === 'playing' && this.effects?.steadyOn(time) ? COLORS.yellow : null);
    }
  }

  /** The effect chips for the HUD right now: the ability running, then hype. Gimmicks are telegraphed on the field. */
  private effectList(time: number): ReturnType<typeof effectChips> {
    if (this.state !== 'playing') return [];
    return effectChips({
      ability: this.effects?.abilityStatus(time) ?? null,
      hype: this.hype?.active ? this.hype.status() : null,
    });
  }

  private updateCountdown(rawTime: number): void {
    if (this.versus && !this.versus.update(rawTime - this.origin + LEAD_IN + this.introTime)) this.versus = null;
    this.countdown?.update(rawTime);
  }

  /**
   * The 3-2-1 over the lead-in before `start`, on the song's beats. It ends by
   * the first note and never holds the song up (see Countdown).
   */
  private startCountdown(start: number, leadIn: number): void {
    const notes = [...this.engine.notes, ...(this.rivalEngine?.notes ?? [])].map((n) => n.t).filter((t) => t >= start - 1e-6);
    const firstNote = notes.reduce((first, t) => Math.min(first, t), Infinity);
    const plan = planCountdown(this.chart.bpm, this.chart.offset, start - leadIn, start, firstNote);
    this.countAudio = this.hypeAudio ?? new HypeAudio(this.game);
    // The MC calls the numbers unless he is calling a crew round; "Let's dance!" only when no rounds are called.
    const say = !this.crew;
    const letsDance = !this.crew && (this.battle?.rounds.length ?? 0) < 2;
    this.countdown = new Countdown(this, plan, {
      calm: getSettings().reduceMotion,
      onCall: (index) => {
        if (index === 0 && this.crew) this.cheer({ kind: 'roundIntro', round: this.crew.round, total: CREW_ROUNDS.length });
        this.countAudio?.count(index as CountCall, say, letsDance);
        if (index === 0) this.player.getReady('hood');
        if (index === 1) this.rival?.getReady('boast');
      },
    });
  }

  /** The development `?miss=` flag: true for a note autoplay should let go. */
  private autoDrops(id: number): boolean {
    const skip = this.playData.autoMiss;
    if (skip === undefined) return false;
    if (Array.isArray(skip)) return skip.includes(id);
    return skip > 1 && id % skip === skip - 1;
  }

  /** Plays every note perfectly (and fires the Flair when full). Used for demos and automated tests. */
  private autoplay(time: number): void {
    if (this.effects?.ready && this.effects.goodMoment(time)) this.effects.fire(time);
    for (const lane of [0, 1, 2, 3] as Lane[]) {
      const held = this.autoHeld[lane];
      if (held && held.state !== 'holding') {
        this.autoHeld[lane] = null;
        this.playerField.setPressed(lane, false);
      }
      const next = this.engine.peek(lane);
      // Development only (?miss=): let some notes go by, to show the miss reactions.
      if (next && this.autoDrops(next.id)) continue;
      if (next && next.state === 'pending' && next.t <= time) {
        this.playerField.setPressed(lane, true);
        this.player.dance(lane);
        this.handleEvents(this.engine.press(lane, next.t));
        if (next.isHold) this.autoHeld[lane] = next;
        else this.time.delayedCall(90, () => !this.autoHeld[lane] && this.playerField.setPressed(lane, false));
      }
    }
  }

  // ---------------------------------------------------------------------
  // The prologue's scripted battle
  // ---------------------------------------------------------------------

  private startScripted(scripted: ScriptedPlay): void {
    const calm = getSettings().reduceMotion;
    this.hype?.setScripted();
    const fieldLeft = PLAYER_LANES[0] - 60;
    const fieldWidth = PLAYER_LANES[3] - PLAYER_LANES[0] + 120;
    this.director = new ScriptedDirector(this, scripted, this.chart, {
      hype: (on) => this.hype?.force(on),
      duel: (value) => this.hud.setScriptedDuel(value),
      callout: (text, color) => this.hud.callout(text, color),
      flash: (color, alpha) => this.stage.flash(color, alpha),
      sfx: (name) => playSfx(this.game, name),
      glow: (ids) => this.playerField.setGlow(ids),
      notes: () => this.engine.notes,
      fieldFlash: (seconds) => {
        // Strawberry's flash: a glare over the top of Cranberry's field (Dragon Fruit's gimmick, gently).
        const glare = this.add.rectangle(fieldLeft, 0, fieldWidth, RECEPTOR_Y * 0.55, calm ? COLORS.night : 0xfff2fa, 0).setOrigin(0).setDepth(Depth.effects + 2);
        this.tweens.add({ targets: glare, fillAlpha: 0.95, duration: 80, hold: seconds * 1000, yoyo: true, onComplete: () => glare.destroy() });
        playSfx(this.game, 'zap');
      },
      burst: () => {
        for (let i = 0; i < 4; i++) this.time.delayedCall(i * 110, () => this.stage.flash(i % 2 ? 0xff9a2e : 0xffffff, 0.22));
        this.rival?.special();
      },
      stomp: () => {
        // Bog Stomp fires by itself: the HUD shows Space pressed, mud splashes up the lanes, the screen shakes once.
        if (!calm) this.cameras.main.shake(260, 0.012);
        this.player.special();
        this.stage.flash(0x6b4a1e, 0.35);
        playSfx(this.game, 'ability');
        playSfx(this.game, 'boom');
        const key = addText(this, PLAYER_FIELD_CENTER, RECEPTOR_Y - 150, '[ SPACE ]', 36, { color: CSS.yellow }).setDepth(Depth.hud + 2);
        this.tweens.add({ targets: key, scale: 0.86, duration: 90, yoyo: true, repeat: 1 });
        this.tweens.add({ targets: key, alpha: 0, delay: 900, duration: 300, onComplete: () => key.destroy() });
        for (let i = 0; i < (calm ? 12 : 40); i++) {
          const lane = PLAYER_LANES[i % 4];
          const mud = this.add.rectangle(lane + Phaser.Math.Between(-30, 30), RECEPTOR_Y + 10, Phaser.Math.Between(8, 18), Phaser.Math.Between(8, 18), i % 3 ? 0x6b4a1e : 0x8a6a3a).setDepth(Depth.effects);
          this.tweens.add({ targets: mud, y: RECEPTOR_Y - Phaser.Math.Between(120, 420), alpha: 0, angle: Phaser.Math.Between(-180, 180), duration: Phaser.Math.Between(500, 900), ease: 'Quad.easeOut', onComplete: () => mud.destroy() });
        }
      },
      finisher: () => {
        this.camera?.setTurn('both');
        this.stage.setTurn('both');
      },
      freeze: () => this.freezeFrame(),
    });
    // Seen once already: hold Enter to skip the whole prologue.
    if (scripted.flow.skippable) this.skipRing = new HoldToSkip(this, () => this.quit(), { keys: ['Enter', 'NumpadEnter'], pointer: false });
  }

  /**
   * Bar 84, beat 3.5: everything stops on the frame where Cranberry's knee goes
   * and Strawberry turns from her pose, reaching. One held note, then static.
   */
  private freezeFrame(): void {
    if (this.frozen) return;
    this.frozen = true;
    this.state = 'ended';
    if (this.laneInput) this.laneInput.enabled = false;
    this.touchLanes?.setGuideVisible(false);
    this.conductor?.pause();
    this.hypeAudio?.silence();
    this.tweens.pauseAll();
    this.hud.setScoreVisible(false);
    this.hud.endOfSong();
    this.player.sprite.setFrame(28);
    const rival = this.rival?.sprite;
    if (rival) rival.setFlipX(!rival.flipX).setFrame(rival.texture.frameTotal > 20 ? 5 : 6);
    const note = sustainedNote(this.game, 196);
    const flow = this.playData.scripted?.flow;
    this.time.delayedCall(1400, () => {
      note.stop(30);
      const hiss = staticSting(this.game);
      this.staticScreen = new StaticScreen(this, Depth.overlay + 3);
      this.staticScreen.show();
      this.director?.vhs.setLabel('');
      this.time.delayedCall(1000, () => {
        this.tweens.resumeAll();
        this.scene.start(SceneKeys.KidsGarden, { flow, hiss });
      });
    });
  }

  // ---------------------------------------------------------------------
  // Pause menu
  // ---------------------------------------------------------------------

  private buildPauseMenu(): void {
    const dim = addDim(this, 0.7);
    // Block clicks from reaching the lanes while paused.
    dim.setInteractive();
    // A story battle's backup can be swapped here, when there is more than one to choose from.
    const canSwap = !this.playData.rules && this.rules.ability !== null && listAvailable(this.storyCrew()).length > 1;
    const extra = (canSwap ? 170 : 0) + 84;
    const top = 180 - extra / 2;
    const panelW = canSwap ? 600 : 480;
    const panel = addBox(this, GAME_W / 2 - panelW / 2, top, panelW, 440 + extra, 'panel');
    const title = addText(this, GAME_W / 2, top + 68, 'Paused', 64, { color: CSS.lilac });
    // Resume makes the tape-start sound itself.
    const entries: [string, () => void, 'select' | 'back' | null][] = [
      ['Resume', () => this.resumeGame(), null],
      [this.crew ? 'Restart round' : 'Restart', () => this.restart(), 'select'],
      [this.autoLabel(), () => this.toggleAutoHit(), 'select'],
      [this.crew ? 'Exit to lineup' : 'Exit', () => this.quit(), 'back'],
    ];
    if (canSwap) entries.splice(1, 0, [this.backupText(), () => this.swapBackup(1), 'select']);
    const buttons = entries.map(([label, action, sfx], i) => addUiButton(this, GAME_W / 2, top + 170 + i * 84, label, action, { width: 400, sfx }));
    this.autoButton = buttons[entries.length - 2];
    const parts: Phaser.GameObjects.GameObject[] = [dim, panel, title, ...buttons.map((button) => button.container)];
    if (canSwap) {
      this.backupButton = buttons[1];
      const hint = isTouch() ? 'Tap to change backup' : 'Left / Right: change backup';
      this.backupLabel = addBody(this, GAME_W / 2, top + 170 + 84 * (entries.length - 1) + 64, '', 22, { color: CSS.grey, wrapWidth: panelW - 64 }).setOrigin(0.5, 0);
      this.backupLabel.setText(`${this.backupBlurb()}\n${hint}`);
      parts.push(this.backupLabel);
    }
    this.pauseFocus = new FocusGroup(this, buttons);
    this.pauseLayer = this.add
      .container(0, 0, parts)
      .setDepth(Depth.overlay + 10)
      .setVisible(false);
  }

  private autoLabel(): string {
    return `Auto-hit (dev): ${this.playData.autoplay ? 'On' : 'Off'}`;
  }

  /** The pause menu's dev switch: the game hits every note for you, from now until switched off. */
  private toggleAutoHit(): void {
    const on = !this.playData.autoplay;
    devAutoHit = on;
    this.playData = { ...this.playData, autoplay: on };
    if (on) this.autoUsed = true;
    else {
      // Let go of anything auto-hit was holding; the resume drops holds no key is holding.
      ([0, 1, 2, 3] as Lane[]).forEach((lane) => this.playerField.setPressed(lane, false));
      this.autoHeld = [null, null, null, null];
    }
    this.autoButton?.setLabel(this.autoLabel());
    if (!this.playData.practice) this.autoTag?.setText(on ? 'Autoplay' : '');
  }

  private backupText(): string {
    const backup = this.rules.abilityOwner;
    return `Backup: ${backup ? CAST[backup].name : 'None'}`;
  }

  private backupBlurb(): string {
    const ability = this.rules.ability ? ABILITIES[this.rules.ability] : null;
    return ability ? `${ability.name}: ${ability.blurb}` : '';
  }

  /** Change the backup from the pause menu. The choice is remembered for later stops. */
  private swapBackup(step: 1 | -1): void {
    const next = cycleBackup(step, this.storyCrew());
    if (!next) return;
    const rules = battleRules(this.rules.gimmick, next);
    this.rules = rules;
    this.effects?.changeBackup(rules);
    this.backupButton?.setLabel(this.backupText());
    const hint = isTouch() ? 'Tap to change backup' : 'Left / Right: change backup';
    this.backupLabel?.setText(`${this.backupBlurb()}\n${hint}`);
  }
}

/** Ids of the notes in `notes` that end a phrase (see phraseEnds). */
function phraseEndIds(chart: Chart, notes: readonly PlayNote[]): Set<number> {
  const sorted = [...notes].sort((a, b) => a.t - b.t);
  const ids = new Set<number>();
  for (const index of phraseEnds(sorted.map((n) => secToBeat(chart, n.t)))) ids.add(sorted[index].id);
  return ids;
}
