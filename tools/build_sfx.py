#!/usr/bin/env python3
"""Build the battle hype sounds in public/assets/audio/sfx.

    python3 tools/build_sfx.py archive/generated-audio/mc [--countdown]
    python3 tools/build_sfx.py archive/generated-audio/cassette --cassette
    python3 tools/build_sfx.py archive/generated-audio/miss --miss

RAW_DIR holds the generated takes (ElevenLabs v4, preset voice "Barrett",
[shouting] tag): mc_*.mp3 for the MC lines and src_ahh.mp3, a
shouted "AAAHHH!" that the turntable effects scratch. Everything else comes
from files already in the game (the airhorn, the crowd cheer, a stop song) or
is synthesised here.

  * MC: tightened, then a live-mic chain: high-pass, mud cut, presence lift,
    PA band limit, compression, a little saturation, an arena slap-back and a
    short hall, then pushed loud through a peak limiter.
  * DJ: real scratches. A recorded stab is laid on a virtual record and read
    back along a hand-drawn platter curve (position over time), so the pitch
    and timbre follow the record speed like vinyl does; level follows record
    speed (a stylus is silent when the record stops), groove noise moves with
    the record, and a crossfader gate cuts it.
  * Impacts: sub booms and slams layered from a pitched sub, a kick click, a
    body thump and a crack, saturated so they read on phone speakers.
  * Cassette (--cassette): the main menu's tape deck, cut from Mirelo foley
    takes (*_raw.mp3): a tape picked up off the desk, a tape seating in the
    deck and the door shutting, and the deck's motor spinning up to speed.
  * Miss reactions (--miss): the MC's lines for a dropped streak ("Ooh!
    Dropped it!", "Whoa! Off beat!", "Come on, get it back!", "Ouch! The
    streak is over!"), same voice and mic chain, and the crowd's "aww", a
    Mirelo crowd take given a falling droop. Every take is kept in RAW_DIR;
    MISS_LINES names the one used.
"""
import os
import subprocess
import sys
import wave

import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/assets/audio/sfx')
rng = np.random.default_rng(7)


# --------------------------------------------------------------------------- io

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def save(x, name, kbps=96):
    tmp = os.path.join(OUT, f'{name}.wav')
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', f'{kbps}k', os.path.join(OUT, f'{name}.mp3')], check=True)
    os.remove(tmp)
    peak = 20 * np.log10(np.max(np.abs(x)) + 1e-9)
    print(f'{name:18s} {len(x) / SR:5.2f}s  peak {peak:5.1f} dBFS')


# ---------------------------------------------------------------------- basics

def t_axis(seconds):
    return np.arange(int(seconds * SR)) / SR


def norm(x, peak_db=-1.0):
    return x * (10 ** (peak_db / 20) / (np.max(np.abs(x)) + 1e-12))


def fade(x, fin=0.003, fout=0.05):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b) ** 2
    return x


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'hp', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'lp', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'bp', fs=SR, output='sos'), x)


def peq(x, f0, gain_db, q=1.0):
    """RBJ peaking EQ."""
    a = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / SR
    alpha = np.sin(w) / (2 * q)
    b = [1 + alpha * a, -2 * np.cos(w), 1 - alpha * a]
    den = [1 + alpha / a, -2 * np.cos(w), 1 - alpha / a]
    return signal.lfilter(b, den, x)


def saturate(x, drive):
    return np.tanh(x * drive) / np.tanh(drive)


def compress(x, thr_db=-20.0, ratio=4.0, attack=0.003, release=0.08):
    """Feed-forward compressor on a 1 ms RMS detector; returns the signal with makeup to the original peak."""
    hop = int(0.001 * SR)
    n = len(x) // hop + 1
    pad = np.pad(x, (0, n * hop - len(x)))
    level = np.sqrt((pad.reshape(n, hop) ** 2).mean(1) + 1e-12)
    over = np.maximum(0.0, 20 * np.log10(level) - thr_db)
    want = -over * (1 - 1 / ratio)
    gain = np.zeros(n)
    g = 0.0
    ka, kr = np.exp(-0.001 / attack), np.exp(-0.001 / release)
    for i in range(n):
        k = ka if want[i] < g else kr
        g = want[i] + (g - want[i]) * k
        gain[i] = g
    gain = np.interp(np.arange(len(x)) / hop, np.arange(n), gain)
    y = x * 10 ** (gain / 20)
    return y * (np.max(np.abs(x)) / (np.max(np.abs(y)) + 1e-12))


def limit(x, ceiling_db=-1.0, look=0.002):
    """Look-ahead brick-wall limiter: the gain never lets a peak past the ceiling."""
    ceiling = 10 ** (ceiling_db / 20)
    need = np.minimum(1.0, ceiling / (np.abs(x) + 1e-12))
    n = max(1, int(look * SR))
    g = uniform_filter1d(minimum_filter1d(need, 2 * n + 1), 2 * n + 1)
    g = np.minimum(g, need)  # belt and braces: nothing over the ceiling
    # A gentle release so the limiter does not flutter.
    rel = np.exp(-1 / (0.05 * SR))
    g = signal.lfilter([1 - rel], [1, -rel], g - 1) + 1
    return x * np.minimum(g, need)


def hall(x, rt60=1.4, length=1.1, predelay=0.025, tone=4000):
    """A synthetic hall: decaying noise impulse response, darker as it decays."""
    t = t_axis(length)
    ir = rng.standard_normal(len(t)) * np.exp(-6.9 * t / rt60)
    ir = 0.6 * lp(ir, tone) + 0.4 * lp(ir, tone / 3)
    ir = np.concatenate([np.zeros(int(predelay * SR)), ir])
    ir /= np.sqrt((ir ** 2).sum())
    return signal.fftconvolve(x, ir)[: len(x) + len(ir) - 1]


def slapback(x, taps=((0.105, -9.0), (0.215, -16.0), (0.33, -24.0))):
    """The PA bouncing off the far wall of an arena."""
    tone = hp(lp(x, 3500), 250)
    end = int(max(d for d, _ in taps) * SR)
    y = np.zeros(len(x) + end)
    for d, g in taps:
        i = int(d * SR)
        y[i:i + len(x)] += tone * 10 ** (g / 20)
    return y


def mix(*parts):
    n = max(len(p) for p in parts)
    y = np.zeros(n)
    for p in parts:
        y[: len(p)] += p
    return y


def at(x, seconds, total=None):
    pad = np.concatenate([np.zeros(int(seconds * SR)), x])
    if total is not None:
        pad = np.pad(pad, (0, max(0, int(total * SR) - len(pad))))[: int(total * SR)]
    return pad


# ------------------------------------------------------------------------- MC

def frames_db(x, win=0.02):
    w = int(win * SR)
    n = len(x) // w
    r = np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(1)) + 1e-9
    return 20 * np.log10(r / r.max()), w


def trim(x, thresh_db=-38, pad=0.015, tail=0.06):
    db, w = frames_db(x)
    on = np.where(db > thresh_db)[0]
    if len(on) == 0:
        return x
    a = max(0, on[0] * w - int(pad * SR))
    b = min(len(x), (on[-1] + 1) * w + int(tail * SR))
    return x[a:b]


def cap_pauses(x, longest=0.3):
    """Keep the dramatic pauses ("ROUND... ONE!") but never dead air."""
    db, w = frames_db(x)
    keep, quiet = [], 0
    for i in range(len(db)):
        quiet = quiet + 1 if db[i] < -32 else 0
        if quiet * 0.02 <= longest:
            keep.append(x[i * w:(i + 1) * w])
    keep.append(x[len(db) * w:])
    return np.concatenate(keep)


def mc_chain(x):
    x = cap_pauses(trim(x))
    x = hp(x, 110, 2)
    x = peq(x, 320, -3.0, 1.0)     # mud
    x = peq(x, 2800, 5.0, 0.9)     # the bite of a PA horn
    x = peq(x, 5500, 2.0, 1.2)
    x = lp(x, 9500, 2)             # a PA does not reproduce the top octave
    x = norm(x, -3)
    x = compress(x, -24, 5, 0.003, 0.08)
    x = saturate(norm(x, -2), 2.2)
    dry_len = len(x)
    y = mix(x, slapback(x), hall(x, 1.5, 1.2) * 10 ** (-13 / 20))
    y = y[: dry_len + int(0.5 * SR)]  # let the hall ring half a second, no more
    y = fade(y, 0.002, 0.35)
    return limit(norm(y, 0) * 10 ** (4 / 20), -1.0)


MC_LINES = {
    'mc_round1': 'mc_round1', 'mc_round2': 'mc_round2', 'mc_round3': 'mc_round3', 'mc_round4': 'mc_round4',
    'mc_final': 'mc_final', 'mc_hype': 'mc_hype_b', 'mc_flawless': 'mc_flawless', 'mc_combo': 'mc_combo',
    'mc_crowdwild': 'mc_crowdwild', 'mc_winner': 'mc_winner', 'mc_ohno': 'mc_ohno', 'mc_letsdance': 'mc_letsdance',
    'mc_three': 'mc_three', 'mc_two': 'mc_two', 'mc_one': 'mc_one',
}


# ------------------------------------------------------------------ turntable

class Record:
    """A stab pressed on a virtual record: silence before the cue point, groove noise all the way."""

    def __init__(self, stab, lead=0.25):
        stab = norm(compress(hp(trim(stab, -40, 0.0), 120), -22, 3), -1)
        self.cue = lead
        body = np.concatenate([np.zeros(int(lead * SR)), stab, np.zeros(int(1.0 * SR))])
        n = len(body)
        hiss = hp(rng.standard_normal(n), 1800) * 0.012
        clicks = np.zeros(n)
        idx = rng.choice(n, size=int(n / SR * 25), replace=False)
        clicks[idx] = rng.uniform(-1, 1, len(idx)) * 0.12
        groove = hiss + bp(clicks, 900, 7000)
        self.layers = [(1.3, body), (2.2, lp(body, 9000, 4)), (3.5, lp(body, 5500, 4)), (1e9, lp(body, 3200, 4))]
        self.groove = groove
        self.length = n / SR

    def play(self, pos, fader):
        """pos: record position (s, 0 = cue point) per output sample; fader: 0..1 per output sample."""
        p = np.clip((pos + self.cue) * SR, 0, len(self.groove) - 2)
        speed = np.abs(np.gradient(pos) * SR)
        out = np.zeros(len(pos))
        lower = 0.0
        for top, layer in self.layers:
            sel = (speed >= lower) & (speed < top)
            out[sel] = np.interp(p[sel], np.arange(len(layer)), layer)
            lower = top
        out += np.interp(p, np.arange(len(self.groove)), self.groove)
        # A stylus reads velocity: quiet as the record slows, silent at a stop.
        level = np.tanh(speed * 1.8)
        return lp(out * level, 12000) * fader


class Hand:
    """Builds a platter curve stroke by stroke, plus the crossfader alongside it."""

    def __init__(self):
        self.pos = [np.zeros(0)]
        self.fader = [np.zeros(0)]
        self.here = 0.0

    def stroke(self, dist, dur, fader=1.0, shape='smooth'):
        """Move the record `dist` seconds (negative = back) over `dur` seconds."""
        u = np.linspace(0, 1, max(2, int(dur * SR)), endpoint=False)
        if shape == 'smooth':
            curve = (1 - np.cos(np.pi * u)) / 2
        elif shape == 'push':      # fast start, slow landing: a hand flicking forward
            curve = 1 - (1 - u) ** 2.2
        else:                      # 'pull': slow start, fast end
            curve = u ** 1.8
        jitter = lp(rng.standard_normal(len(u)), 25) * 0.0015
        self.pos.append(self.here + dist * curve + jitter)
        f = fader(u) if callable(fader) else np.full(len(u), float(fader))
        self.fader.append(f)
        self.here += dist
        return self

    def hold(self, dur, fader=0.0):
        n = int(dur * SR)
        self.pos.append(np.full(n, self.here))
        self.fader.append(np.full(n, float(fader)))
        return self

    def release(self, dur, rate=1.0, fader=1.0):
        """Let go: the record runs at `rate` (1 = normal speed, after a short pick-up)."""
        u = t_axis(dur)
        speed = rate * np.minimum(1, u / 0.04)
        self.pos.append(self.here + np.cumsum(speed) / SR)
        f = fader(u / dur) if callable(fader) else np.full(len(u), float(fader))
        self.fader.append(f)
        self.here = self.pos[-1][-1]
        return self

    def take(self):
        f = np.concatenate(self.fader)
        k = int(0.0015 * SR)  # a real crossfader still takes a moment to cut
        f = uniform_filter1d(f, k)
        return np.concatenate(self.pos), f


def gate(open_until=0.7):
    return lambda u: (u < open_until).astype(float)


def chops(rate_hz, duty=0.45):
    return lambda u: ((u * rate_hz) % 1 < duty).astype(float)


def scratches(raw):
    ahh = Record(load(os.path.join(raw, 'src_ahh.mp3')))

    # Baby scratch: forward, back, forward, a longer pull back. Fader open.
    h = Hand().stroke(0.16, 0.095, shape='push').stroke(-0.16, 0.085).stroke(0.2, 0.08, shape='push').stroke(-0.2, 0.13, shape='pull')
    baby = ahh.play(*h.take())

    # Chirps: the fader closes as each forward stroke peaks, so it cuts off "chirp".
    h = Hand()
    for _ in range(2):
        h.stroke(0.12, 0.085, fader=gate(0.65), shape='push').stroke(-0.12, 0.07, fader=0.0)
    h.stroke(0.16, 0.1, fader=gate(0.75), shape='push').hold(0.03)
    chirp = ahh.play(*h.take())

    # Transformer: a slow drag forward and back while the fader taps.
    h = Hand().stroke(0.34, 0.36, fader=chops(9.0, 0.42), shape='smooth').stroke(-0.34, 0.3, fader=chops(8.0, 0.42), shape='smooth')
    transform = ahh.play(*h.take())

    # Flourish: baby, a one-click flare, a fast scribble, a last push and pull.
    h = Hand().stroke(0.15, 0.08, shape='push').stroke(-0.15, 0.08)
    h.stroke(0.18, 0.11, fader=lambda u: ((u < 0.35) | (u > 0.55)).astype(float), shape='push').stroke(-0.18, 0.09, fader=0.0)
    h.stroke(0.14, 0.05, fader=0.0)  # skip into the vowel with the fader shut
    for _ in range(5):
        h.stroke(0.02, 0.022).stroke(-0.02, 0.022)
    h.stroke(-0.12, 0.05, fader=0.0)
    h.stroke(0.22, 0.12, shape='push').stroke(-0.1, 0.09, shape='pull')
    flare = ahh.play(*h.take())

    for name, x, peak in [('dj_baby', baby, -1.5), ('dj_chirp', chirp, -1.5), ('dj_transform', transform, -2.0), ('dj_flare', flare, -1.5)]:
        save(fade(norm(x, peak), 0.002, 0.03), name)


def crossfader_cut():
    """Three fast cuts on the airhorn, then it rings out: "b-b-bwaaa"."""
    horn = load(os.path.join(OUT, 'airhorn.mp3'))[: int(1.2 * SR)]
    step = 0.105
    f = np.zeros(len(horn))
    for k in range(3):
        a = int(k * step * SR)
        f[a:a + int(0.05 * SR)] = 1
    f[int(3 * step * SR):] = 1
    f = uniform_filter1d(f, int(0.0015 * SR))
    # Each cut restarts the stab, as a DJ would by spinning back to the cue.
    y = np.zeros(len(horn))
    for k in range(3):
        a, b = int(k * step * SR), int((k + 1) * step * SR)
        y[a:b] = horn[: b - a]
    tail = horn[: len(horn) - int(3 * step * SR)]
    y[int(3 * step * SR):] = tail
    y = y * f * np.exp(-np.maximum(0, t_axis(len(y) / SR) - 0.6) * 4)
    save(fade(norm(y, -1.5), 0.002, 0.15), 'dj_cut')


def record_moves(song):
    """Fallbacks for when there is no song to grab (the game builds these live from the battle song)."""
    x = load(song)[int(42 * SR): int(48 * SR)]
    rec = norm(x, -1)
    # Spinback: catch the record, then whip it backwards, faster and faster.
    dur = 0.62
    u = t_axis(dur)
    v = np.where(u < 0.06, 1 - u / 0.06, -0.3 - 4.7 * np.clip((u - 0.06) / (dur - 0.06), 0, 1) ** 1.6)
    pos = 3.0 + np.cumsum(v) / SR
    speed = np.abs(v)
    y = np.interp(pos * SR, np.arange(len(rec)), lp(rec, 6000, 4)) * np.tanh(speed * 1.8)
    y *= np.clip((dur - u) / 0.2, 0, 1)
    save(fade(norm(y, -1.5), 0.002, 0.02), 'dj_rewind')
    # Brake: the motor cut, the platter coasting to a stop.
    dur = 1.0
    u = t_axis(dur)
    v = np.maximum(0, 1 - u / 0.95) ** 1.15
    pos = 1.0 + np.cumsum(v) / SR
    y = np.interp(pos * SR, np.arange(len(rec)), rec) * np.tanh(v * 2.2)
    save(fade(norm(y, -1.5), 0.002, 0.05), 'dj_brake')


def needle_drop():
    t = t_axis(0.8)
    thump = np.sin(2 * np.pi * np.cumsum(45 + 35 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.07)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.002) * 0.6
    n = len(t)
    crackle = np.zeros(n)
    idx = rng.choice(n, size=36, replace=False)
    crackle[idx] = rng.uniform(-1, 1, 36) * rng.uniform(0.1, 0.5, 36)
    crackle = bp(crackle, 1200, 7000)
    hiss = hp(rng.standard_normal(n), 3000) * 0.02
    bed = (crackle + hiss) * np.clip(t / 0.03, 0, 1) * np.clip((0.8 - t) / 0.4, 0, 1)
    y = saturate(thump * 0.9, 2.0) + click + bed * 1.5
    save(fade(norm(y, -2), 0.0005, 0.1), 'needle_drop')


# -------------------------------------------------------------------- impacts

def sub(f_start, f_end, glide, decay, dur):
    t = t_axis(dur)
    f = f_end + (f_start - f_end) * np.exp(-t / glide)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)


def kick_click(dur=0.02):
    t = t_axis(dur)
    return hp(rng.standard_normal(len(t)), 2000) * np.exp(-t / 0.003)


def body(dur=0.3, tone=380, decay=0.06):
    t = t_axis(dur)
    return lp(rng.standard_normal(len(t)), tone, 4) * np.exp(-t / decay)


def crack(dur=0.35):
    """A clap-like crack: three fast bursts and a short decay."""
    t = t_axis(dur)
    n = rng.standard_normal(len(t))
    env = np.zeros(len(t))
    for k, d in enumerate([0.0, 0.011, 0.023]):
        env += (t >= d) * np.exp(-np.maximum(0, t - d) / (0.006 if k < 2 else 0.09))
    return bp(n, 900, 6000) * env


def excite(x, amount=0.9):
    """Harmonics of the sub, so the low end is felt on phone and laptop speakers too."""
    return x + hp(saturate(x * 6, 1.0), 160, 4) * amount


def knock(dur=0.25):
    """The mid punch of a kick, where small speakers can play it."""
    return sub(180, 95, 0.02, 0.06, dur)


def boom():
    """The low "oof": a pitched sub, a kick click, a body thump, saturated for small speakers."""
    s = sub(95, 40, 0.05, 0.45, 1.5)
    y = mix(excite(s), knock() * 1.0, kick_click() * 0.45, body() * 0.8)
    y = saturate(norm(y, 0) * 1.0, 2.6)
    y = mix(y, hall(lp(y, 900), 1.0, 0.8) * 0.12)[: int(1.5 * SR)]
    save(fade(norm(y, -1), 0.0005, 0.3), 'boom')


def slam():
    """The biggest hit: boom plus a crack and a metallic ring, in a bigger room."""
    s = sub(110, 38, 0.06, 0.55, 1.9)
    t = t_axis(1.9)
    ring = sum(np.sin(2 * np.pi * f * t) * a for f, a in [(187, 0.5), (433, 0.3), (1130, 0.15)]) * np.exp(-t / 0.18)
    y = mix(excite(s), knock() * 1.0, kick_click() * 0.5, body(0.4, 420, 0.08) * 0.9, crack() * 0.55, ring * 0.12)
    y = saturate(norm(y, 0), 2.8)
    y = mix(y, hall(y, 1.6, 1.4) * 0.22)[: int(1.9 * SR)]
    save(fade(norm(y, -1), 0.0005, 0.4), 'slam')


def sub_drop():
    """An 808 drop for the hype: a long falling sub under a downlifter sweep."""
    t = t_axis(1.6)
    f = 30 + 42 * np.exp(-t / 0.5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.75)
    sweep = rng.standard_normal(len(t))
    centre = 300 + 5700 * np.exp(-t / 0.25)
    out = np.zeros(len(t))
    blk = 512
    for i in range(0, len(t), blk):
        c = centre[i]
        out[i:i + blk] = bp(sweep[max(0, i - 2048):i + blk], c * 0.7, min(c * 1.4, 20000))[-len(out[i:i + blk]):]
    y = mix(excite(saturate(s, 2.4)), knock() * 0.5, kick_click() * 0.5, body(0.3, 300, 0.07) * 0.7, out * np.exp(-t / 0.35) * 0.12)
    save(fade(norm(y, -1), 0.0005, 0.3), 'sub_drop')


def count_hits(raw):
    """The 3-2-1 before a battle: a short heavy hit with one scratch chirp on each
    number, a step higher each time, and a bigger hit with a baby scratch on GO."""
    ahh = Record(load(os.path.join(raw, 'src_ahh.mp3')))
    for name, (f0, rise) in {'count_3': (88, 0.0), 'count_2': (98, 0.12), 'count_1': (110, 0.25)}.items():
        dur = 0.7
        s = sub(f0 * 1.9, f0, 0.03, 0.16, dur)
        h = Hand().stroke(0.11 + 0.02 * rise, 0.07, fader=gate(0.7), shape='push').stroke(-0.11, 0.06, fader=0.0).hold(0.4)
        chirp = ahh.play(*h.take())
        hit = mix(excite(s) * 0.9, knock(0.2) * 0.9, kick_click() * 0.5, body(0.18, 520, 0.035) * 0.7, crack(0.2) * 0.25)
        hit = saturate(norm(hit, 0), 2.4)
        y = mix(hit, at(norm(hp(chirp, 300), -6), 0.012, len(hit) / SR))
        y = mix(y, hall(lp(y, 2500), 0.6, 0.5) * 0.1)[: int(dur * SR)]
        save(fade(norm(y, -1), 0.0005, 0.2), name)
    s = sub(105, 40, 0.05, 0.5, 1.4)
    h = Hand().stroke(0.16, 0.09, shape='push').stroke(-0.16, 0.08).stroke(0.2, 0.08, shape='push').stroke(-0.2, 0.12, shape='pull').hold(0.8)
    baby = ahh.play(*h.take())
    hit = mix(excite(s), knock() * 1.0, kick_click() * 0.5, body(0.3, 440, 0.07) * 0.9, crack() * 0.5)
    hit = saturate(norm(hit, 0), 2.7)
    y = mix(hit, at(norm(hp(baby, 300), -7), 0.02, len(hit) / SR))
    y = mix(y, hall(y, 1.3, 1.0) * 0.18)[: int(1.4 * SR)]
    save(fade(norm(y, -1), 0.0005, 0.35), 'count_go')


def crowd_roar():
    """The cheer, tripled: three slightly different-sized crowds swelling together."""
    cheer = load(os.path.join(OUT, 'crowd_cheer.mp3'))
    layers = []
    for rate, delay, gain in [(1.0, 0.0, 1.0), (0.93, 0.04, 0.8), (1.07, 0.09, 0.7)]:
        n = int(len(cheer) / rate)
        layers.append(at(np.interp(np.arange(n) * rate, np.arange(len(cheer)), cheer) * gain, delay))
    y = hp(mix(*layers), 150)
    t = t_axis(len(y) / SR)
    y *= np.clip(0.55 + t / 0.35, 0, 1)
    save(fade(limit(norm(y, 0) * 1.6, -2.5), 0.01, 0.4), 'crowd_roar')



# ------------------------------------------------------------------- cassette

def cut(x, start, end):
    return x[int(start * SR):int(end * SR)]


def varispeed(x, rate):
    """Read `x` at a speed that changes over time (`rate` per output sample), like a motor coming up to speed."""
    pos = np.cumsum(rate)
    pos = pos[pos < len(x) - 1]
    return np.interp(pos, np.arange(len(x)), x)


def cassette(raw):
    # Picked up: a small tick as the fingers catch the shell, then the clack as it leaves the desk.
    lift = hp(cut(load(os.path.join(raw, 'lift_raw.mp3')), 0.948, 1.012), 160, 4)
    save(fade(norm(lift, -3), 0.002, 0.018), 'tape_lift')
    # Pushed into the deck: the shell seats with a clack and the door latches shut behind it.
    insert = hp(cut(load(os.path.join(raw, 'insert_raw.mp3')), 1.148, 1.42), 70, 4)
    save(fade(norm(insert, -3), 0.002, 0.08), 'tape_insert')
    # The motor: the take's running hum and hiss after its key clunk, read slow at first
    # and eased up to speed (the wow of a capstan catching), with a little flutter.
    motor = hp(cut(load(os.path.join(raw, 'spinup_raw.mp3')), 1.335, 2.0), 90, 4)
    n = int(0.62 * SR)
    t = np.arange(n) / SR
    rate = 1 - 0.5 * np.exp(-t / 0.07) + 0.004 * np.sin(2 * np.pi * 6 * t)
    motor = varispeed(motor, rate)
    t = np.arange(len(motor)) / SR
    motor *= np.clip(t / 0.05, 0, 1)
    save(fade(norm(motor, -3), 0.004, 0.22), 'tape_motor')


# Chosen takes for the miss reactions: output name -> take in archive/generated-audio/miss.
MISS_LINES = {
    'mc_dropped': 'mc_dropped_a',
    'mc_offbeat': 'mc_offbeat_b',
    'mc_getback': 'mc_getback_a',
    'mc_streakover': 'mc_ouch_streak',
}


def crowd_aww(raw):
    """The crowd's "aww" for a broken streak: the take eased in, sagging in pitch as it dies away."""
    x = hp(cut(load(os.path.join(raw, 'crowd_aww_raw.mp3')), 0.05, 1.75), 140, 2)
    t = np.arange(len(x)) / SR
    rate = 1.0 - 0.14 * np.clip(t / 1.4, 0, 1) ** 1.5
    y = varispeed(x, rate)
    t = np.arange(len(y)) / SR
    y *= np.clip(t / 0.09, 0, 1) * np.clip(1.15 - t / 1.6, 0, 1)
    y = lp(y, 7000, 2)
    save(fade(limit(norm(y, -1.5), -2.0), 0.01, 0.35), 'crowd_aww')


def miss_lines(raw):
    for dst, src in MISS_LINES.items():
        save(mc_chain(load(os.path.join(raw, f'{src}.mp3'))), dst)
    crowd_aww(raw)


def main():
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    raw = sys.argv[1]
    if len(sys.argv) == 3 and sys.argv[2] == '--miss':
        miss_lines(raw)
        return
    if len(sys.argv) == 3 and sys.argv[2] == '--cassette':
        cassette(raw)
        return
    if len(sys.argv) == 3 and sys.argv[2] == '--countdown':
        # Only the countdown: the MC's numbers and the hits.
        for dst in ('mc_three', 'mc_two', 'mc_one'):
            save(mc_chain(load(os.path.join(raw, f'{MC_LINES[dst]}.mp3'))), dst)
        count_hits(raw)
        return
    for dst, src in MC_LINES.items():
        save(mc_chain(load(os.path.join(raw, f'{src}.mp3'))), dst)
    scratches(raw)
    crossfader_cut()
    record_moves(os.path.join(ROOT, 'public/assets/audio/the_club.mp3'))
    needle_drop()
    boom()
    slam()
    sub_drop()
    count_hits(raw)
    crowd_roar()


if __name__ == '__main__':
    main()
