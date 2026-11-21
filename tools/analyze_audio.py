#!/usr/bin/env python3
"""Tempo analysis and auto-charting for the Berry Beats story levels.

What it does
  1. Decodes each song in public/assets/audio with ffmpeg (mono, 44.1 kHz float),
     which is the same decode path browsers use for these files.
  2. Measures tempo, drift and the first-beat offset of every track: Nicole
     Yazmin's six (77 BPM) and the twelve generated stop songs (120 to 160 BPM
     since tools/stretch_songs.py sped them up).
  3. Builds the beat maps in public/charts from the detected onsets, following
     a hand-written section plan per chart (who plays when, how dense, which
     lanes). Note positions and lanes come from the audio. The charts are the
     Coach's tutorial, the twelve story stops (stop01 to stop12, one song each)
     and one Beat Maps chart per song of Nicole's soundtrack (ost_<song>).
  4. Validates every chart and prints a report. Exits non-zero on a violation.

Run from the repo root:
    python3 tools/analyze_audio.py                 # analyse, write charts, report
    python3 tools/analyze_audio.py --clicks DIR    # also write click-track wavs to DIR
    python3 tools/analyze_audio.py --no-write      # report only
    python3 tools/analyze_audio.py --show stop01   # print an ASCII view of a chart
    python3 tools/analyze_audio.py --only stop04   # build and report only these charts

Needs: Python 3.10+, numpy, scipy, and ffmpeg on the PATH.
The output is deterministic: the same audio always gives the same charts.

After a tempo/offset change, copy the printed bpm/offset values into SONGS in
src/core/songs.ts.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import wave
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "public" / "assets" / "audio"
CHART_DIR = ROOT / "public" / "charts"

SR = 44100
# Nicole Yazmin's original soundtrack.
OST_TRACKS = ["tutorial", "level1", "title", "menu", "level_select", "pause"]
# The generated stop songs and the tempo each was asked for. The tempo is searched
# within 8% of that, so a song that came out a little off is still measured right.
# They were sped up from the tempo they were made at by tools/stretch_songs.py.
STOP_TRACKS = {
    "berry_town": 120, "peel_street": 126, "graffiti_corner": 132, "vine_crossing": 130,
    "citrus_labs": 140, "lantern_market": 120, "the_club": 144, "rooftop": 130,
    "the_tunnel": 152, "orange_plaza": 156, "pineapple_hall": 160, "grand_stage": 150,
}
# The short songs of each stop's battles A and B (generated at these tempos, about a
# minute each, see archive/music/sublevels and tools/sublevel_songs.py), by stop number.
# Stops not listed here do not have theirs yet (TEMPORARY): their A and B charts are
# built on the start of the boss song instead (see SUBLEVELS below).
SUB_TRACKS = {
    1: (114, 118), 2: (120, 124), 3: (126, 130), 4: (124, 128), 5: (134, 138), 6: (114, 118),
}
STOP_SONGS = list(STOP_TRACKS)
for _stop, (_a, _b) in SUB_TRACKS.items():
    STOP_TRACKS[f"{STOP_SONGS[_stop - 1]}_a"] = _a
    STOP_TRACKS[f"{STOP_SONGS[_stop - 1]}_b"] = _b
TRACKS = OST_TRACKS + list(STOP_TRACKS)
ARTIST = {name: "Nicole Yazmin" for name in OST_TRACKS} | {name: "Berry Beats (generated)" for name in STOP_TRACKS}
# These two were exported as loops that start exactly on beat 1 at sample 0
# (their length is a whole number of beats), so they calibrate the detector.
LOOP_TRACKS = ("level_select", "pause")

# Nicole's six tracks pulse at 154 per minute, but the drum pattern repeats every 8
# pulses and the snare falls on pulses 3 and 7. Read in 4/4 that is a 77 BPM
# beat with the snare on 2 and 4, so charts use 77 (154 is the double-time reading).
# For every track the "pulse" below is twice the charting tempo (eighth notes).
BEATS_PER_BAR = 4
SLOTS_PER_BEAT = 4  # charts are quantised to quarter beats (sixteenth notes)
BAR_SLOTS = BEATS_PER_BAR * SLOTS_PER_BEAT

ONSET_TOLERANCE = 0.035  # a note must sit this close to a detected onset peak
FIRST_NOTE_MIN = 2.0  # seconds into the audio before the player's first note
LAST_NOTE_MARGIN = 1.5  # seconds of audio left after the last note or hold tail


# ---------------------------------------------------------------------------
# Audio features
# ---------------------------------------------------------------------------

def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def stft_mag(x: np.ndarray, nfft: int, hop: int, fmax: float) -> tuple[np.ndarray, np.ndarray]:
    """Magnitude spectrogram up to fmax, computed in chunks to keep memory low.

    Frame k is centred on sample k * hop + nfft / 2.
    """
    window = np.hanning(nfft)
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    keep = freqs <= fmax
    frames = 1 + (len(x) - nfft) // hop
    out = np.empty((int(keep.sum()), frames), dtype=np.float32)
    chunk = 1024
    for start in range(0, frames, chunk):
        idx = np.arange(start, min(frames, start + chunk))
        seg = x[idx[:, None] * hop + np.arange(nfft)[None, :]] * window
        out[:, idx] = np.abs(np.fft.rfft(seg, axis=1)).T[keep]
    return freqs[keep], out


def spectral_flux(freqs: np.ndarray, mag: np.ndarray, lo: float, hi: float) -> np.ndarray:
    sel = (freqs >= lo) & (freqs < hi)
    logmag = np.log1p(200 * mag[sel] / mag.max())
    diff = np.diff(logmag, axis=1, prepend=logmag[:, :1])
    diff[diff < 0] = 0
    return diff.sum(axis=0)


def pick_peaks(env: np.ndarray, fps: float, t0: float, rel: float) -> np.ndarray:
    """Onset peaks as rows of (time, strength). Strength 1.0 is the 99th percentile of the envelope."""
    width = int(0.25 * fps) | 1
    floor = signal.medfilt(env, width)
    top = np.percentile(env, 99)
    idx, _ = signal.find_peaks(env - floor, height=rel * top, distance=max(1, int(0.06 * fps)))
    rows = []
    for p in idx:
        shift = 0.0
        if 0 < p < len(env) - 1:
            a, b, c = env[p - 1], env[p], env[p + 1]
            den = a - 2 * b + c
            if den != 0:
                shift = 0.5 * (a - c) / den
        rows.append((t0 + (p + shift) / fps, env[p] / top))
    return np.array(rows) if rows else np.zeros((0, 2))


BANDS = {"low": (30, 200), "mid": (200, 2500), "high": (2500, 12000)}
FAST = (1024, 128)  # window, hop for mid and high: about 3 ms steps
SLOW = (4096, 256)  # for bass, pitch and sustain: finer frequency resolution


class Track:
    """Decoded audio plus onset envelopes and peaks in three bands."""

    def __init__(self, name: str):
        self.name = name
        self.x = decode(AUDIO_DIR / f"{name}.mp3")
        self.duration = len(self.x) / SR
        nfft, hop = FAST
        freqs, mag = stft_mag(self.x, nfft, hop, 12000)
        self.fast_fps = SR / hop
        self.fast_t0 = nfft / 2 / SR
        self.env = {
            "mid": spectral_flux(freqs, mag, *BANDS["mid"]),
            "high": spectral_flux(freqs, mag, *BANDS["high"]),
        }
        nfft, hop = SLOW
        self.slow_freqs, self.slow_mag = stft_mag(self.x, nfft, hop, 8000)
        self.slow_fps = SR / hop
        self.slow_t0 = nfft / 2 / SR
        self.env["low"] = spectral_flux(self.slow_freqs, self.slow_mag, *BANDS["low"])
        self.raw_peaks = {
            "mid": pick_peaks(self.env["mid"], self.fast_fps, self.fast_t0, 0.30),
            "high": pick_peaks(self.env["high"], self.fast_fps, self.fast_t0, 0.30),
            "low": pick_peaks(self.env["low"], self.slow_fps, self.slow_t0, 0.35),
        }
        peak = np.abs(self.x).max()
        self.first_transient = float(np.argmax(np.abs(self.x) > 0.1 * peak)) / SR

    def band_timing(self, band: str) -> tuple[float, float]:
        return (self.slow_fps, self.slow_t0) if band == "low" else (self.fast_fps, self.fast_t0)


# ---------------------------------------------------------------------------
# Tempo and beat grid
# ---------------------------------------------------------------------------

@dataclass
class Tempo:
    name: str
    pulse_bpm: float  # the raw pulse, 100..200
    bpm: float  # charting tempo (pulse / 2, see the note at the top)
    grid_phase: float  # phase of the sixteenth grid from flux peaks, seconds
    drift_ms: float  # grid drift from the first to the last onset
    jitter_ms: float  # spread of on-grid onsets around the grid
    on_grid: float  # share of mid/high onsets within 20 ms of the sixteenth grid
    bar_period: float  # autocorrelation of the rhythm at 8 pulses minus that at 4 pulses
    offset: float = 0.0
    confidence: str = ""


def coarse_pulse(track: Track, lo: float = 100, hi: float = 200) -> float:
    """Best pulse in lo..hi BPM by folding the onset envelope over candidate periods."""
    env = track.env["mid"] / np.percentile(track.env["mid"], 99) + track.env["high"] / np.percentile(track.env["high"], 99)
    fps = track.fast_fps
    width = int(0.5 * fps)
    env = env - np.convolve(env, np.ones(width) / width, mode="same")
    env[env < 0] = 0
    idx = np.arange(len(env))
    best = (0.0, 0.0)
    bins = 64
    for bpm in np.arange(lo, hi, 0.02):
        phase = ((idx / (60 / bpm * fps)) % 1 * bins).astype(int) % bins
        hist = np.bincount(phase, weights=env, minlength=bins) / np.maximum(np.bincount(phase, minlength=bins), 1)
        score = hist.max() / (hist.mean() + 1e-9)
        if score > best[0]:
            best = (score, bpm)
    return best[1]


def measure_tempo(track: Track, expected: float | None = None) -> Tempo:
    """Tempo of a track. With `expected`, the beat is searched within 8% of it."""
    if expected is None:
        pulse = coarse_pulse(track)
    else:
        pulse = 2 * coarse_pulse(track, expected * 0.92, expected * 1.08)
    peaks = np.concatenate([track.raw_peaks["mid"], track.raw_peaks["high"]])
    times, weights = peaks[:, 0], peaks[:, 1]
    # Fit a straight line through onset time against sixteenth-grid index. Two passes.
    period = 60 / pulse / 2
    phase = 0.0
    for _ in range(3):
        # phase from the circular mean, then keep onsets close to the grid
        angle = np.angle(np.sum(weights * np.exp(2j * np.pi * times / period)))
        phase = angle / (2 * np.pi) * period
        k = np.round((times - phase) / period)
        err = times - (phase + k * period)
        keep = np.abs(err) < 0.02
        slope, intercept = np.polyfit(k[keep], times[keep], 1, w=weights[keep])
        period, phase = slope, intercept
    k = np.round((times - phase) / period)
    err = times - (phase + k * period)
    keep = np.abs(err) < 0.02
    pulse_bpm = 60 / period / 2
    snapped = round(pulse_bpm) if abs(pulse_bpm - round(pulse_bpm)) < 0.01 else round(pulse_bpm, 3)
    if expected is not None:
        # Generated songs are made at a whole-number tempo: snap the beat to it when close.
        beat = pulse_bpm / 2
        snapped = 2 * round(beat) if abs(beat - round(beat)) < 0.05 else round(pulse_bpm, 3)
    # Drift if we use the snapped tempo instead of the fitted one.
    span = times[keep].max() - times[keep].min()
    drift = (60 / snapped / 2 - period) * (span / period)
    period = 60 / snapped / 2
    angle = np.angle(np.sum(weights[keep] * np.exp(2j * np.pi * times[keep] / period)))
    phase = (angle / (2 * np.pi) * period) % period
    err = (times - phase + period / 2) % period - period / 2
    keep = np.abs(err) < 0.02

    # Does the rhythm repeat every 4 pulses or every 8? Compare the autocorrelation
    # of eighth-pulse onset strengths at both lags.
    steps = int((track.duration - 0.2) / period)
    strength = np.zeros(steps)
    for band in ("low", "mid"):
        fps, t0 = track.band_timing(band)
        env = track.env[band] / np.percentile(track.env[band], 99)
        for i in range(steps):
            a = max(0, int((phase + i * period - 0.03 - t0) * fps))
            b = max(a + 1, int((phase + i * period + 0.03 - t0) * fps))
            strength[i] += env[a:b].max() if a < len(env) else 0
    strength -= strength.mean()

    def autocorr(lag: int) -> float:
        return float(np.dot(strength[:-lag], strength[lag:]) / np.dot(strength, strength))

    bar_period = autocorr(16) - autocorr(8)

    return Tempo(
        name=track.name,
        pulse_bpm=float(snapped),
        bpm=float(snapped) / 2,
        grid_phase=float(phase),
        drift_ms=float(abs(drift) * 1000),
        jitter_ms=float(np.std(err[keep]) * 1000),
        on_grid=float(keep.mean()),
        bar_period=bar_period,
    )


def wrap(value: float, period: float) -> float:
    """Wrap to the range -period/2 .. period/2."""
    return (value + period / 2) % period - period / 2


def settle_offsets(tracks: dict[str, Track], tempos: dict[str, Tempo]) -> float:
    """Turn grid phases into first-beat offsets. Returns the detector lead in seconds.

    Spectral flux peaks slightly before the true attack. The loop tracks start
    exactly on the grid at 0, so their measured phase is that lead.
    """
    period = 60 / tempos[LOOP_TRACKS[0]].pulse_bpm / 2
    lead = -float(np.mean([wrap(tempos[n].grid_phase, period) for n in LOOP_TRACKS]))
    for name, tempo in tempos.items():
        track = tracks[name]
        period = 60 / tempo.pulse_bpm / 2
        if name in LOOP_TRACKS:
            tempo.offset = 0.0
            tempo.confidence = "high (loop cut on the grid)"
            continue
        # The music starts on beat 1, so the first sound is the first beat. Use its time
        # when it agrees with the grid found from the whole track, else trust the grid.
        grid = tempo.grid_phase + lead
        k = round((track.first_transient - grid) / period)
        from_grid = grid + k * period
        gap = abs(track.first_transient - from_grid) * 1000
        tempo.offset = round(track.first_transient if gap < 8 else from_grid, 3)
        solid = tempo.on_grid > 0.6 and tempo.drift_ms < 10 and gap < 8
        tempo.confidence = f"{'high' if solid else 'medium'} (grid and first sound differ by {gap:.1f} ms)"
    return lead


# ---------------------------------------------------------------------------
# Per-slot features on the sixteenth grid
# ---------------------------------------------------------------------------

class Grid:
    """Onset strength, pitch and sustain for every sixteenth slot of a track."""

    def __init__(self, track: Track, tempo: Tempo, lead: dict[str, float]):
        self.track = track
        self.bpm = tempo.bpm
        self.offset = tempo.offset
        self.slot_dur = 60 / tempo.bpm / SLOTS_PER_BEAT
        self.count = int((track.duration - self.offset) / self.slot_dur)
        self.times = self.offset + np.arange(self.count) * self.slot_dur
        self.bars = self.count // BAR_SLOTS

        # Onset peaks, corrected for the detector lead, tagged with their band.
        self.peaks = {band: rows[:, 0] + lead[band] for band, rows in track.raw_peaks.items()}
        self.all_peaks = np.sort(np.concatenate(list(self.peaks.values())))

        self.strength: dict[str, np.ndarray] = {}
        for band in BANDS:
            fps, t0 = track.band_timing(band)
            env = track.env[band]
            out = np.zeros(self.count)
            for s in range(self.count):
                centre = self.times[s] - lead[band]
                a = max(0, int(round((centre - 0.03 - t0) * fps)))
                b = int(round((centre + 0.03 - t0) * fps))
                if b > a and a < len(env):
                    out[s] = env[a:b].max()
            self.strength[band] = np.minimum(out / np.percentile(out, 97), 1.5)

        # Distance from each slot to the nearest detected onset peak (any band).
        pos = np.searchsorted(self.all_peaks, self.times)
        left = self.all_peaks[np.clip(pos - 1, 0, len(self.all_peaks) - 1)]
        right = self.all_peaks[np.clip(pos, 0, len(self.all_peaks) - 1)]
        self.peak_error = np.where(np.abs(left - self.times) < np.abs(right - self.times), left - self.times, right - self.times)
        self.eligible = np.abs(self.peak_error) <= 0.030

        self._pitch_and_sustain()

    def time(self, slot: float) -> float:
        return self.offset + slot * self.slot_dur

    def _pitch_and_sustain(self) -> None:
        """Pitch of whatever starts at each slot (in semitones) and how long it rings (in beats)."""
        track = self.track
        freqs, mag = track.slow_freqs, track.slow_mag
        fps, t0 = track.slow_fps, track.slow_t0
        tonal = np.where((freqs >= 100) & (freqs < 5000))[0]
        wide = np.where((freqs >= 60) & (freqs < 8000))[0]
        top = mag[tonal].max()
        self.pitch = np.full(self.count, np.nan)
        self.tonal = np.zeros(self.count)  # how clearly a pitched note starts here
        self.sustain = np.zeros(self.count)
        self.brightness = np.full(self.count, np.nan)
        beat_frames = 60 / self.bpm * fps
        for s in range(self.count):
            k = int(round((self.times[s] - t0) * fps))
            if k < 7 or k + 8 >= mag.shape[1]:
                continue
            before_t = mag[tonal, k - 6 : k - 2].mean(axis=1)
            after_t = mag[tonal, k + 3 : k + 7].mean(axis=1)
            new = np.maximum(after_t - before_t, 0)
            i = int(np.argmax(new))
            self.tonal[s] = new[i] / top
            self.pitch[s] = 69 + 12 * np.log2(freqs[tonal[i]] / 440)
            new_w = np.maximum(mag[wide, k + 3 : k + 7].mean(axis=1) - mag[wide, k - 6 : k - 2].mean(axis=1), 0)
            if new_w.sum() > 0:
                centroid = np.exp(np.sum(np.log(freqs[wide]) * new_w) / new_w.sum())
                self.brightness[s] = 69 + 12 * np.log2(centroid / 440)
            b = tonal[i]
            trace = mag[max(b - 1, 0) : b + 2, k:].sum(axis=0)
            if len(trace) > 8:
                ref = trace[3:7].mean()
                below = np.where(trace[5:] < 0.4 * ref)[0]
                frames = below[0] + 5 if len(below) else len(trace)
                self.sustain[s] = frames / beat_frames

    def contour(self, slot: int) -> float:
        """A value that rises with pitch: the new note's pitch when one is clear, else the onset's brightness."""
        if self.tonal[slot] >= 0.10 and not np.isnan(self.pitch[slot]):
            return float(self.pitch[slot])
        if not np.isnan(self.brightness[slot]):
            return float(self.brightness[slot])
        return 60.0

    def bar_groups(self) -> list[int]:
        """Group bars whose rhythm and notes match, so repeated music can get the same pattern."""
        feats = []
        for bar in range(self.bars):
            sl = slice(bar * BAR_SLOTS, (bar + 1) * BAR_SLOTS)
            vec = np.concatenate([self.strength["low"][sl], self.strength["mid"][sl]])
            feats.append(vec / (np.linalg.norm(vec) + 1e-9))
        groups: list[int] = []
        heads: list[int] = []
        for bar in range(self.bars):
            match = -1
            for g, head in enumerate(heads):
                if float(feats[bar] @ feats[head]) < 0.86:
                    continue
                a = slice(bar * BAR_SLOTS, (bar + 1) * BAR_SLOTS)
                b = slice(head * BAR_SLOTS, (head + 1) * BAR_SLOTS)
                both = (self.tonal[a] >= 0.10) & (self.tonal[b] >= 0.10)
                if both.sum() >= 3 and np.mean(np.abs(self.pitch[a][both] - self.pitch[b][both]) <= 1.0) < 0.6:
                    continue
                match = g
                break
            if match < 0:
                heads.append(bar)
                match = len(heads) - 1
            groups.append(match)
        return groups


# ---------------------------------------------------------------------------
# Chart generation
# ---------------------------------------------------------------------------

# How much each band counts when choosing which onsets become notes.
# The player follows the melody and snare; the rival leans on kick and bass.
WEIGHTS = {
    "lead": {"mid": 1.0, "low": 0.6, "high": 0.30},
    "bass": {"low": 1.0, "high": 0.45, "mid": 0.35},
}
METRIC_PRIOR = {0: 0.20, 4: 0.12, 8: 0.10, 12: 0.12}


@dataclass
class Section:
    """A run of bars with one arrangement.

    mode:
      echo   the rival plays `unit` bars, then the player repeats the same pattern
      trade  the rival plays `unit` bars of its own pattern, then the player does
      both   both sides play together with different patterns
      rival / player   only that side plays
      rest   nobody plays
    grid: allowed spacing in slots (4 = quarter notes, 2 = eighths)
    notes: target notes per bar for the player; rival_notes for the rival
    bursts: extra sixteenth notes allowed per bar, only on strong odd slots
    doubles: two-lane accents allowed per bar; holds: holds allowed in the section
    hold_sustain: how long a sound must ring, in beats, to become a hold. Below 1.0
      (for percussive tracks) such a hold still lasts one beat
    lanes: lanes the pattern may use
    """

    start: int
    end: int  # exclusive
    mode: str
    grid: int = 4
    notes: int = 3
    rival_notes: int | None = None
    unit: int = 1
    bursts: int = 0
    doubles: float = 0
    holds: int = 0
    max_hold: float = 2.0
    hold_sustain: float = 1.0
    lanes: tuple[int, ...] = (0, 1, 2, 3)
    floor: float = 0.30
    # Two-lane accents for the rival, like `doubles` for the player.
    rival_doubles: float = 0
    # Holds allowed for the rival; None keeps the old rule (one fewer than the player's).
    rival_holds: int | None = None
    # How strong (low plus mid onset strength) a beat must be to carry a double.
    double_accent: float = 1.5
    # Shortest hold in beats: a ringing sound that qualifies is held at least this long,
    # for charts built around holds. None: holds last as long as the sound rings.
    hold_min: float | None = None
    # How clearly a pitched note must start for its sound to become a hold.
    hold_tonal: float = 0.08
    # Sixteenth-note runs per bar: the bar's best stretch of four (or three) back-to-back
    # sixteenths that all have an onset is charted in full, on top of the other picks.
    runs: int = 0


@dataclass
class Plan:
    chart_id: str
    song: str
    title: str
    rival: str
    difficulty: int
    max_nps: int  # most notes allowed in any one-second window
    solo_holds: bool  # True: nothing else for that side while it holds a note
    sections: list[Section] = field(default_factory=list)
    # True: split the lanes at the quartiles of this side's own notes rather than of every
    # onset in the song, so a chart that leans on low sounds still uses all four lanes.
    balance_lanes: bool = False
    # Closest two holds on one side may start, in slots. None: a bar apart for solo_holds
    # charts, two bars otherwise.
    hold_spacing: int | None = None
    # Two notes in one lane closer than this many slots are avoided when choosing lanes
    # (None: only a sixteenth apart). Used for charts that must read slowly.
    lane_gap: int | None = None
    # No two-lane notes at all on either side.
    no_doubles: bool = False
    # Split the lanes by each note's rank in pitch (ties scattered) rather than by value,
    # so songs where many onsets read as the same pitch still use all four lanes evenly.
    rank_lanes: bool = False
    # "" for Normal, else "easy" or "hard": the chart keeps its id and is written to
    # <id>.<variant>.json (see DIFFICULTY VARIANTS below).
    variant: str = ""

    @property
    def file_id(self) -> str:
        return f"{self.chart_id}.{self.variant}" if self.variant else self.chart_id


PLANS = [
    Plan(
        "tutorial", "tutorial", "Tutorial", "dancer", 1, max_nps=3, solo_holds=True,
        sections=[
            # One lane at a time, the instructor shows a bar and the player repeats it.
            Section(0, 2, "echo", grid=4, notes=3, lanes=(0,)),
            Section(2, 4, "echo", grid=4, notes=3, lanes=(1,)),
            Section(4, 6, "echo", grid=4, notes=3, lanes=(2,)),
            Section(6, 8, "echo", grid=4, notes=3, lanes=(3,)),
            # Two lanes, then all four, still quarter notes.
            Section(8, 10, "echo", grid=4, notes=3, lanes=(0, 1)),
            Section(10, 12, "echo", grid=4, notes=3, lanes=(2, 3)),
            Section(12, 16, "echo", grid=4, notes=4),
            # Eighth notes and the first holds, in two-bar phrases.
            Section(16, 20, "echo", grid=2, notes=4, unit=2, holds=1),
            Section(20, 24, "echo", grid=2, notes=4, holds=2),
        ],
    ),
]


# The twelve stops of the story (docs/STORY_BIBLE.md), each on its own generated song.
# Each chart shows its fruit's gimmick where the gimmick lives in the chart; the visual
# ones come from the game. Bars here are bars of that song (2 s at 120 BPM, 1.6 s at
# 150), so note counts per bar scale with the tempo. Sections past a song's end are
# ignored by the charter.
#
# The difficulty curve (November 2026): the songs were sped up to 120 to 160 BPM and
# every chart climbs fast. Stop 1 is already steady eighth notes after a two-bar intro;
# by the middle of the story there are sixteenth bursts and chords, and the last three
# stops are dense sixteenth-note charts. Inside each song the intro is a bar or two,
# then the density climbs section by section to the final stretch.
S = Section

# Shared by the hold-heavy sections of Watermelon's chart. The rooftop song's horns blur
# into the mix, so any clearly pitched note may start a hold; the longest-ringing go first.
MELON = dict(max_hold=4, hold_sustain=0.08, hold_min=2, hold_tonal=0.03, floor=0.2)


def lemon_block(b: int, dense: int) -> list[Section]:
    """Eight bars of Dr. Lemon: the lead changes hands and density every bar or two."""
    return [
        S(b, b + 2, "trade", grid=2, notes=5 + dense, rival_notes=4 + dense, unit=1),
        S(b + 2, b + 3, "both", grid=2, notes=5 + dense, rival_notes=4),
        S(b + 3, b + 4, "rival", grid=1, rival_notes=7, floor=0.18),
        S(b + 4, b + 5, "player", grid=1, notes=6 + dense, bursts=1, floor=0.18),
        S(b + 5, b + 6, "both", grid=4, notes=3, rival_notes=2),
        S(b + 6, b + 7, "player", grid=1, notes=6 + dense, bursts=2, floor=0.18),
        S(b + 7, b + 8, "rival", grid=1, rival_notes=8, floor=0.18),
    ]


def plum_block(b: int, notes: int, grid: int = 2, bursts: int = 0, floor: float = 0.3) -> list[Section]:
    """Four bars of Plum: he shows a bar, the player answers for two, then nobody plays."""
    return [
        S(b, b + 1, "rival", grid=grid, rival_notes=notes - 1, floor=floor),
        S(b + 1, b + 3, "player", grid=grid, notes=notes, bursts=bursts, floor=floor, holds=1, hold_sustain=0.4, hold_min=2),
        S(b + 3, b + 4, "rest"),
    ]


PLANS += [
    # Stop 1, Raspberry: an even chart with no gimmick, the first boss. Steady eighth notes
    # from bar 2, the two sides trading, then both at once and fuller to the end.
    Plan(
        "stop01", "berry_town", "Stop 1", "raspberry", 2, max_nps=6, solo_holds=False,
        sections=[
            S(0, 2, "trade", grid=4, notes=3, rival_notes=4, unit=1),
            S(2, 8, "trade", grid=2, notes=5, rival_notes=5, unit=1, holds=1),
            S(8, 16, "trade", grid=2, notes=6, rival_notes=6, unit=2, holds=1),
            S(16, 32, "both", grid=2, notes=6, rival_notes=5, doubles=0.25, holds=2),
            S(32, 40, "trade", grid=2, notes=7, rival_notes=7, unit=1, holds=1),
            S(40, 50, "both", grid=2, notes=7, rival_notes=5, doubles=0.5, holds=1),
        ],
        rank_lanes=True,
    ),
    # Stop 2, Banana: his notes slide in from the next lane in the game, so the chart keeps
    # to rules that read cleanly at speed: no doubles and no lane twice within a beat.
    Plan(
        "stop02", "peel_street", "Stop 2", "banana", 2, max_nps=5, solo_holds=True, lane_gap=4, no_doubles=True,
        sections=[
            S(0, 2, "trade", grid=4, notes=3, rival_notes=3, unit=1),
            S(2, 12, "trade", grid=2, notes=6, rival_notes=6, unit=1, holds=1),
            S(12, 20, "trade", grid=2, notes=7, rival_notes=6, unit=2, holds=1),
            S(20, 28, "both", grid=2, notes=6, rival_notes=4),
            S(28, 36, "trade", grid=2, notes=8, rival_notes=7, unit=1),
            S(36, 45, "both", grid=2, notes=7, rival_notes=5, bursts=1),
        ],
        rank_lanes=True,
    ),
    # Stop 3, Pear: starts light and finishes strong. Trades over the intro, fuller trades
    # in the groove, a held freeze on the break, then both sides with sixteenth bursts.
    Plan(
        "stop03", "graffiti_corner", "Stop 3", "pear", 3, max_nps=7, solo_holds=False, lane_gap=3,
        sections=[
            S(0, 2, "trade", grid=4, notes=3, rival_notes=3, unit=1),
            S(2, 8, "trade", grid=2, notes=6, rival_notes=6, unit=1),
            S(8, 14, "trade", grid=2, notes=7, rival_notes=6, unit=2, bursts=1),
            S(14, 16, "both", grid=4, notes=2, rival_notes=2, holds=2, hold_sustain=0.08, hold_min=2),
            S(16, 24, "both", grid=2, notes=6, rival_notes=5, holds=1, bursts=1, hold_sustain=0.08, hold_min=2),
            S(24, 32, "both", grid=2, notes=7, rival_notes=5, doubles=0.5, bursts=2),
            S(32, 38, "trade", grid=1, notes=8, rival_notes=7, unit=1, bursts=2),
            S(38, 46, "both", grid=1, notes=8, rival_notes=6, bursts=2, doubles=0.5),
        ],
        rank_lanes=True,
    ),
    # Stop 4, Grape: notes arrive in pairs, on both sides, chords on the strong beats.
    Plan(
        "stop04", "vine_crossing", "Stop 4", "grape", 3, max_nps=8, solo_holds=False,
        sections=[
            S(0, 1, "rival", grid=2, rival_notes=5, rival_doubles=2, double_accent=0.6),
            S(1, 8, "trade", grid=2, notes=5, rival_notes=5, unit=1, doubles=2, rival_doubles=2, double_accent=0.6),
            S(8, 24, "trade", grid=2, notes=6, rival_notes=5, unit=1, doubles=2.5, rival_doubles=2, double_accent=0.6, holds=1),
            S(24, 32, "both", grid=2, notes=6, rival_notes=4, doubles=2, rival_doubles=1, bursts=1, double_accent=0.6),
            S(32, 43, "both", grid=2, notes=7, rival_notes=5, doubles=2.5, rival_doubles=1, bursts=2, double_accent=0.6, holds=1),
        ],
        rank_lanes=True,
    ),
    # Stop 5, Dr. Lemon: erratic. The lead and the density change every bar or two, with
    # sixteenth breaks where the music leaves the beat, a held breakdown, then more of it.
    Plan(
        "stop05", "citrus_labs", "Stop 5", "lemon", 3, max_nps=7, solo_holds=False,
        sections=[
            S(0, 2, "trade", grid=2, notes=4, rival_notes=4, unit=1),
            *lemon_block(2, 1),
            *lemon_block(10, 2),
            *lemon_block(18, 2),
            S(26, 36, "both", grid=2, notes=7, rival_notes=4, bursts=2, doubles=0.5, floor=0.2),
            S(36, 44, "trade", grid=4, notes=3, rival_notes=3, unit=1, holds=1, floor=0.15),
            *lemon_block(44, 3),
            S(52, 55, "both", grid=1, notes=8, rival_notes=4, bursts=2, floor=0.18),
        ],
        balance_lanes=True,
    ),
    # Stop 6, Plum: long rests and patient patterns. Every phrase leaves the player at
    # least a bar of quiet, and some bars nobody plays at all; the answers he asks for
    # grow from eighths into sixteenth bursts.
    Plan(
        "stop06", "lantern_market", "Stop 6", "plum", 3, max_nps=7, solo_holds=False,
        sections=[
            *plum_block(0, 6),
            *plum_block(4, 7),
            *[s for b in range(8, 28, 4) for s in plum_block(b, 8, bursts=1, floor=0.18)],
            *[s for b in range(28, 48, 4) for s in plum_block(b, 9, grid=1, bursts=2, floor=0.12)],
            S(48, 57, "both", grid=1, notes=9, rival_notes=5, doubles=0.5, bursts=2, holds=1, hold_sustain=0.4, hold_min=2, floor=0.12),
        ],
        rank_lanes=True,
    ),
    # Stop 7, Dragon Fruit: a flashy boss. Dense and syncopated, sixteenth bursts.
    Plan(
        "stop07", "the_club", "Stop 7", "dragonfruit", 4, max_nps=8, solo_holds=False,
        sections=[
            S(0, 2, "rival", grid=2, rival_notes=5),
            S(2, 12, "trade", grid=2, notes=6, rival_notes=5, unit=1, bursts=1),
            S(12, 20, "trade", grid=2, notes=6, rival_notes=6, unit=2, bursts=2, floor=0.2),
            S(20, 28, "trade", grid=1, notes=7, rival_notes=6, unit=1, bursts=2, floor=0.18),
            S(28, 36, "both", grid=2, notes=7, rival_notes=5, doubles=1, bursts=1),
            S(36, 40, "both", grid=4, notes=3, rival_notes=2, holds=2, hold_sustain=0.6),
            S(40, 44, "trade", grid=1, notes=8, rival_notes=6, unit=1, bursts=2, runs=1, floor=0.18),
            S(44, 54, "both", grid=1, notes=8, rival_notes=6, bursts=2, doubles=1, runs=1),
        ],
        rank_lanes=True,
    ),
    # Stop 8, Watermelon: long holds of two to four beats on both sides, taps around them.
    Plan(
        "stop08", "rooftop", "Stop 8", "watermelon", 4, max_nps=7, solo_holds=False, hold_spacing=8,
        sections=[
            S(0, 2, "trade", grid=2, notes=4, rival_notes=4, unit=1, holds=1, rival_holds=1, **{**MELON, "hold_min": 1.5}),
            S(2, 20, "trade", grid=2, notes=7, rival_notes=6, unit=1, holds=9, rival_holds=3, bursts=1, **MELON),
            S(20, 32, "both", grid=1, notes=8, rival_notes=4, holds=6, rival_holds=2, bursts=2, **{**MELON, "floor": 0.15}),
            S(32, 43, "both", grid=1, notes=9, rival_notes=5, holds=6, rival_holds=2, bursts=2, runs=1, **{**MELON, "floor": 0.12}),
        ],
        rank_lanes=True,
    ),
    # Stop 9, Coconut: hard, steady and unrelenting. Eighth notes almost all the way,
    # through the tunnel's breakdown, then sixteenth runs out the other side.
    Plan(
        "stop09", "the_tunnel", "Stop 9", "coconut", 4, max_nps=8, solo_holds=False,
        sections=[
            S(0, 2, "rival", grid=2, rival_notes=5),
            S(2, 8, "both", grid=2, notes=5, rival_notes=4, floor=0.12),
            S(8, 16, "trade", grid=2, notes=7, rival_notes=6, unit=1, doubles=0.25, bursts=1),
            S(16, 32, "both", grid=2, notes=7, rival_notes=4, doubles=0.25, bursts=1),
            S(32, 34, "both", grid=2, notes=6, rival_notes=4),
            S(34, 40, "trade", grid=2, notes=5, rival_notes=5, unit=1, floor=0.12),
            S(40, 58, "both", grid=1, notes=8, rival_notes=5, doubles=0.5, bursts=2, runs=1),
        ],
        rank_lanes=True,
    ),
    # Stop 10, Orange: rapid bursts, then rests. A bar of sixteenth runs, then a bar of
    # quiet while he fires his own; the song's two drops are steadier trades.
    Plan(
        "stop10", "orange_plaza", "Stop 10", "orange", 5, max_nps=9, solo_holds=False,
        sections=[
            S(0, 2, "trade", grid=2, notes=5, rival_notes=5, unit=1),
            S(2, 12, "trade", grid=2, notes=4, rival_notes=4, unit=1, runs=1, floor=0.12),
            S(12, 24, "trade", grid=2, notes=5, rival_notes=4, unit=1, runs=1, floor=0.12),
            S(24, 28, "trade", grid=2, notes=7, rival_notes=6, unit=2, floor=0.12),
            S(28, 36, "trade", grid=2, notes=6, rival_notes=4, unit=1, runs=2, floor=0.12),
            S(36, 40, "both", grid=2, notes=7, rival_notes=4, floor=0.12),
            S(40, 53, "trade", grid=1, notes=8, rival_notes=5, unit=1, runs=2, bursts=2, doubles=0.5, double_accent=1.0, floor=0.1),
        ],
        rank_lanes=True,
    ),
    # Stop 11, Pineapple: precise, clean and punishing. No gimmick shapes, just accuracy:
    # an eighth-note line that rarely lets up, with the song's sixteenths charted.
    Plan(
        "stop11", "pineapple_hall", "Stop 11", "pineapple", 5, max_nps=9, solo_holds=False,
        sections=[
            S(0, 1, "rival", grid=2, rival_notes=5),
            S(1, 8, "both", grid=2, notes=6, rival_notes=3, floor=0.2),
            S(8, 16, "both", grid=1, notes=8, rival_notes=4, bursts=2, runs=1, doubles=1, double_accent=1.0, floor=0.15),
            S(16, 24, "trade", grid=1, notes=9, rival_notes=6, unit=1, runs=1, bursts=2, doubles=1, double_accent=1.0, floor=0.12),
            S(24, 32, "both", grid=1, notes=8, rival_notes=4, bursts=2, runs=1, doubles=2, double_accent=0.9, floor=0.15),
            S(32, 40, "both", grid=1, notes=9, rival_notes=4, runs=1, bursts=2, doubles=2, double_accent=0.9, floor=0.15),
            S(40, 50, "both", grid=1, notes=9, rival_notes=4, bursts=2, runs=2, doubles=2, double_accent=0.9, floor=0.12),
            S(50, 55, "both", grid=2, notes=6, rival_notes=3, holds=1, floor=0.12),
        ],
        rank_lanes=True,
    ),
    # Stop 12, Blueberry: the hardest clean chart in the game, no gimmick.
    Plan(
        "stop12", "grand_stage", "Stop 12", "blueberry", 5, max_nps=10, solo_holds=False,
        sections=[
            S(0, 1, "rival", grid=2, rival_notes=5),
            S(1, 8, "both", grid=2, notes=7, rival_notes=4, bursts=2, doubles=0.5),
            S(8, 16, "trade", grid=1, notes=8, rival_notes=7, unit=1, runs=1, floor=0.18),
            S(16, 24, "both", grid=1, notes=8, rival_notes=5, doubles=1, runs=1, bursts=1, floor=0.15),
            S(24, 28, "trade", grid=1, notes=9, rival_notes=7, unit=1, runs=2, floor=0.15),
            S(28, 32, "both", grid=2, notes=6, rival_notes=4, holds=2, floor=0.15),
            S(32, 48, "both", grid=1, notes=9, rival_notes=5, doubles=1, bursts=2, runs=2, holds=1, floor=0.12),
        ],
        rank_lanes=True,
    ),
]

# ---------------------------------------------------------------------------
# Battles A and B of each stop (docs/STORY_BIBLE.md, "Three battles per stop")
# ---------------------------------------------------------------------------
# Battle C is the stop chart above. A and B are shorter charts in the same shape: the
# opening of C's plan, cut to fit, then C's last section as their own finish, with the
# density lowered (a lot for A, a little for B), so the stop's gimmick is taught in A,
# pushed in B and danced in full in C. Bars of the short songs: about 60 s at their tempo.

SUB_SECONDS = 60.0
# TEMPORARY: bars of the boss song that A and B dance while their own songs are missing.
FALLBACK_BARS = {"a": 24, "b": 32}
# How much lighter than C each is: notes and rival notes taken off per bar, the share of
# C's doubles kept, and whether sixteenth sections (grid 1) are kept.
SUB_LIGHTER = {
    "a": dict(notes=2, rival=1, doubles=0.5, sixteenths=False, bursts=1, runs=9, nps=1, level=1),
    "b": dict(notes=1, rival=0, doubles=0.75, sixteenths=True, bursts=0, runs=1, nps=0, level=0),
}
# Per-chart changes on top: Grape's first battle is one grape, with no pairs at all.
SUB_OVERRIDES = {"stop04a": dict(doubles=0.0)}


def lighten(sec: Section, rules: dict) -> Section:
    if sec.mode == "rest":
        return sec
    out = Section(**{**sec.__dict__})
    out.notes = max(2, sec.notes - rules["notes"])
    if sec.rival_notes is not None:
        out.rival_notes = max(2, sec.rival_notes - rules["rival"])
    out.doubles = round(sec.doubles * rules["doubles"], 2)
    out.rival_doubles = round(sec.rival_doubles * rules["doubles"], 2)
    if not rules["sixteenths"] and sec.grid == 1:
        out.grid = 2
    out.bursts = max(0, sec.bursts - rules["bursts"])
    out.runs = max(0, sec.runs - rules["runs"])
    return out


def sub_plan(boss: Plan, key: str, song: str, bars: int) -> Plan:
    rules = {**SUB_LIGHTER[key], **SUB_OVERRIDES.get(f"{boss.chart_id}{key}", {})}
    finish = 8 if bars >= 24 else 4
    body_end = bars - finish
    sections = []
    for sec in boss.sections:
        if sec.start >= body_end:
            continue
        sections.append(lighten(Section(**{**sec.__dict__, "end": min(sec.end, body_end)}), rules))
    last = boss.sections[-1]
    # The finish: C's last section, from the end of the body to the end of the song (the
    # charter ignores bars past it).
    sections.append(lighten(Section(**{**last.__dict__, "start": body_end, "end": bars + 2}), rules))
    return Plan(
        f"{boss.chart_id}{key}", song, f"{boss.title}{key.upper()}", boss.rival, max(1, boss.difficulty - rules["level"]),
        max_nps=max(3, boss.max_nps - rules["nps"]), solo_holds=boss.solo_holds, sections=sections,
        balance_lanes=boss.balance_lanes, hold_spacing=boss.hold_spacing, lane_gap=boss.lane_gap,
        no_doubles=boss.no_doubles, rank_lanes=boss.rank_lanes,
    )


# Who dances battles A and B where it is not the stop's own fruit: Orange Plaza's
# qualifiers are rematches with Banana and Plum, in the shape of their own stops' charts.
SUB_RIVALS = {"stop10a": "stop02", "stop10b": "stop06"}

SUBLEVELS: list[Plan] = []
for _plan in [p for p in PLANS if p.chart_id.startswith("stop")]:
    _stop = int(_plan.chart_id[4:])
    for _key in "ab":
        _shape = next((p for p in PLANS if p.chart_id == SUB_RIVALS.get(f"{_plan.chart_id}{_key}")), _plan)
        if _stop in SUB_TRACKS:
            _song = f"{_plan.song}_{_key}"
            _bars = int(SUB_SECONDS / (240 / STOP_TRACKS[_song]))
        else:
            _song = _plan.song
            _bars = FALLBACK_BARS[_key]
        _sub = sub_plan(_shape, _key, _song, _bars)
        _sub.chart_id, _sub.title = f"{_plan.chart_id}{_key}", f"{_plan.title}{_key.upper()}"
        SUBLEVELS.append(_sub)
# Stop 12's battles A and B are sets of the crew battle, danced on the enemies' own stop
# charts (src/story/crewBattle.ts), so they have no charts of their own.
SUBLEVELS = [p for p in SUBLEVELS if not p.chart_id.startswith("stop12")]
PLANS += SUBLEVELS


# ---------------------------------------------------------------------------
# DIFFICULTY VARIANTS: Easy and Hard of every story battle
# ---------------------------------------------------------------------------
# Normal is the plan as written. Easy keeps the shape and thins it: fewer notes per bar,
# no sixteenths (bursts, runs and grid 1 go), about a third of the chords, holds no
# longer than two beats, and a lower notes-per-second cap. Hard adds to it: two more
# notes per bar, sixteenths where the song has them, more chords and an extra hold.

def easy_section(sec: Section) -> Section:
    if sec.mode == "rest":
        return sec
    out = Section(**{**sec.__dict__})
    out.notes = max(2, round(sec.notes * 0.65))
    if sec.rival_notes is not None:
        out.rival_notes = max(2, round(sec.rival_notes * 0.75))
    out.grid = max(2, sec.grid)
    out.bursts = 0
    out.runs = 0
    out.doubles = round(sec.doubles * 0.3, 2)
    out.rival_doubles = round(sec.rival_doubles * 0.5, 2)
    out.max_hold = min(sec.max_hold, 2.0)
    if sec.hold_min is not None:
        out.hold_min = min(sec.hold_min, 1.0)
    return out


def hard_section(sec: Section, no_doubles: bool) -> Section:
    if sec.mode == "rest":
        return sec
    out = Section(**{**sec.__dict__})
    out.notes = sec.notes + 2
    if sec.rival_notes is not None:
        out.rival_notes = sec.rival_notes + 1
    out.bursts = sec.bursts + 1
    if sec.grid <= 2 and sec.notes >= 5:
        out.runs = sec.runs + 1
    if not no_doubles:
        out.doubles = sec.doubles + 0.5
    out.holds = sec.holds + 1
    return out


def variant(plan: Plan, which: str) -> Plan:
    if which == "easy":
        sections = [easy_section(s) for s in plan.sections]
        level, nps = max(1, plan.difficulty - 1), max(3, plan.max_nps - 3)
    else:
        sections = [hard_section(s, plan.no_doubles) for s in plan.sections]
        level, nps = min(5, plan.difficulty + 1), plan.max_nps + 2
    # Dr. Lemon's charts balance lanes on their own notes; with Hard's extra sixteenths that
    # stacks runs in one lane, so his Hard splits lanes by pitch rank like the other stops.
    hard_lemon = which == "hard" and plan.balance_lanes
    return Plan(
        plan.chart_id, plan.song, plan.title, plan.rival, level, max_nps=nps, solo_holds=plan.solo_holds, sections=sections,
        balance_lanes=plan.balance_lanes and not hard_lemon, hold_spacing=plan.hold_spacing, lane_gap=plan.lane_gap,
        no_doubles=plan.no_doubles, rank_lanes=plan.rank_lanes or hard_lemon, variant=which,
    )


PLANS += [variant(p, which) for p in [p for p in PLANS if p.chart_id.startswith("stop")] for which in ("easy", "hard")]


# Nicole Yazmin's original soundtrack, one beat map per song for the Beat Maps menu.
# Each is the chart a story stop used before the stops got their own songs.
PLANS += [
    # Stop 2, Banana: an easy warm-up. His notes slide in from the next lane in the game,
    # so the chart reads slowly: no doubles and no lane twice within a beat.
    Plan(
        "ost_tutorial", "tutorial", "Tutorial", "banana", 1, max_nps=3, solo_holds=True, lane_gap=4, no_doubles=True,
        sections=[
            Section(0, 4, "trade", grid=4, notes=3, rival_notes=3, unit=1),
            Section(4, 12, "trade", grid=4, notes=4, rival_notes=4, unit=2, holds=1),
            Section(12, 20, "trade", grid=2, notes=4, rival_notes=4, unit=1, holds=1),
            Section(20, 24, "both", grid=4, notes=4, rival_notes=3),
        ],
        rank_lanes=True,
    ),
    Plan(
        # The Pear starts slow and finishes strong, and so does his chart: sparse trades
        # over the intro, fuller trades in the groove, a held freeze on the break in
        # bar 11, then both sides together for the densest bars at the end.
        "ost_level_select", "level_select", "Character Select", "pear", 2, max_nps=4, solo_holds=False,
        sections=[
            Section(0, 2, "trade", grid=2, notes=4, rival_notes=4, unit=1),
            Section(2, 4, "trade", grid=2, notes=5, rival_notes=4, unit=1),
            # The groove's off-beat hit (the sixteenth before beat 4) is charted, hence grid=1,
            # except in bar 7, which would otherwise get the chart's only pair of sixteenths.
            Section(4, 6, "trade", grid=1, notes=5, rival_notes=5, unit=1),
            Section(6, 7, "rival", grid=1, rival_notes=5),
            Section(7, 8, "player", grid=2, notes=5),
            Section(8, 10, "trade", grid=1, notes=6, rival_notes=6, unit=1, holds=2, hold_sustain=0.6),
            Section(10, 11, "both", grid=2, notes=6, rival_notes=5),
            Section(11, 12, "both", grid=2, notes=3, rival_notes=3, holds=2, hold_sustain=0.6),
            Section(12, 16, "both", grid=2, notes=7, rival_notes=6, bursts=1, doubles=0.5, holds=1, hold_sustain=0.6),
        ],
        balance_lanes=True,
    ),
    # Stop 7, Dragon Fruit: a flashy boss. Dense and syncopated on the sixteenth grid,
    # nothing like stop 1 on the same song.
    Plan(
        "ost_level1", "level1", "Level 1", "dragonfruit", 4, max_nps=5, solo_holds=False,
        sections=[
            Section(0, 1, "rival", grid=2, rival_notes=6),
            Section(1, 4, "trade", grid=2, notes=6, rival_notes=6, unit=1, bursts=1),
            Section(4, 8, "trade", grid=1, notes=7, rival_notes=6, unit=2, floor=0.22),
            Section(8, 12, "both", grid=2, notes=7, rival_notes=5, bursts=2, doubles=0.5, holds=1),
            Section(12, 16, "trade", grid=1, notes=8, rival_notes=7, unit=1, floor=0.2),
            Section(16, 20, "both", grid=1, notes=8, rival_notes=6, doubles=1),
            Section(20, 24, "trade", grid=1, notes=8, rival_notes=8, unit=1, bursts=2),
            Section(24, 29, "both", grid=1, notes=9, rival_notes=6, doubles=1, floor=0.2),
        ],
        rank_lanes=True,
    ),
    # Stop 6, Plum: long rests and patient patterns. Every phrase leaves the player at
    # least a bar of quiet, and some bars nobody plays at all.
    Plan(
        "ost_title", "title", "Title Screen", "plum", 3, max_nps=4, solo_holds=False,
        sections=[
            Section(0, 1, "rival", grid=4, rival_notes=3),
            Section(1, 2, "player", grid=4, notes=4),
            Section(2, 3, "rest"),
            Section(3, 4, "rival", grid=4, rival_notes=4),
            Section(4, 6, "player", grid=2, notes=5, holds=1, hold_sustain=0.4, hold_min=2),
            Section(6, 7, "rest"),
            Section(7, 8, "rival", grid=2, rival_notes=5),
            Section(8, 10, "player", grid=2, notes=6, holds=1, hold_sustain=0.4, hold_min=2),
            Section(10, 11, "rest"),
            Section(11, 12, "rival", grid=2, rival_notes=5),
            Section(12, 14, "both", grid=2, notes=6, rival_notes=4),
            Section(14, 15, "rest"),
            Section(15, 16, "rival", grid=2, rival_notes=5),
            Section(16, 18, "player", grid=2, notes=6, holds=1, hold_sustain=0.4, hold_min=2),
            Section(18, 19, "rest"),
            Section(19, 20, "rival", grid=2, rival_notes=5),
            Section(20, 23, "both", grid=2, notes=6, rival_notes=5, doubles=0.5, holds=1, hold_sustain=0.4, hold_min=2),
        ],
        rank_lanes=True,
    ),
    Plan(
        # Dr. Lemon is erratic. The song runs in four-bar phrases that end on a syncopated
        # break, so the plan changes hands and density every few bars: solo bursts, a quiet
        # bar, and breaks charted on the sixteenth grid where the music leaves the beat.
        "ost_pause", "pause", "Pause Screen", "lemon", 3, max_nps=4, solo_holds=False,
        sections=[
            Section(0, 2, "trade", grid=2, notes=5, rival_notes=5, unit=1),
            Section(2, 3, "both", grid=2, notes=5, rival_notes=5),
            Section(3, 4, "rival", grid=1, rival_notes=6, floor=0.18),
            Section(4, 6, "both", grid=2, notes=6, rival_notes=5, bursts=1),
            Section(6, 7, "player", grid=1, notes=7),
            Section(7, 8, "player", grid=1, notes=6, floor=0.18),
            Section(8, 10, "trade", grid=1, notes=6, rival_notes=7, unit=1),
            Section(10, 11, "both", grid=4, notes=3, rival_notes=3),
            Section(11, 12, "both", grid=2, notes=7, rival_notes=6, bursts=2, holds=1),
            Section(12, 15, "both", grid=2, notes=7, rival_notes=6, bursts=1, doubles=0.5, floor=0.22),
            Section(15, 16, "player", grid=4, notes=3, holds=1, floor=0.18),
            Section(16, 19, "both", grid=1, notes=7, rival_notes=6, doubles=1),
            Section(19, 20, "rival", grid=1, rival_notes=9),
            Section(20, 23, "both", grid=2, notes=8, rival_notes=7, bursts=2, doubles=1, floor=0.22),
            Section(23, 24, "both", grid=1, notes=6, rival_notes=5, floor=0.18),
            Section(24, 28, "trade", grid=2, notes=3, rival_notes=3, unit=1, holds=1, floor=0.15),
        ],
        balance_lanes=True,
    ),
    # Stop 12, Blueberry: the hardest clean chart in the game, no gimmick.
    Plan(
        "ost_menu", "menu", "Main Menu", "blueberry", 5, max_nps=5, solo_holds=False,
        sections=[
            Section(0, 1, "rival", grid=2, rival_notes=7),
            Section(1, 4, "both", grid=2, notes=8, rival_notes=6, bursts=2, doubles=1),
            Section(4, 8, "trade", grid=1, notes=9, rival_notes=9, unit=1, floor=0.2),
            Section(8, 12, "both", grid=1, notes=10, rival_notes=7, doubles=1, runs=1, floor=0.15),
            Section(12, 16, "trade", grid=1, notes=10, rival_notes=10, unit=1, runs=1, floor=0.15),
            Section(16, 24, "both", grid=1, notes=10, rival_notes=7, doubles=1, bursts=2, runs=1, holds=2, floor=0.15),
        ],
        rank_lanes=True,
    ),
]

@dataclass
class Note:
    slot: int  # sixteenth index from beat 0
    lane: int = -1
    length: int = 0  # hold length in slots, 0 for a tap
    score: float = 0.0
    partner: bool = False  # second note of a double
    allowed: tuple[int, ...] = (0, 1, 2, 3)


class Charter:
    def __init__(self, plan: Plan, grid: Grid):
        self.plan = plan
        self.grid = grid
        self.groups = grid.bar_groups()
        self.salience = {
            voice: sum(w * grid.strength[band] for band, w in weights.items()) / sum(weights.values())
            for voice, weights in WEIGHTS.items()
        }
        # The same salience averaged over bars that match, so repeats give the same picks.
        self.template = {voice: self._template(values) for voice, values in self.salience.items()}
        self.first_slot = int(np.ceil((FIRST_NOTE_MIN - grid.offset) / grid.slot_dur))
        self.last_slot = int(np.floor((grid.track.duration - LAST_NOTE_MARGIN - grid.offset) / grid.slot_dur))

    def _template(self, values: np.ndarray) -> np.ndarray:
        out = values.copy()
        for g in set(self.groups):
            bars = [b for b, gg in enumerate(self.groups) if gg == g]
            mean = np.mean([values[b * BAR_SLOTS : (b + 1) * BAR_SLOTS] for b in bars], axis=0)
            for b in bars:
                out[b * BAR_SLOTS : (b + 1) * BAR_SLOTS] = mean
        return out

    # -- rhythm ------------------------------------------------------------

    def pick(self, bar: int, section: Section, voice: str, count: int, also_bar: int | None = None) -> list[tuple[int, float]]:
        """Choose slots in a bar. With `also_bar`, a slot must have an onset in both bars (echo)."""
        g = self.grid
        base = bar * BAR_SLOTS
        if base + BAR_SLOTS > g.count:
            return []
        score = self.template[voice][base : base + BAR_SLOTS].copy()
        ok = g.eligible[base : base + BAR_SLOTS].copy()
        if also_bar is not None:
            other = also_bar * BAR_SLOTS
            if other + BAR_SLOTS > g.count:
                return []
            score = np.minimum(score, self.template[voice][other : other + BAR_SLOTS])
            ok &= g.eligible[other : other + BAR_SLOTS]
        candidates = []
        for s in range(BAR_SLOTS):
            if not ok[s] or score[s] < section.floor or s % section.grid != 0:
                continue
            candidates.append((score[s] + METRIC_PRIOR.get(s, 0.04 if s % 2 == 0 else 0.0), s))
        candidates.sort(key=lambda c: (-c[0], c[1]))
        chosen = {s: sc for sc, s in candidates[:count]}
        if section.bursts:
            # Sixteenth notes only where the music clearly has one between two chosen eighths.
            odd = [(score[s], s) for s in range(1, BAR_SLOTS, 2) if ok[s] and score[s] >= 0.62 and (s - 1) in chosen and ((s + 1) in chosen or s + 1 == BAR_SLOTS)]
            odd.sort(key=lambda c: (-c[0], c[1]))
            taken: list[int] = []
            for sc, s in odd:
                if len(taken) >= section.bursts:
                    break
                if all(abs(s - t) > 4 for t in taken):
                    taken.append(s)
                    chosen[s] = sc
        if section.runs:
            used: set[int] = set()
            for _ in range(section.runs):
                best = None
                for length in (4, 3):
                    for a in range(0, BAR_SLOTS - length + 1):
                        window = range(a, a + length)
                        # Runs start on an eighth and stay clear of each other.
                        if a % 2 or any(abs(s - u) <= 2 for s in window for u in used):
                            continue
                        if all(ok[s] and score[s] >= section.floor for s in window):
                            total = float(sum(score[s] for s in window))
                            if best is None or total > best[0]:
                                best = (total, window)
                    if best:
                        break
                if not best:
                    break
                for s in best[1]:
                    # Ranked above ordinary picks, so the density cap thins those first.
                    chosen[s] = max(chosen.get(s, 0.0), float(score[s]) + 0.5)
                    used.add(s)
        return sorted(chosen.items())

    # -- building ----------------------------------------------------------

    def build(self) -> tuple[list[Note], list[Note]]:
        player: list[Note] = []
        rival: list[Note] = []
        for section in self.plan.sections:
            p, r = self._section(section)
            player += p
            rival += r
        # Echo sections arrive with lanes already set; everything else is laned in one
        # pass per side so the playability rules also hold across section boundaries.
        self._lanes(player, 0)
        self._lanes(rival, 0, mirror=True)
        player = self._finish(player, is_player=True)
        rival = self._finish(rival, is_player=False)
        return player, rival

    def _section(self, sec: Section) -> tuple[list[Note], list[Note]]:
        player: list[Note] = []
        rival: list[Note] = []
        rival_count = sec.rival_notes if sec.rival_notes is not None else sec.notes

        def make(bar: int, voice: str, count: int, section: Section) -> list[Note]:
            return [Note(bar * BAR_SLOTS + s, score=sc, allowed=sec.lanes) for s, sc in self.pick(bar, section, voice, count)]

        if sec.mode == "echo":
            for start in range(sec.start, sec.end, sec.unit * 2):
                pattern: list[Note] = []  # slots relative to the start of the call
                for u in range(sec.unit):
                    call, answer = start + u, start + sec.unit + u
                    for s, sc in self.pick(answer, sec, "lead", sec.notes, also_bar=call):
                        pattern.append(Note(u * BAR_SLOTS + s, score=sc, allowed=sec.lanes))
                answer_base = (start + sec.unit) * BAR_SLOTS
                pattern = self._add_holds(pattern, sec, answer_base, limit=sec.holds, span_end=sec.unit * BAR_SLOTS)
                self._lanes(pattern, answer_base)
                for n in pattern:
                    rival.append(Note(start * BAR_SLOTS + n.slot, n.lane, n.length, n.score))
                    player.append(Note(answer_base + n.slot, n.lane, n.length, n.score))
            return player, rival

        if sec.mode == "trade":
            for start in range(sec.start, sec.end, sec.unit * 2):
                for u in range(sec.unit):
                    if start + u < sec.end:
                        rival += make(start + u, "lead", rival_count, sec)
                    if start + sec.unit + u < sec.end:
                        player += make(start + sec.unit + u, "lead", sec.notes, sec)
        else:
            plain = Section(sec.start, sec.end, sec.mode, grid=sec.grid, floor=sec.floor)
            for bar in range(sec.start, sec.end):
                if sec.mode in ("both", "player"):
                    player += make(bar, "lead", sec.notes, sec)
                if sec.mode in ("both", "rival"):
                    rival += make(bar, "bass" if sec.mode == "both" else "lead", rival_count, plain)

        span_end = sec.end * BAR_SLOTS
        player = self._add_holds(player, sec, 0, limit=sec.holds, span_end=span_end)
        rival_holds = max(0, sec.holds - 1) if sec.rival_holds is None else sec.rival_holds
        rival = self._add_holds(rival, sec, 0, limit=rival_holds, span_end=span_end)
        player = self._add_doubles(player, sec, sec.doubles)
        rival = self._add_doubles(rival, sec, sec.rival_doubles)
        return player, rival

    def _add_holds(self, notes: list[Note], sec: Section, base: int, limit: int, span_end: int) -> list[Note]:
        """Turn notes that start a long ringing sound into holds. `base` maps note slots to grid slots."""
        if limit <= 0:
            return notes
        g = self.grid
        notes = sorted(notes, key=lambda n: n.slot)
        options = []
        for i, n in enumerate(notes):
            s = base + n.slot
            if s >= g.count or g.tonal[s] < sec.hold_tonal or g.sustain[s] < sec.hold_sustain:
                continue
            beats = min(sec.max_hold, max(1.0, np.floor(g.sustain[s] * 2) / 2))
            if sec.hold_min is not None:
                beats = min(sec.max_hold, max(beats, sec.hold_min))
            length = int(beats * SLOTS_PER_BEAT)
            if n.slot + length > span_end - 2:
                length = (span_end - 2 - n.slot) // 2 * 2
            if length < SLOTS_PER_BEAT:
                continue
            options.append((g.sustain[s] * g.tonal[s], i, length))
        options.sort(key=lambda o: (-o[0], o[1]))
        held: list[tuple[int, int]] = []
        spacing = BAR_SLOTS if self.plan.solo_holds else 2 * BAR_SLOTS
        if self.plan.hold_spacing is not None:
            spacing = self.plan.hold_spacing
        for _, i, length in options:
            if len(held) >= limit:
                break
            start = notes[i].slot
            if any(abs(start - h) < spacing for h, _ in held):
                continue
            notes[i].length = length
            held.append((start, length))
        if self.plan.solo_holds:
            # Easy charts: nothing else to press while holding, and a short breath after.
            notes = [n for n in notes if n.length or not any(h < n.slot < h + ln + 2 for h, ln in held)]
        return notes

    def _add_doubles(self, notes: list[Note], sec: Section, rate: float) -> list[Note]:
        if rate <= 0 or self.plan.no_doubles:
            return notes
        g = self.grid
        out = list(notes)
        bars = sorted({n.slot // BAR_SLOTS for n in notes})
        budget = 0.0
        for bar in bars:
            budget = min(budget + rate, 2.0)
            options = []
            for n in notes:
                if n.slot // BAR_SLOTS != bar or n.length or n.slot % 4 != 0:
                    continue
                accent = g.strength["low"][n.slot] + g.strength["mid"][n.slot]
                if accent >= sec.double_accent:
                    options.append((accent, n))
            options.sort(key=lambda o: (-o[0], o[1].slot))
            for accent, n in options:
                if budget < 1:
                    break
                out.append(Note(n.slot, score=n.score + 1, partner=True, allowed=n.allowed))
                budget -= 1
        return out

    # -- lanes -------------------------------------------------------------

    def _lanes(self, notes: list[Note], base: int, mirror: bool = False) -> None:
        """Give every unlaned note a lane that follows the pitch contour and stays playable.

        `base` maps note slots to grid slots (echo patterns are laned before they are placed).
        """
        g = self.grid
        notes.sort(key=lambda n: (n.slot, n.partner))
        mains = [n for n in notes if not n.partner]
        values = [g.contour(min(base + n.slot, g.count - 1)) for n in mains]

        def want_lane(n: Note, v: float) -> int:
            k = len(n.allowed)
            ref = values if self.plan.balance_lanes and len(values) >= 8 else self.song_values
            edges = np.percentile(ref, [100 * q / k for q in range(1, k)]) if k > 1 else []
            b = int(np.searchsorted(edges, v))
            return n.allowed[k - 1 - b if mirror else b]

        if self.plan.rank_lanes and len(mains) >= 8:
            order = sorted(range(len(mains)), key=lambda i: (values[i], (mains[i].slot * 7919) % 97))
            rank = {i: r for r, i in enumerate(order)}

            def ranked_lane(i: int) -> int:
                n = mains[i]
                k = len(n.allowed)
                b = min(k - 1, rank[i] * k // len(mains))
                return n.allowed[k - 1 - b if mirror else b]

            want = [m.lane if m.lane >= 0 else ranked_lane(i) for i, m in enumerate(mains)]
        else:
            want = [m.lane if m.lane >= 0 else want_lane(m, v) for m, v in zip(mains, values)]
        fixed = [m.lane >= 0 for m in mains]

        # Runs of 3+ notes moving in one direction become stair patterns across the lanes.
        i = 0
        while i < len(mains):
            j = i
            direction = 0
            while j + 1 < len(mains) and mains[j + 1].slot - mains[j].slot <= 2 and not fixed[j + 1] and len(mains[j + 1].allowed) == 4:
                step = values[j + 1] - values[j]
                d = 1 if step > 0.5 else -1 if step < -0.5 else 0
                if d == 0 or (direction and d != direction):
                    break
                direction = d
                j += 1
            if j - i + 1 >= 3 and direction and not fixed[i] and len(mains[i].allowed) == 4:
                d = -direction if mirror else direction
                for part in range(i, j + 1, 4):
                    size = min(4, j + 1 - part)
                    start = int(np.clip(want[part], 0, 4 - size)) if d > 0 else int(np.clip(want[part], size - 1, 3))
                    for q in range(size):
                        want[part + q] = start + d * q
                i = j + 1
            else:
                i += 1

        # Playability: no same-lane repeat a sixteenth apart, at most two in a row at eighth speed.
        # A lane that holds a long note stays free until half a beat after it ends.
        busy_until = [-1, -1, -1, -1]
        prev: list[tuple[int, int]] = []  # (slot, lane) of earlier notes, newest last
        for pos, n in enumerate(mains):
            rising = pos > 0 and values[pos] >= values[pos - 1]
            up_first = rising != mirror
            order = sorted(n.allowed, key=lambda c: (abs(c - want[pos]), -c if up_first else c))

            def fine(c: int) -> bool:
                if busy_until[c] >= n.slot:
                    return False
                if prev:
                    last_slot, last_lane = prev[-1]
                    gap = n.slot - last_slot
                    if gap <= 1 and c == last_lane:
                        return False
                    if self.plan.lane_gap is not None and any(lane == c and n.slot - slot < self.plan.lane_gap for slot, lane in prev[-4:]):
                        return False
                    if gap <= 2 and c == last_lane and len(prev) > 1 and prev[-2][1] == c and last_slot - prev[-2][0] <= 2:
                        return False
                return True

            if not fixed[pos] and len(n.allowed) > 1:
                choice = next((c for c in order if fine(c)), None)
                if choice is None:
                    choice = next((c for c in order if busy_until[c] < n.slot), order[0])
                n.lane = choice
            elif not fixed[pos]:
                n.lane = n.allowed[0]
            prev.append((n.slot, n.lane))
            if n.length:
                busy_until[n.lane] = n.slot + n.length + 2

        # Doubles: pair each accent with the mirror lane when it is free.
        by_slot = {n.slot: n for n in mains}
        hold_spans = [(n.slot, n.slot + n.length + 2, n.lane) for n in mains if n.length]
        for n in notes:
            if not n.partner or n.lane >= 0:
                continue
            main = by_slot[n.slot]
            taken = {lane for a, b, lane in hold_spans if a <= n.slot <= b} | {main.lane}
            # Ranked-lane charts also keep a double's second note out of eighth-note runs.
            reach = 2 if self.plan.rank_lanes else 1
            near = {m.lane for m in mains if 0 < abs(n.slot - m.slot) <= reach}
            options = [3 - main.lane] + [c for c in n.allowed if abs(c - main.lane) >= 2] + list(n.allowed)
            n.lane = next((c for c in options if c in n.allowed and c not in taken and c not in near), -1)
        notes[:] = [n for n in notes if n.lane >= 0]

    # -- clean-up ----------------------------------------------------------

    def _finish(self, notes: list[Note], is_player: bool) -> list[Note]:
        g = self.grid
        notes = [n for n in notes if n.slot + n.length <= self.last_slot and (not is_player or n.slot >= self.first_slot)]
        notes.sort(key=lambda n: (n.slot, n.lane))
        # Density cap: thin the weakest taps out of any one-second window that is too full.
        window = 1.0 / g.slot_dur
        while True:
            slots = np.array([n.slot for n in notes])
            worst = None
            for i in range(len(notes)):
                inside = np.where((slots >= slots[i]) & (slots < slots[i] + window))[0]
                if len(inside) > self.plan.max_nps:
                    taps = [j for j in inside if not notes[j].length]
                    drop = min(taps, key=lambda j: (not notes[j].partner, notes[j].score, -notes[j].slot))
                    worst = drop
                    break
            if worst is None:
                break
            del notes[worst]
        return notes

    @property
    def song_values(self) -> np.ndarray:
        """Contour values of every clear onset in the song, for a stable pitch-to-lane mapping."""
        if not hasattr(self, "_song_values"):
            g = self.grid
            strong = np.where(g.eligible & (self.salience["lead"] >= 0.3))[0]
            self._song_values = np.array([g.contour(int(s)) for s in strong])
        return self._song_values


def to_chart(plan: Plan, grid: Grid, player: list[Note], rival: list[Note]) -> dict:
    def pack(notes: list[Note]) -> list[dict]:
        out = []
        for n in sorted(notes, key=lambda n: (n.slot, n.lane)):
            item = {"b": n.slot / SLOTS_PER_BEAT, "l": n.lane}
            if n.length:
                item["d"] = n.length / SLOTS_PER_BEAT
            out.append(item)
        return out

    return {
        "format": 1,
        "id": plan.chart_id,
        "title": plan.title,
        "artist": ARTIST[plan.song],
        "song": plan.song,
        "bpm": grid.bpm,
        "offset": grid.offset,
        "notes": pack(player),
        "rival": pack(rival),
        "rivalCharacter": plan.rival,
        "difficulty": plan.difficulty,
        "charter": "Berry Beats auto-charter",
    }


# ---------------------------------------------------------------------------
# Validation and reporting
# ---------------------------------------------------------------------------

def validate(chart: dict, grid: Grid, plan: Plan) -> tuple[list[str], dict]:
    """Check a chart against the rules. Returns (violations, stats)."""
    problems: list[str] = []
    beat = 60 / chart["bpm"]
    duration = grid.track.duration
    stats: dict = {}
    for side in ("notes", "rival"):
        notes = chart[side]
        times = np.array([chart["offset"] + n["b"] * beat for n in notes])
        ends = np.array([chart["offset"] + (n["b"] + n.get("d", 0)) * beat for n in notes])
        if len(notes) == 0:
            problems.append(f"{side}: empty")
            continue
        if any(abs(n["b"] * 4 - round(n["b"] * 4)) > 1e-9 for n in notes):
            problems.append(f"{side}: note off the quarter-beat grid")
        errors = np.array([np.min(np.abs(grid.all_peaks - t)) for t in times])
        if errors.max() > ONSET_TOLERANCE:
            problems.append(f"{side}: {int((errors > ONSET_TOLERANCE).sum())} notes further than 35 ms from an onset")
        if side == "notes" and times.min() < FIRST_NOTE_MIN:
            problems.append("notes: first note earlier than 2.0 s")
        if ends.max() > duration - LAST_NOTE_MARGIN + 1e-6:
            problems.append(f"{side}: last note ends less than 1.5 s before the audio does")
        by_time: dict[float, list[int]] = {}
        for n in notes:
            by_time.setdefault(n["b"], []).append(n["l"])
        doubles = sum(1 for lanes in by_time.values() if len(lanes) == 2)
        if any(len(lanes) > 2 for lanes in by_time.values()):
            problems.append(f"{side}: three or more notes at once")
        if any(len(set(lanes)) != len(lanes) for lanes in by_time.values()):
            problems.append(f"{side}: two notes in the same lane at the same time")
        if doubles and (plan.chart_id == "tutorial" or plan.no_doubles):
            problems.append(f"{side}: doubles in a chart that must not have them")
        if plan.lane_gap is not None:
            lane_gap = plan.lane_gap / SLOTS_PER_BEAT
            for lane in range(4):
                beats = sorted(n["b"] for n in notes if n["l"] == lane)
                if any(b - a < lane_gap - 1e-9 for a, b in zip(beats, beats[1:])):
                    problems.append(f"{side}: lane {lane} repeats faster than the chart allows")
                    break
        for lane in range(4):
            lane_notes = sorted((n for n in notes if n["l"] == lane), key=lambda n: n["b"])
            for a, b in zip(lane_notes, lane_notes[1:]):
                gap = b["b"] - (a["b"] + a.get("d", 0))
                if a.get("d", 0) and gap < 0.5 - 1e-9:
                    problems.append(f"{side}: lane {lane} note at beat {b['b']} too soon after a hold")
                elif b["b"] - a["b"] < 0.25 - 1e-9:
                    problems.append(f"{side}: lane {lane} notes closer than a quarter beat at beat {b['b']}")
        if any(0 < n.get("d", 0) < 1 for n in notes):
            problems.append(f"{side}: hold shorter than one beat")
        # Runs of the same lane at eighth speed or faster: notes in a row (one chord after
        # another, each at most half a beat after the last) that all use one lane.
        chords = sorted(by_time.items())
        run = [0, 0, 0, 0]
        longest = 1
        prev_beat = None
        for beat_at, lanes in chords:
            close = prev_beat is not None and beat_at - prev_beat <= 0.5
            run = [(run[lane] + 1 if close else 1) if lane in lanes else 0 for lane in range(4)]
            longest = max(longest, *run)
            prev_beat = beat_at
        if longest > 2 and len({n["l"] for n in notes}) > 1:
            problems.append(f"{side}: {longest} notes in a row in one lane at eighth speed")
        counts = [int(((times >= t) & (times < t + 1.0)).sum()) for t in times]
        bar_len = beat * BEATS_PER_BAR
        active_bars = {int(n["b"] // BEATS_PER_BAR) for n in notes} | {int((n["b"] + n["d"] - 1e-6) // BEATS_PER_BAR) for n in notes if n.get("d")}
        per_section = []
        for start in range(0, grid.bars + 1, 8):
            inside = [n for n in notes if start * BEATS_PER_BAR <= n["b"] < (start + 8) * BEATS_PER_BAR]
            per_section.append(round(len(inside) / (8 * bar_len), 2))
        if max(counts) > plan.max_nps:
            problems.append(f"{side}: {max(counts)} notes in one second (limit {plan.max_nps})")
        stats[side] = {
            "notes": len(notes),
            "taps": sum(1 for n in notes if not n.get("d")),
            "holds": sum(1 for n in notes if n.get("d")),
            "doubles": doubles,
            "lanes": [sum(1 for n in notes if n["l"] == lane) for lane in range(4)],
            "onset_error_median_ms": round(float(np.median(errors)) * 1000, 1),
            "onset_error_p95_ms": round(float(np.percentile(errors, 95)) * 1000, 1),
            "onset_error_max_ms": round(float(errors.max()) * 1000, 1),
            "max_nps": max(counts),
            "avg_nps_active": round(len(notes) / (len(active_bars) * bar_len), 2),
            "density_per_8_bars": per_section,
            "first_s": round(float(times.min()), 2),
            "last_s": round(float(ends.max()), 2),
        }
    return problems, stats


def time_domain_onsets(x: np.ndarray) -> tuple[np.ndarray, float]:
    """An onset envelope made a different way (band-passed amplitude, 1.45 ms steps) for the sync check."""
    step = 64
    sos = signal.butter(4, [150, 10000], btype="band", fs=SR, output="sos")
    env = np.abs(signal.sosfiltfilt(sos, x))
    w = int(SR * 0.004)
    kernel = np.hanning(2 * w + 1)
    env = np.convolve(env, kernel / kernel.sum(), mode="same")[::step]
    level = np.log(env + 1e-4 * env.max())
    lag = max(1, int(round(0.010 * SR / step)))
    diff = np.zeros_like(level)
    diff[lag:] = level[lag:] - level[:-lag]
    diff[diff < 0] = 0
    return diff * np.sqrt(env / env.max()), SR / step


def sync_lag(chart: dict, track: Track) -> float:
    """Lag in ms (within +/-100 ms) at which the chart's note times best line up with the audio's onsets."""
    env, fps = time_domain_onsets(track.x)
    beat = 60 / chart["bpm"]
    times = np.array(sorted({chart["offset"] + n["b"] * beat for side in ("notes", "rival") for n in chart[side]}))
    lags = np.arange(-0.100, 0.1001, 0.001)
    # The 10 ms difference used for the envelope peaks about 5 ms after the attack starts.
    scores = [env[np.clip(np.round((times + lag + 0.005) * fps).astype(int), 0, len(env) - 1)].sum() for lag in lags]
    smooth = np.convolve(scores, np.ones(5) / 5, mode="same")
    return float(lags[int(np.argmax(smooth))] * 1000)


def write_clicks(chart: dict, track: Track, path: Path) -> None:
    beat = 60 / chart["bpm"]
    out = track.x * 0.6
    click = np.sin(2 * np.pi * 1760 * np.arange(int(0.012 * SR)) / SR) * np.hanning(int(0.012 * SR)) * 0.5
    for n in chart["notes"]:
        start = int(round((chart["offset"] + n["b"] * beat) * SR))
        if start + len(click) < len(out):
            out[start : start + len(click)] += click
    data = (np.clip(out, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(data.tobytes())


def show(chart: dict, bars: int) -> None:
    """ASCII view: one row per bar, player lanes then rival lanes, sixteen slots each."""
    glyph = "<^v>"
    for bar in range(bars):
        row = []
        for side in ("notes", "rival"):
            cells = ["."] * BAR_SLOTS
            for n in chart[side]:
                s = int(round(n["b"] * SLOTS_PER_BEAT)) - bar * BAR_SLOTS
                if 0 <= s < BAR_SLOTS:
                    mark = glyph[n["l"]].upper() if n.get("d") else glyph[n["l"]]
                    if n.get("d"):
                        mark = "LUDR"[n["l"]]
                    cells[s] = "2" if cells[s] != "." else mark
                    for q in range(1, int(round(n.get("d", 0) * SLOTS_PER_BEAT))):
                        if s + q < BAR_SLOTS and cells[s + q] == ".":
                            cells[s + q] = "-"
            row.append("".join(cells))
        print(f"  {bar:2d} |{row[0]}|   |{row[1]}|")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--clicks", type=Path, help="write click-track wavs for every chart to this folder")
    parser.add_argument("--no-write", action="store_true", help="do not write chart files")
    parser.add_argument("--show", action="append", default=[], help="print an ASCII view of this chart id (repeatable, or 'all')")
    parser.add_argument("--stats", type=Path, help="write the report numbers to this JSON file")
    parser.add_argument("--only", action="append", default=[], help="build only this chart id (repeatable)")
    args = parser.parse_args()

    tracks = {name: Track(name) for name in TRACKS}
    tempos = {name: measure_tempo(tracks[name], STOP_TRACKS.get(name)) for name in TRACKS}
    lead_fast = settle_offsets(tracks, tempos)

    # Detector lead per band, measured on the loop tracks (true grid phase 0).
    lead = {"mid": lead_fast, "high": lead_fast}
    low_errs = []
    for name in LOOP_TRACKS:
        period = 60 / tempos[name].pulse_bpm / 2
        t = tracks[name].raw_peaks["low"][:, 0]
        e = (t + period / 2) % period - period / 2
        low_errs.append(np.median(e[np.abs(e) < 0.03]))
    lead["low"] = -float(np.mean(low_errs))

    print("Tempo and beat grid")
    print("  track         bpm   (pulse)  offset   drift   jitter  on-grid  8-vs-4 pulse  first sound  confidence")
    for name in TRACKS:
        t = tempos[name]
        print(
            f"  {name:12s} {t.bpm:6.2f} ({t.pulse_bpm:6.2f})  {t.offset:5.3f}s  {t.drift_ms:4.1f}ms  {t.jitter_ms:4.1f}ms"
            f"   {t.on_grid * 100:4.0f}%      {t.bar_period:+5.2f}       {tracks[name].first_transient * 1000:5.1f}ms     {t.confidence}"
        )
    print(f"  detector lead: mid/high {lead_fast * 1000:.1f} ms, low {lead['low'] * 1000:.1f} ms")

    report = {"tempo": {n: {"bpm": t.bpm, "offset": t.offset, "duration": round(tracks[n].duration, 3)} for n, t in tempos.items()}, "charts": {}}
    failed = False
    for plan in PLANS:
        if args.only and plan.chart_id not in args.only and plan.file_id not in args.only:
            continue
        track = tracks[plan.song]
        grid = Grid(track, tempos[plan.song], lead)
        player, rival = Charter(plan, grid).build()
        chart = to_chart(plan, grid, player, rival)
        problems, stats = validate(chart, grid, plan)
        lag = sync_lag(chart, track)
        if abs(lag) > 10:
            problems.append(f"sync lag {lag:.0f} ms")
        stats["sync_lag_ms"] = lag
        stats["duration"] = round(track.duration, 3)
        report["charts"][plan.file_id] = stats
        print(f"\n{plan.file_id}: {plan.title} ({plan.song}, {track.duration:.2f} s, {grid.bars} bars)")
        for side, label in (("notes", "player"), ("rival", "rival ")):
            s = stats.get(side)
            if not s:
                continue
            print(
                f"  {label}: {s['notes']} notes ({s['taps']} taps, {s['holds']} holds, {s['doubles']} doubles), lanes {s['lanes']},"
                f" {s['first_s']}s to {s['last_s']}s"
            )
            print(
                f"          onset error median {s['onset_error_median_ms']} ms, p95 {s['onset_error_p95_ms']} ms, max {s['onset_error_max_ms']} ms;"
                f" max {s['max_nps']} notes/s, average {s['avg_nps_active']} while active; per 8 bars {s['density_per_8_bars']}"
            )
        print(f"  sync lag {lag:+.0f} ms; violations: {len(problems)}")
        for p in problems:
            print(f"    ! {p}")
        failed |= bool(problems)
        if plan.file_id in args.show or "all" in args.show:
            show(chart, grid.bars)
        if not args.no_write:
            CHART_DIR.mkdir(parents=True, exist_ok=True)
            (CHART_DIR / f"{plan.file_id}.json").write_text(json.dumps(chart, separators=(",", ":")) + "\n")
        if args.clicks:
            args.clicks.mkdir(parents=True, exist_ok=True)
            write_clicks(chart, track, args.clicks / f"{plan.file_id}-clicks.wav")
    if args.stats:
        args.stats.write_text(json.dumps(report, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
