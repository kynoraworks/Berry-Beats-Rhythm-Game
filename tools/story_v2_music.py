#!/usr/bin/env python3
"""Ship the story v2 music (docs/story_v2/MUSIC_LIST.md).

The raw generations (ElevenLabs Music v2.5 and Mirelo SFX through Higgsfield,
prompts and job ids in archive/music/story_v2/prompts.json and SPEND.txt) are
kept in archive/music/story_v2/raw/<key>.mp3. This script turns them into the
files the game plays:

  music   public/assets/audio/story/<key>.mp3   (160 kbps MP3)
  stings  public/assets/audio/sfx/<key>.mp3     (160 kbps MP3)

and writes archive/music/story_v2/loops.json and prologue_cues.json.

How
  * Loudness (EBU R128, integrated): the prologue battle at -13.3 LUFS like the
    stop songs; town loops, train interludes and the garden scene at -16 so they
    sit under dialogue; the sky overture and the credits at -14.5. A lookahead
    limiter (delay compensated, so nothing moves in time) keeps the true peak
    under -1 dBTP. Stings are trimmed, faded and set to -18 LUFS (about the level
    of the existing stingers), peak under -3 dBTP.
  * Loops (town_* and train_*): the beat grid is fitted to the onsets, the loop
    runs a whole number of bars (a multiple of four where it can) from a downbeat
    near the start to a downbeat before any outro or fade, chosen so the bar
    after the loop end sounds most like the loop's first bar. The loop's first
    30 ms are crossfaded (equal power) with what follows the loop end, so the
    jump from loopEnd back to loopStart continues the waveform. The file ends at
    loopEnd, so it also loops as a whole file when loopStart is 0. The seam is
    tested on the decoded MP3 (three loops back to back): sample jump against the
    local maximum, and the onset grid phase before and after each seam.
  * The prologue ("The Last Final", 172 BPM) is cut to the bible's ending:
    bars 81 to 83 become three single hits (the song's own final hit, one per
    bar), bar 84 plays the start of the hook and stops dead on beat 3 and a half,
    a short spectral freeze of that instant rings to the bar 85 downbeat, then
    digital silence (the game cuts to static there).

Run from the repo root:
    python3 tools/story_v2_music.py ship            # every track
    python3 tools/story_v2_music.py ship town_berry_town sting_static
    python3 tools/story_v2_music.py montage         # 15 s of every track

Afterwards, for the prologue: separate stems (Higgsfield separate_stems, mode
"four") from public/assets/audio/story/prologue_last_final.mp3 and run
    python3 tools/hit_layer_stems.py STEMS_DIR story/prologue_last_final
then python3 tools/analyze_audio.py --only prologue for the chart, and
    python3 tools/story_v2_music.py cues
to write the cue file with the chart's measured offset.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "archive" / "music" / "story_v2"
RAW = ARCHIVE / "raw"
OUT_MUSIC = ROOT / "public" / "assets" / "audio" / "story"
OUT_SFX = ROOT / "public" / "assets" / "audio" / "sfx"
SR = 44100
sys.path.insert(0, str(Path(__file__).resolve().parent))
from stretch_songs import loudness  # noqa: E402

TRUE_PEAK = -1.0
# key: (kind, bpm asked, target LUFS)
MUSIC = {
    "prologue_last_final": ("battle", 172, -13.3),
    "kids_garden": ("cue", 92, -16.0),
    "sky_the_line": ("cue", 96, -14.5),
    "credits_same_garden": ("cue", 96, -14.5),
    "town_berry_town": ("loop", 84, -16.0),
    "town_peel_street": ("loop", 100, -16.0),
    "town_graffiti_corner": ("loop", 90, -16.0),
    "town_vine_crossing": ("loop", 96, -16.0),
    "town_citrus_labs": ("loop", 110, -16.0),
    "town_lantern_market": ("loop", 80, -16.0),
    "town_the_club": ("loop", 120, -16.0),
    "town_rooftop_alone": ("loop", 76, -16.0),
    "town_rooftop_full": ("loop", 76, -16.0),
    "town_the_tunnel": ("loop", 70, -16.0),
    "town_orange_plaza": ("loop", 124, -16.0),
    "town_pineapple_hall": ("loop", 92, -16.0),
    "town_grand_stage": ("loop", 100, -16.0),
    "train_between": ("loop", 88, -16.0),
    "train_between_alone": ("loop", 88, -16.0),
}
# Stings: (where the kept part starts: "head" from the first sound, or "tail" for the
# last `length` seconds of the music, the generation's own ending; longest length kept).
STINGS = {
    "sting_static": ("head", 1.6),
    "sting_conductor": ("head", 5.0),
    "sting_rumour": ("head", 3.2),
    "sting_move_learned": ("tail", 3.2),
    "sting_postcard": ("head", 2.6),
    "sting_unlock": ("tail", 3.2),
    "sting_juicefm": ("tail", 4.2),
    "sting_low_point": ("head", 6.6),
    "sting_broadcast": ("head", 5.6),
    "sting_envelope": ("head", 6.2),
}
STING_LUFS = -18.0
STING_PEAK = -3.0
XFADE = 0.030  # loop seam crossfade, seconds


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------

def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def write_wav(path: Path, x: np.ndarray) -> None:
    data = np.clip(x, -1, 1).astype("<f4")
    # 32-bit float WAV via ffmpeg (wave module only writes PCM ints).
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_f32le", str(path)],
        input=data.tobytes(), check=True,
    )


def lufs_of(x: np.ndarray) -> tuple[float, float]:
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "a.wav"
        write_wav(p, x)
        return loudness(p)


def limit(x: np.ndarray, peak_db: float) -> np.ndarray:
    """ffmpeg's lookahead limiter with its delay compensated (output lines up with the input)."""
    lim = 10 ** (peak_db / 20) * 0.97
    with tempfile.TemporaryDirectory() as tmp:
        a, b = Path(tmp) / "a.wav", Path(tmp) / "b.wav"
        write_wav(a, x)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(a), "-af", f"alimiter=limit={lim:.4f}:attack=1:release=60:level=disabled:latency=1",
             "-c:a", "pcm_f32le", str(b)], check=True,
        )
        y = decode(b)
    n = min(len(x), len(y))
    out = np.zeros_like(x)
    out[:n] = y[:n]
    return out


def to_level(x: np.ndarray, target: float, peak_db: float = TRUE_PEAK) -> np.ndarray:
    """Gain to the target loudness, then the limiter; a second pass corrects what the limiter took."""
    y = x
    for _ in range(2):
        got, _ = lufs_of(y)
        y = limit(y * 10 ** ((target - got) / 20), peak_db)
    return y


def level_encode(x: np.ndarray, target: float, dest: Path, peak_db: float = TRUE_PEAK) -> np.ndarray:
    """to_level, encode, and once more if the MP3 came out off target (LAME loses about 0.4 dB)."""
    y = to_level(x, target, peak_db)
    encode(y, dest)
    got, _ = loudness(dest)
    if abs(got - target) > 0.05:
        y = to_level(x, target + (target - got), peak_db)
        encode(y, dest)
    return y


def encode(x: np.ndarray, dest: Path, kbps: int = 160) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "a.wav"
        write_wav(p, x)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(p), "-c:a", "libmp3lame", "-b:a", f"{kbps}k", str(dest)], check=True)


def lag(a: np.ndarray, b: np.ndarray, span: int = 512) -> int:
    """Offset in samples (within +-span) that best lines b up with a, on a loud 10 s stretch."""
    start = min(len(a), len(b)) // 3
    seg = slice(start, start + SR * 10)
    x = a[seg, 0]
    return max(range(-span, span + 1), key=lambda k: float(np.dot(x, b[seg.start + k : seg.start + k + len(x), 0])))


# ---------------------------------------------------------------------------
# Beat grid
# ---------------------------------------------------------------------------

def onset_env(x: np.ndarray, hop: int = 128) -> tuple[np.ndarray, float]:
    import librosa

    mono = x.mean(axis=1).astype(np.float32)
    env = librosa.onset.onset_strength(y=mono, sr=SR, hop_length=hop, n_fft=1024)
    return env.astype(np.float64), SR / hop


def fit_grid(x: np.ndarray, bpm_guess: float) -> dict:
    """Beat period and phase from the onset envelope: a comb search near the asked tempo,
    then a least-squares fit of strong onsets to beat indices."""
    import librosa

    env, fps = onset_env(x)
    t = np.arange(len(env)) / fps
    best = (0.0, bpm_guess)
    for bpm in np.arange(bpm_guess * 0.96, bpm_guess * 1.04, 0.01):
        z = np.abs(np.sum(env * np.exp(2j * np.pi * t * bpm / 60)))
        if z > best[0]:
            best = (z, bpm)
    bpm = best[1]
    mono = x.mean(axis=1).astype(np.float32)
    on = librosa.onset.onset_detect(y=mono, sr=SR, hop_length=128, units="time", backtrack=False)
    period = 60 / bpm
    for _ in range(3):
        phase = np.angle(np.sum(np.exp(2j * np.pi * on / period))) / (2 * np.pi) * period
        k = np.round((on - phase) / period)
        err = on - (phase + k * period)
        keep = np.abs(err) < 0.03
        if keep.sum() < 8:
            break
        period, phase = np.polyfit(k[keep], on[keep], 1)
    bpm_fit = 60 / period
    # Generated songs are made at a whole-number tempo: snap to it when close.
    beat = round(bpm_fit) if abs(bpm_fit - round(bpm_fit)) < 0.05 else bpm_fit
    return {"bpm_fit": float(bpm_fit), "bpm": float(beat), "phase": float(phase % period), "period": float(period), "onsets": on}


def local_phase(env: np.ndarray, fps: float, period: float, centre: float, width: float = 6.0) -> float:
    """Phase (seconds, -period/2..period/2) of the onset envelope folded on `period` within
    +-width of centre. Used with a sixteenth-note period, so syncopation does not matter."""
    a, b = max(0, int((centre - width) * fps)), min(len(env), int((centre + width) * fps))
    if b - a < fps:
        return float("nan")
    t = np.arange(a, b) / fps
    z = np.sum(env[a:b] * np.exp(2j * np.pi * t / period))
    return float(np.angle(z) / (2 * np.pi) * period)


def wrap(v: float, period: float) -> float:
    return (v + period / 2) % period - period / 2


def bar_features(x: np.ndarray, starts: np.ndarray, length: float) -> np.ndarray:
    import librosa

    mono = x.mean(axis=1).astype(np.float32)
    hop = 512
    chroma = librosa.feature.chroma_stft(y=mono, sr=SR, hop_length=hop, n_fft=4096)
    mel = librosa.power_to_db(librosa.feature.melspectrogram(y=mono, sr=SR, hop_length=hop, n_mels=32))
    fps = SR / hop
    out = []
    for s in starts:
        a, b = int(s * fps), int((s + length) * fps)
        if b > chroma.shape[1] or a < 0:
            out.append(np.zeros(12 + 32))
            continue
        c = chroma[:, a:b].mean(axis=1)
        m = mel[:, a:b].mean(axis=1)
        v = np.concatenate([c / (c.max() + 1e-9), (m - mel.mean()) / 20])
        out.append(v / (np.linalg.norm(v) + 1e-9))
    return np.array(out)


def bar_db(x: np.ndarray, start: float, length: float) -> float:
    a, b = int(start * SR), int((start + length) * SR)
    seg = x[max(0, a) : b]
    return float(10 * np.log10(np.mean(seg**2) + 1e-12)) if len(seg) else -120.0


# ---------------------------------------------------------------------------
# Loops
# ---------------------------------------------------------------------------

def choose_loop(x: np.ndarray, bpm_guess: float) -> dict:
    g = fit_grid(x, bpm_guess)
    period, bar = g["period"], 4 * g["period"]
    duration = len(x) / SR
    # Downbeat: of the four beat phases, the one whose bars change most at their start
    # (chords and bass move on the downbeat) with the strongest low end on it.
    first = g["phase"]
    while first - period > -0.02:
        first -= period
    if first < 0:
        first += period
    best_shift, best_score = 0, -1e9
    for shift in range(4):
        starts = first + shift * period + np.arange(0, int((duration - first) / bar) - 1) * bar
        feats = bar_features(x, starts, bar)
        change = np.mean([1 - feats[i] @ feats[i - 1] for i in range(1, len(feats))])
        low = np.mean([bar_db(x, s, period / 4) for s in starts])
        score = change * 20 + low * 0.05
        if score > best_score:
            best_shift, best_score = shift, score
    first += best_shift * period
    nbars = int((duration - first) / bar)
    starts = first + np.arange(nbars) * bar
    levels = np.array([bar_db(x, s, bar) for s in starts])
    med = np.median(levels)
    # The steady part: no trailing bars more than 4 dB under the median (an outro or fade).
    last_ok = nbars - 1
    while last_ok > 0 and levels[last_ok] < med - 4:
        last_ok -= 1
    feats = bar_features(x, starts, bar)
    best = None
    for s in range(0, min(4, nbars)):
        if levels[s] < med - 6:
            continue  # a quiet intro bar is no loop start
        for e in range(s + 8, last_ok + 1):
            # The loop ends at the downbeat of bar e (its first bar after the loop); the
            # crossfade needs a little audio after it.
            end_t = starts[e] if e < nbars else first + e * bar
            if end_t + XFADE + 0.05 > duration:
                continue
            sim = float(feats[e] @ feats[s]) if e < nbars else 0.0
            sim_before = float(feats[e - 1] @ feats[s - 1]) if s > 0 else sim
            score = sim + 0.5 * sim_before + (0.04 if (e - s) % 4 == 0 else 0) + (0.02 if (e - s) % 8 == 0 else 0) + 0.012 * (e - s) - 0.03 * s
            if best is None or score > best[0]:
                best = (score, s, e, sim)
    _, s, e, sim = best
    ls = starts[s]
    le_grid = ls + (e - s) * bar
    # Correct the end for any tempo drift: line it up with the onsets around it.
    env, fps = onset_env(x)
    p0 = local_phase(env, fps, period / 4, ls + 6.0)
    p1 = local_phase(env, fps, period / 4, le_grid - 6.0)
    corr = 0.0 if np.isnan(p0) or np.isnan(p1) else wrap(p1 - p0, period / 4)
    if abs(corr) > 0.020:
        corr = 0.0  # not a drift a fitted grid could have: trust the grid
    le = le_grid + corr
    return {
        "bpm_fit": round(g["bpm_fit"], 3), "bpm": g["bpm"], "bars": e - s, "start_bar": s, "loopStart": ls, "loopEnd": le,
        "drift_correction_ms": round(corr * 1000, 1), "end_similarity": round(sim, 3), "steady_bars": last_ok + 1,
    }


def make_loop(x: np.ndarray, info: dict) -> np.ndarray:
    ls, le = int(round(info["loopStart"] * SR)), int(round(info["loopEnd"] * SR))
    n = int(XFADE * SR)
    ramp = np.linspace(0, np.pi / 2, n)[:, None]
    y = x[:le].copy()
    # Equal power: the loop's first 30 ms fade in while what follows loopEnd fades out.
    y[ls : ls + n] = x[ls : ls + n] * np.sin(ramp) + x[le : le + n] * np.cos(ramp)
    return y


def seam_test(dec: np.ndarray, ls: int, le: int, period: float) -> dict:
    """Three loops back to back from the decoded file: clicks and tempo hitch at the seams."""
    body = dec[ls:le]
    y = np.concatenate([dec[:le], body, body])
    seams = [le, le + len(body)]
    d = np.abs(np.diff(y, axis=0)).max(axis=1)
    clicks = []
    for s in seams:
        jump = float(d[s - 1])
        around = np.concatenate([d[s - SR // 4 : s - 2], d[s + 1 : s + SR // 4]])
        clicks.append(round(jump / (np.percentile(around, 99.9) + 1e-9), 2))
    # High-frequency burst at the seam: energy above 6 kHz in 3 ms against the 200 ms around it.
    from scipy import signal

    sos = signal.butter(4, 6000, btype="high", fs=SR, output="sos")
    hf = signal.sosfilt(sos, y.mean(axis=1)) ** 2
    bursts = []
    for s in seams:
        w = int(0.003 * SR)
        here = hf[s - w : s + w].mean()
        ref = np.percentile([hf[i : i + 2 * w].mean() for i in range(s - SR // 5, s + SR // 5, w)], 90)
        bursts.append(round(float(here / (ref + 1e-12)), 2))
    env, fps = onset_env(y)
    hitch = []
    for s in seams:
        t = s / SR
        before = local_phase(env, fps, period / 4, t - 4.0, 4.0)
        after = local_phase(env, fps, period / 4, t + 4.0, 4.0)
        hitch.append(round(wrap(after - before, period / 4) * 1000, 1))
    return {"click_ratio": clicks, "hf_burst_ratio": bursts, "phase_shift_ms": hitch}


# ---------------------------------------------------------------------------
# Prologue
# ---------------------------------------------------------------------------

PROLOGUE_BPM = 172
PROLOGUE_FIRST_BEAT = 0.058  # fitted on the raw take (librosa beat track and onset phase)


def prologue_edit(x: np.ndarray, first: float) -> tuple[np.ndarray, dict]:
    beat = 60 / PROLOGUE_BPM
    bar = 4 * beat
    t = lambda b, q=1.0: first + ((b - 1) * 4 + (q - 1)) * beat  # noqa: E731
    s = lambda sec: int(round(sec * SR))  # noqa: E731
    y = x.copy()
    # Bars 81 to 83: the song's own final hit (bar 83 beat 1 and its ring), once per bar.
    hit = x[s(t(83)) - 64 : s(t(84))].copy()
    edge = int(0.030 * SR)
    for b in (81, 82, 83):
        a = s(t(b)) - 64
        tail = y[a : a + len(hit)].copy()
        fade = np.ones(len(hit))
        fade[:edge] = np.linspace(1, 0, edge)
        fade[edge:] = 0
        y[a : a + len(hit)] = hit + tail * fade[:, None]
    # Bar 84: the hook's opening (the first 2.5 beats of the phrase that starts at HOOK_BAR),
    # over the last hit's ring, then a dead stop on beat 3 and a half.
    src = x[s(t(HOOK_BAR)) - 64 : s(t(HOOK_BAR, 3.5))]
    a = s(t(84)) - 64
    y[a : a + len(src)] += src
    cut = s(t(84, 3.5))
    # The freeze: the spectrum of the last 46 ms before the cut, held (random phases) to the
    # bar 85 downbeat, a little quieter and fading, then nothing.
    end = s(t(85))
    n_fft = 2048
    win = np.hanning(n_fft)
    grain = y[cut - n_fft : cut]
    mag = np.abs(np.fft.rfft(grain * win[:, None], axis=0))
    hop = n_fft // 4
    length = end - cut + n_fft
    frz = np.zeros((length + n_fft, 2))
    rng = np.random.default_rng(84)
    for i in range(0, length, hop):
        ph = np.exp(2j * np.pi * rng.random(mag.shape))
        frz[i : i + n_fft] += np.fft.irfft(mag * ph, n=n_fft, axis=0) * win[:, None]
    frz = frz[n_fft // 2 : n_fft // 2 + (end - cut)]
    frz *= (np.sqrt(np.mean(grain**2)) / (np.sqrt(np.mean(frz**2)) + 1e-12)) * 0.6
    env = np.linspace(1.0, 0.5, len(frz))
    env[-int(0.004 * SR) :] *= np.linspace(1, 0, int(0.004 * SR))
    frz *= env[:, None]
    stop = int(0.003 * SR)
    y[cut - stop : cut] *= np.linspace(1, 0, stop)[:, None]
    y[cut:end] = frz[: end - cut]
    # Silence after the freeze: the static sting plays there. 1.6 s keeps the charter's
    # end margin for the last notes in bar 84.
    total = end + int(1.6 * SR)
    out = np.zeros((total, 2))
    out[: min(total, end)] = y[: min(total, end)]
    return out, {"cut_s": cut / SR, "static_s": end / SR, "hook_bar": HOOK_BAR, "length_s": total / SR}


# The phrase quoted in bar 84: bar 59 starts the song's biggest section, where the lead
# (the hook) is loudest against the rest (picked by the "other" stem energy, see the report).
HOOK_BAR = 59


# ---------------------------------------------------------------------------
# Stings
# ---------------------------------------------------------------------------

def ship_sting(key: str) -> dict:
    mode, keep = STINGS[key]
    x = decode(RAW / f"{key}.mp3")
    env = np.sqrt(np.convolve((x**2).mean(axis=1), np.ones(441) / 441, mode="same"))
    peak = env.max()
    loud = np.where(env > peak * 10 ** (-50 / 20))[0]
    first, last = int(loud[0]), int(loud[-1])
    if mode == "head":
        a = max(0, first - int(0.005 * SR))
        b = min(last, a + int(keep * SR))
    else:
        b = last
        a = max(first, b - int(keep * SR))
        # Start on a transient so the sting opens on a hit.
        import librosa

        on = librosa.onset.onset_detect(y=x.mean(axis=1).astype(np.float32), sr=SR, units="samples", backtrack=True)
        cands = on[(on >= a - int(0.25 * SR)) & (on <= a + int(0.25 * SR))]
        if len(cands):
            a = int(cands[np.argmin(np.abs(cands - a))])
    y = x[a:b].copy()
    fi, fo = int(0.004 * SR), min(int(0.25 * SR), len(y) // 4)
    y[:fi] *= np.linspace(0, 1, fi)[:, None]
    # Fade only what is still ringing at the end.
    y[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
    dest = OUT_SFX / f"{key}.mp3"
    y = level_encode(y, STING_LUFS, dest, STING_PEAK)
    lufs, tp = loudness(dest)
    return {"key": key, "kind": "sting", "seconds": round(len(y) / SR, 2), "from_s": round(a / SR, 2), "lufs": lufs, "true_peak": tp}


# ---------------------------------------------------------------------------
# Ship
# ---------------------------------------------------------------------------

def ship_music(key: str, loops: dict) -> dict:
    kind, bpm, target = MUSIC[key]
    x = decode(RAW / f"{key}.mp3")
    info: dict = {"key": key, "kind": kind}
    if kind == "loop":
        lp = choose_loop(x, bpm)
        y = make_loop(x, lp)
        dest = OUT_MUSIC / f"{key}.mp3"
        y = level_encode(y, target, dest)
        dec = decode(dest)
        shift = lag(y, dec)
        ls, le = int(round(lp["loopStart"] * SR)), len(y)
        test = seam_test(dec, ls, le, 60 / lp["bpm_fit"])
        loops[key] = {
            "file": f"assets/audio/story/{key}.mp3",
            "bpm": round(lp["bpm_fit"], 2),
            "bars": lp["bars"],
            "loopStart": round(ls / SR, 4),
            "loopEnd": round(le / SR, 4),
            "loopStartSample": ls,
            "loopEndSample": le,
            "fileSamples": int(len(dec)),
            "decodeLag": shift,
            "seam": test,
            "drift_correction_ms": lp["drift_correction_ms"],
            "end_similarity": lp["end_similarity"],
        }
        info.update(loops[key])
    else:
        if key == "prologue_last_final":
            x, edit = prologue_edit(x, PROLOGUE_FIRST_BEAT)
            info["edit"] = {k: round(v, 3) if isinstance(v, float) else v for k, v in edit.items()}
        else:
            fo = int(0.05 * SR)
            x = x.copy()
            x[-fo:] *= np.linspace(1, 0, fo)[:, None]
        dest = OUT_MUSIC / f"{key}.mp3"
        y = level_encode(x, target, dest)
        info["decodeLag"] = lag(y, decode(dest))
        g = fit_grid(y, bpm)
        info["bpm_measured"] = round(g["bpm_fit"], 2)
    info["seconds"] = round(len(y) / SR, 2)
    lufs, tp = loudness(dest)
    info.update({"lufs": lufs, "true_peak": tp})
    return info


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in ("ship", "montage", "cues"):
        print(__doc__)
        return 2
    cmd, keys = sys.argv[1], sys.argv[2:]
    if cmd == "montage":
        return montage()
    if cmd == "cues":
        return write_cues()
    keys = keys or [*MUSIC, *[k for k in STINGS if (RAW / f"{k}.mp3").exists()]]
    loops_path = ARCHIVE / "loops.json"
    loops = json.loads(loops_path.read_text()).get("loops", {}) if loops_path.exists() else {}
    report = []
    for key in keys:
        if not (RAW / f"{key}.mp3").exists():
            print(json.dumps({"key": key, "skipped": "no raw file"}))
            continue
        info = ship_sting(key) if key in STINGS else ship_music(key, loops)
        report.append(info)
        print(json.dumps(info))
    loops_path.write_text(json.dumps({
        "about": "Loop points of the story v2 town and train loops (seconds and samples at 44.1 kHz, in the decoded MP3). "
        "Play the file once from 0, then loop [loopStart, loopEnd): WebAudio AudioBufferSourceNode.loopStart/loopEnd, or Phaser "
        "sound markers. The file ends exactly at loopEnd, so where loopStart is 0 a plain whole-file loop is seamless too "
        "(when the decoder honours the MP3's gapless header, as Chrome and Firefox do). seam: three loops rendered back to "
        "back from the decoded MP3; click_ratio is the sample jump at each seam over the 99.9th percentile of jumps within "
        "250 ms (under 1 means no click), hf_burst_ratio the energy above 6 kHz in 6 ms at the seam over the 90th percentile "
        "around it, phase_shift_ms the onset grid phase after the seam minus before (tempo hitch).",
        "loops": dict(sorted(loops.items())),
    }, indent=2) + "\n")
    return 0


# ---------------------------------------------------------------------------
# Prologue cues
# ---------------------------------------------------------------------------

def write_cues() -> int:
    chart = json.loads((ROOT / "public" / "charts" / "prologue.json").read_text())
    bpm, offset = chart["bpm"], chart["offset"]
    beat = 60 / bpm
    t = lambda b, q=1.0: round(offset + ((b - 1) * 4 + (q - 1)) * beat, 3)  # noqa: E731
    sections = [
        ("intro", 1, 8, "Stomp-and-clap intro, sub hits, no lead (bars 1 to 4 quieter, 5 to 8 add the riff)."),
        ("build", 7, 8, "Pre-drop: the bass drops out in bar 8, fills lead into drop 1."),
        ("drop1", 9, 16, "Drop 1: the full groove and hook come in (+4 dB in the mids). Bar 16 is a fill."),
        ("groove", 17, 32, "Main groove, steady; accents (fills) on bars 24 and 32."),
        ("stop", 33, 33, "A one-bar stop: the drums drop out, a sub boom rings. Bar 34 slams back in."),
        ("drop1b", 34, 42, "Back in after the stop, hi-hats up: the Bog Stomp moment."),
        ("break", 43, 48, "Breakdown: beat 1 of bar 43 is the last hit, a held pad decays to near silence by bar 48."),
        ("build2", 49, 50, "Riser from silence (bar 49), the beat builds back in (bar 50)."),
        ("drop2", 51, 58, "Drop 2: everything back at full stack."),
        ("final", 59, 80, "The biggest section (59 to 66 is the loudest, the lead on top), then everything to bar 80."),
        ("finisher", 81, 83, "Three single hits, one per bar (step, spin, drop), each the song's final hit and its ring."),
        ("cut", 84, 84, "The hook's opening (from bar 59) starts on beat 1 and stops dead on beat 3 and a half; a frozen "
         "sustained note rings to the bar 85 downbeat; then digital silence (static)."),
    ]
    hype = [(9, True), (17, False), (34, True), (43, False), (51, True), (81, False)]
    cues = {
        "about": "Prologue battle cues for 'The Last Final' (public/assets/audio/story/prologue_last_final.mp3, chart "
        "public/charts/prologue.json). Bars are 4 beats, bar 1 starts at firstDownbeat (the chart's offset, beat 0). Seconds "
        "are in the decoded MP3. The music was measured, not assumed: hype switches follow the song's real drops, which "
        "differ from the bible's bar table (bible ON at 13, 29, 57 and OFF at 17, 41, 81; the music's drops are at 9, 34 "
        "and 51 and its breakdown at 43 to 48). Tempo is locked at 172.0 BPM for the whole song (librosa beat track and "
        "the charter's grid fit agree, drift under a few ms).",
        "song": "prologue_last_final",
        "chart": "prologue",
        "bpm": bpm,
        "offset": offset,
        "firstDownbeat": offset,
        "bar1Beat": 0,
        "bars": 84,
        "sections": [{"name": n, "fromBar": a, "toBar": b, "start": t(a), "end": t(b + 1), "note": note} for n, a, b, note in sections],
        "hype": [{"bar": b, "on": on, "time": t(b)} for b, on in hype],
        "bogStomp": {"bar": 34, "time": t(34), "note": "Suggested: the slam back in after the one-bar stop (bible bar 29 has no musical event)."},
        "rivalFlash": {"bar": 26, "time": t(26)},
        "burst": {"fromBar": 49, "toBar": 50, "start": t(49), "end": t(51), "note": "The riser into drop 2, charted as sixteenths."},
        "finisherHits": [{"bar": b, "time": t(b)} for b in (81, 82, 83)],
        "freeze": {"bar": 84, "beatInBar": 3.5, "time": t(84, 3.5), "note": "The music stops dead here (freeze frame); a held "
                   "frozen note rings until static."},
        "static": {"bar": 85, "beatInBar": 1, "time": t(85), "note": "Hard cut to static: play sting_static here. The file is silent from here."},
        "duration": chart.get("duration"),
    }
    (ARCHIVE / "prologue_cues.json").write_text(json.dumps(cues, indent=2) + "\n")
    print(json.dumps({k: cues[k] for k in ("hype", "freeze", "static")}, indent=1))
    return 0


# ---------------------------------------------------------------------------
# Montage
# ---------------------------------------------------------------------------

MONTAGE_FROM = {"prologue_last_final": 69.8, "credits_same_garden": 60.0}


def montage() -> int:
    parts = []
    gap = np.zeros((int(0.35 * SR), 2))
    order = [*MUSIC, *STINGS]
    listing = []
    for key in order:
        path = (OUT_SFX if key in STINGS else OUT_MUSIC) / f"{key}.mp3"
        if not path.exists():
            continue
        x = decode(path)
        if key in STINGS:
            seg = x
        else:
            start = MONTAGE_FROM.get(key, min(len(x) / SR / 3, max(0.0, len(x) / SR - 15)))
            seg = x[int(start * SR) : int((start + 15) * SR)].copy()
            f = int(0.4 * SR)
            seg[:f] *= np.linspace(0, 1, f)[:, None]
            seg[-f:] *= np.linspace(1, 0, f)[:, None]
        listing.append(f"{sum(len(p) for p in parts) / SR:7.1f}s  {key}")
        parts += [seg, gap]
    y = np.concatenate(parts)
    dest = ARCHIVE / "montage.mp3"
    encode(y, dest, 128)
    (ARCHIVE / "montage.txt").write_text("Montage of the story v2 music (15 s of every track, stings in full):\n" + "\n".join(listing) + "\n")
    print("\n".join(listing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
