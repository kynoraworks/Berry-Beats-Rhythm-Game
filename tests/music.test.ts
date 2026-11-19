import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A fake Web Audio context that records which sources were started and stopped. */
function fakeContext() {
  const started: { stopped: boolean }[] = [];
  const param = () => ({ value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const node = () => ({ connect: vi.fn((target: unknown) => target), disconnect: vi.fn(), gain: param() });
  return {
    started,
    ctx: {
      currentTime: 0,
      destination: {},
      createGain: node,
      createBufferSource: () => {
        const source = { stopped: false, buffer: null, loop: false, onended: null, connect: vi.fn((t: unknown) => t), start: vi.fn(), stop: vi.fn(() => (source.stopped = true)) };
        source.start = vi.fn(() => void started.push(source));
        return source;
      },
    },
  };
}

const loads = new Map<string, { resolve: (buffer: object) => void }>();
let audio = fakeContext();

vi.mock('../src/core/songs', () => ({
  getAudioContext: () => audio.ctx,
  // One shared pending promise per key, like the real loader.
  loadSongBuffer: (_game: unknown, key: string) => {
    let resolve!: (buffer: object) => void;
    const promise = new Promise<object>((r) => (resolve = r));
    loads.set(key, { resolve });
    return promise;
  },
}));
vi.mock('../src/core/settings', () => ({ getSettings: () => ({ musicVolume: 1 }), onSettingsChange: () => () => undefined }));

describe('menu music', () => {
  beforeEach(() => {
    vi.resetModules();
    loads.clear();
    audio = fakeContext();
  });

  it('never leaves a superseded track playing', async () => {
    const { music } = await import('../src/core/music');
    music.init({} as never);
    music.play('tutorial', 0);
    const first = loads.get('tutorial')!;
    music.play('menu', 0);
    music.play('tutorial', 0);
    const second = loads.get('tutorial')!;
    // Both loads of the same song finish after the player has flicked away and back.
    first.resolve({});
    second.resolve({});
    loads.get('menu')!.resolve({});
    await Promise.resolve();
    await Promise.resolve();
    const playing = audio.started.filter((source) => !source.stopped);
    expect(playing).toHaveLength(1);
    expect(music.current).toBe('tutorial');
  });

  it('starts nothing if stopped before the song has loaded', async () => {
    const { music } = await import('../src/core/music');
    music.init({} as never);
    music.play('menu', 0);
    music.stop(0);
    loads.get('menu')!.resolve({});
    await Promise.resolve();
    await Promise.resolve();
    expect(audio.started).toHaveLength(0);
    expect(music.current).toBeNull();
  });
});
