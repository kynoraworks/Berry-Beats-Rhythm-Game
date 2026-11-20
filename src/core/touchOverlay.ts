import { LANE_COLORS, type Lane } from './config';
import { zonesFor, type TouchScheme } from './touchSchemes';

/** How long the guide stays clearly visible after a song starts, unless "Show touch guides" is on. */
const GUIDE_MS = 6000;
const IMG = 'assets/img/';
/** Frame order in notes.png: left, up, down, right. */
const NOTE_FRAMES = 4;

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * The touch areas drawn over the whole window (the black bars beside the
 * canvas included, since thumbs rest there on wide phones). Built in plain DOM
 * so it can cover more than the canvas. It never takes pointer events itself.
 */
export class TouchOverlay {
  private readonly root: HTMLDivElement;
  private readonly zones = new Map<Lane, HTMLDivElement>();
  private readonly scheme: TouchScheme;
  private readonly always: boolean;
  private fadeTimer = 0;
  private shown = false;
  private faded = false;

  constructor(scheme: TouchScheme, always: boolean) {
    this.scheme = scheme;
    this.always = always;
    const root = (this.root = document.createElement('div'));
    root.setAttribute('aria-hidden', 'true');
    Object.assign(root.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '5', display: 'none' });
    document.body.appendChild(root);
    this.layout();
    window.addEventListener('resize', this.layout);
  }

  /** Show or hide the guide, for example while a menu is open. The first show starts the fade-out timer. */
  setVisible(visible: boolean): void {
    this.shown = visible;
    this.root.style.display = visible ? 'block' : 'none';
    if (visible && !this.always && !this.faded && this.fadeTimer === 0) {
      this.fadeTimer = window.setTimeout(() => {
        this.faded = true;
        this.applyFade();
      }, GUIDE_MS);
    }
  }

  setPressed(lane: Lane, down: boolean): void {
    const zone = this.zones.get(lane);
    if (!zone) return;
    zone.dataset.down = down ? '1' : '';
    this.paint(zone, lane);
  }

  /** Briefly light a lane (swipes have no fixed area, so the direction arrow flashes instead). */
  flash(lane: Lane): void {
    this.setPressed(lane, true);
    window.setTimeout(() => this.setPressed(lane, false), 140);
  }

  destroy(): void {
    window.clearTimeout(this.fadeTimer);
    window.removeEventListener('resize', this.layout);
    this.root.remove();
  }

  private readonly layout = (): void => {
    this.root.replaceChildren();
    this.zones.clear();
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.scheme === 'swipe') {
      this.layoutSwipe(w, h);
      return;
    }
    for (const zone of zonesFor(this.scheme, w, h)) {
      const el = document.createElement('div');
      const round = this.scheme === 'thumbs' || this.scheme === 'pads';
      Object.assign(el.style, {
        position: 'absolute',
        left: `${zone.x}px`,
        top: `${zone.y}px`,
        width: `${zone.w}px`,
        height: `${zone.h}px`,
        boxSizing: 'border-box',
        transition: 'opacity 0.08s',
      });
      if (round) {
        // An inset, rounded pad with the lane's arrow in the middle.
        const inset = Math.round(Math.min(zone.w, zone.h) * 0.06);
        Object.assign(el.style, { padding: `${inset}px` });
        const pad = document.createElement('div');
        Object.assign(pad.style, {
          width: '100%',
          height: '100%',
          borderRadius: `${Math.round(Math.min(zone.w, zone.h) * 0.18)}px`,
          border: `3px solid ${hex(LANE_COLORS[zone.lane])}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        });
        pad.appendChild(this.arrow(zone.lane, Math.min(zone.w, zone.h) * 0.42));
        el.appendChild(pad);
      } else {
        el.style.borderLeft = zone.lane === 0 ? 'none' : '2px solid rgba(255, 246, 224, 0.12)';
      }
      this.root.appendChild(el);
      this.zones.set(zone.lane, el);
      this.paint(el, zone.lane);
    }
  };

  /** Swipe: four arrows in a cross over the flick area, each lighting when its direction is flicked. */
  private layoutSwipe(w: number, h: number): void {
    const area = document.createElement('div');
    Object.assign(area.style, {
      position: 'absolute',
      left: '0',
      top: `${h / 3}px`,
      width: `${w}px`,
      height: `${(h * 2) / 3}px`,
      borderTop: '2px dashed rgba(255, 246, 224, 0.25)',
      background: 'linear-gradient(to top, rgba(122, 79, 214, 0.25), transparent)',
      boxSizing: 'border-box',
    });
    this.root.appendChild(area);
    const size = Math.min(w, h) * 0.14;
    const cx = w / 2;
    const cy = h * 0.66;
    const spots: [Lane, number, number][] = [
      [0, cx - size * 1.2, cy],
      [1, cx, cy - size * 1.1],
      [2, cx, cy + size * 1.1],
      [3, cx + size * 1.2, cy],
    ];
    for (const [lane, x, y] of spots) {
      const el = document.createElement('div');
      Object.assign(el.style, { position: 'absolute', left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, transition: 'opacity 0.08s' });
      el.appendChild(this.arrow(lane, size));
      this.root.appendChild(el);
      this.zones.set(lane, el);
      this.paint(el, lane);
    }
  }

  /** One frame of notes.png, drawn crisp at `size` CSS pixels. */
  private arrow(lane: Lane, size: number): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
      width: `${size}px`,
      height: `${size}px`,
      backgroundImage: `url(${IMG}notes.png)`,
      backgroundSize: `${NOTE_FRAMES * 100}% 200%`,
      backgroundPosition: `${(lane / (NOTE_FRAMES - 1)) * 100}% 0%`,
      imageRendering: 'pixelated',
    });
    return el;
  }

  private paint(el: HTMLDivElement, lane: Lane): void {
    const down = el.dataset.down === '1';
    const color = hex(LANE_COLORS[lane]);
    const quiet = this.faded && !this.always;
    if (this.scheme === 'columns') {
      el.style.background = `linear-gradient(to top, ${color} 0%, transparent 38%)`;
      el.style.opacity = down ? '0.65' : quiet ? '0' : '0.2';
      return;
    }
    if (this.scheme === 'swipe') {
      el.style.opacity = down ? '0.95' : quiet ? '0' : '0.45';
      return;
    }
    const pad = el.firstElementChild as HTMLDivElement | null;
    if (pad) pad.style.background = down ? `${color}88` : 'rgba(20, 24, 46, 0.35)';
    el.style.opacity = down ? '0.9' : quiet ? '0.12' : '0.5';
  }

  private applyFade(): void {
    for (const [lane, el] of this.zones) this.paint(el, lane);
    if (this.scheme === 'swipe' && this.root.firstElementChild instanceof HTMLDivElement && this.shown) {
      this.root.firstElementChild.style.opacity = this.always ? '1' : '0';
    }
  }
}
