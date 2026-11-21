import Phaser from 'phaser';
import { Anim, COLORS, CSS, GAME_H, GAME_W, SceneKeys, Tex } from '../core/config';
import { MenuTex, loadMenuArt } from '../menu/art';
import { loadDoorArt } from '../explore/doors';
import { parseChart } from '../core/chart';
import { optionalImages, optionalSheets } from '../core/assets';
import { LEVELS, loadLevelChart } from '../core/levels';
import { stopById, stopForChart } from '../story/stops';
import type { ExploreData } from '../story/places';
import { addText } from '../core/ui';
import type { PlayData } from '../core/flow';

const IMG = 'assets/img/';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    addText(this, GAME_W / 2, GAME_H / 2 - 50, 'Berry Beats', 72, { color: CSS.lilac });
    const width = 480;
    this.add.rectangle(GAME_W / 2, GAME_H / 2 + 40, width + 12, 36, COLORS.ink);
    const bar = this.add.rectangle(GAME_W / 2 - width / 2, GAME_H / 2 + 40, 0, 24, COLORS.pink).setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => (bar.width = width * value));

    const sheet = (key: string, file: string, frameWidth: number, frameHeight: number) =>
      this.load.spritesheet(key, IMG + file, { frameWidth, frameHeight });

    this.load.image(Tex.room, `${IMG}room.png`);
    sheet(Tex.train, 'train.png', 256, 160);
    sheet(Tex.berrySit, 'berry_sit.png', 75, 75);
    sheet(Tex.raspberrySit, 'raspberry_sit.png', 75, 75);
    sheet(Tex.coachSit, 'coach_sit.png', 75, 75);
    sheet(Tex.pearSit, 'pear_sit.png', 75, 75);
    sheet(Tex.lemonSit, 'lemon_sit.png', 75, 75);
    sheet(Tex.portraits, 'portraits.png', 64, 64);
    sheet(Tex.blackberry, 'blackberry.png', 64, 64);
    sheet(Tex.raspberry, 'raspberry.png', 64, 64);
    sheet(Tex.dancer, 'dancer.png', 160, 160);
    sheet(Tex.instructor, 'instructor.png', 64, 64);
    sheet(Tex.pear, 'pear.png', 64, 64);
    sheet(Tex.lemon, 'lemon.png', 64, 64);
    this.load.image(Tex.stageRooftop, `${IMG}stage_rooftop.png`);
    this.load.image(Tex.stageClub, `${IMG}stage_club.png`);
    this.load.image(Tex.stageStreet, `${IMG}stage_street.png`);
    this.load.image(Tex.stageLab, `${IMG}stage_lab.png`);
    sheet(Tex.crowd, 'crowd.png', 100, 24);
    sheet(Tex.judgements, 'judgements.png', 96, 32);
    sheet(Tex.notes, 'notes.png', 18, 18);
    this.load.image(Tex.barFrame, `${IMG}bar_frame.png`);
    this.load.image(Tex.barBlue, `${IMG}bar_blue.png`);
    this.load.image(Tex.barPink, `${IMG}bar_pink.png`);
    this.load.image(Tex.barYellow, `${IMG}bar_yellow.png`);
    sheet(Tex.berries, 'berries.png', 24, 24);
    this.load.image(Tex.pauseButton, `${IMG}pause_button.png`);
    this.load.image(Tex.ui, `${IMG}ui.png`);
    this.load.atlas(Tex.uiKit, `${IMG}ui_kit.png`, `${IMG}ui_kit.json`);
    sheet(Tex.missSplash, 'miss_splash.png', 211, 164);
    this.load.image(Tex.arrowLeft, `${IMG}arrow_ui_left.png`);
    this.load.image(Tex.arrowRight, `${IMG}arrow_ui_right.png`);
    this.load.image(Tex.arrowUp, `${IMG}arrow_ui_up.png`);
    this.load.image(Tex.arrowDown, `${IMG}arrow_ui_down.png`);
    this.load.image(Tex.logo, `${IMG}logo.png`);
    loadMenuArt(this.load);
    loadDoorArt(this.load);
    this.load.image(Tex.titleBg, `${IMG}title_bg.jpg`);
    // Art that is drawn bit by bit: only what is listed as present is requested.
    for (const optional of optionalSheets()) sheet(optional.key, optional.file, optional.frameWidth, optional.frameHeight);
    for (const optional of optionalImages()) this.load.image(optional.key, IMG + optional.file);
  }

  create(): void {
    // Everything is pixel art except these hand-drawn pieces, which look better smoothed.
    for (const key of [Tex.titleBg, Tex.logo, MenuTex.sticker, Tex.arrowLeft, Tex.arrowRight, Tex.arrowUp, Tex.arrowDown, Tex.missSplash]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    this.anims.create({
      key: Anim.train,
      frames: this.anims.generateFrameNumbers(Tex.train, { start: 0, end: 24 }),
      frameRate: 12,
      repeat: -1,
    });
    // Everyone on the bench: a slow breathing bob with a blink or nod and a head tilt (frames are listed in tools/make_seated.py).
    const seatedLoop = [0, 1, 0, 1, 2, 1, 0, 1, 3, 4, 3, 4];
    for (const [key, texture] of [
      [Anim.berrySit, Tex.berrySit],
      [Anim.raspberrySit, Tex.raspberrySit],
      [Anim.coachSit, Tex.coachSit],
      [Anim.watermelonSit, Tex.watermelonSit],
      [Anim.pearSit, Tex.pearSit],
      [Anim.lemonSit, Tex.lemonSit],
    ] as const) {
      if (!this.textures.exists(texture)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(texture, { frames: seatedLoop }),
        frameRate: 5,
        repeat: -1,
      });
    }
    this.anims.create({
      key: Anim.missSplash,
      frames: this.anims.generateFrameNumbers(Tex.missSplash, { start: 0, end: 9 }),
      frameRate: 24,
    });

    void this.startFirstScene();
  }

  /**
   * Normally goes to the title screen. For development and automated tests the
   * URL can jump straight to a scene: `?scene=Menu`, or `?scene=Play&level=tutorial&autoplay=1`
   * (`&chart=charts/some.json` plays any chart file, `&at=30` starts 30 seconds in).
   * `level` takes a stop's chart id too (`level=stop05`); add `&story=1` to play it as the
   * story does, with its dialogue, its win lines and the rematch after a loss.
   * `?scene=Explore&stop=stop03&place=street` opens a station, street or Berry's room.
   */
  private async startFirstScene(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('scene');
    const known = Object.values(SceneKeys) as string[];
    if (requested === SceneKeys.Play) {
      const level = LEVELS.find((l) => l.id === params.get('level')) ?? LEVELS[0];
      const chartUrl = params.get('chart');
      try {
        const chart = chartUrl ? parseChart(await (await fetch(chartUrl)).json()) : await loadLevelChart(level);
        const stop = chartUrl ? undefined : stopForChart(level.id);
        // The Grand Stage is a crew battle: its story path starts at the lineup.
        if (stop?.role === 'final' && params.get('story') === '1') {
          this.scene.start(SceneKeys.Lineup, { intro: true, autoplay: params.get('autoplay') === '1' });
          return;
        }
        const data: PlayData = {
          // A story chart played on its own is danced on its stop's stage.
          chart: chartUrl ? chart : { ...chart, stage: chart.stage ?? level.stage },
          returnTo: { scene: SceneKeys.LevelSelect, data: stop ? { levelId: stop.id } : undefined },
          autoplay: params.get('autoplay') === '1',
          startAt: Number(params.get('at')) || undefined,
          story: stop && params.get('story') === '1' ? { stop: stop.id, segment: stop.number === 1 ? 1 : 0 } : undefined,
        };
        this.scene.start(SceneKeys.Play, data);
        return;
      } catch (error) {
        console.error(error);
      }
    } else if (requested === SceneKeys.Explore) {
      // `?scene=Explore&stop=stop02&place=station` (room, station, street or depart).
      const place = params.get('place');
      const data: ExploreData = {
        stop: (stopById(params.get('stop') ?? '')?.id ?? 'stop02'),
        place: place === 'room' || place === 'street' || place === 'depart' ? place : 'station',
      };
      this.scene.start(SceneKeys.Explore, data);
      return;
    } else if (requested && known.includes(requested) && requested !== SceneKeys.Results) {
      this.scene.start(requested);
      return;
    }
    this.scene.start(SceneKeys.Title);
  }
}
