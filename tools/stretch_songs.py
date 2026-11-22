#!/usr/bin/env python3
"""Speed up the twelve generated stop songs without changing their pitch.

The songs were generated at 96 to 140 BPM, which made the early stops slow.
This script time-stretches each one from its original under
archive/music/stops-original to the tempo in TEMPOS and writes the result to
public/assets/audio/<song>.mp3, the file the game plays.

How
  1. Decode the original (ffmpeg, 44.1 kHz stereo float).
  2. Stretch with Rubber Band's R3 ("finer") engine, pitch preserved. Compared
     on Berry Town at +20% against Rubber Band R2 (the ffmpeg filter) and
     ffmpeg atempo, R3 kept the beat grid tightest (4.0 ms onset jitter against
     5.0 and 5.6 ms) with no doubled transients, which matters most for a
     rhythm game.
  3. Match the original's integrated loudness (EBU R128), then a peak limiter
     keeps the true peak under -1 dBTP.
  4. Encode 160 kbps MP3, like the originals.

Run from the repo root (needs ffmpeg and the rubberband command line tool,
`apt-get install rubberband-cli`):
    python3 tools/stretch_songs.py              # every stop song
    python3 tools/stretch_songs.py berry_town   # just these

Afterwards: separate the lead stems (tools/hit_layer_stems.py), rebuild the
charts (tools/analyze_audio.py) and copy the printed bpm/offset into
src/core/songs.ts. To roll back, copy the originals back into
public/assets/audio and restore the old tempos in analyze_audio.py.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORIGINALS = ROOT / "archive" / "music" / "stops-original"
OUT = ROOT / "public" / "assets" / "audio"

# song: (tempo it was generated at, tempo it plays at). Stretches stay within
# about +25%; Grand Stage goes to +28% so the finale is not slower than stop 11.
TEMPOS: dict[str, tuple[int, int]] = {
    "berry_town": (100, 120),
    "peel_street": (108, 126),
    "graffiti_corner": (108, 132),
    "vine_crossing": (104, 130),
    "citrus_labs": (132, 140),
    "lantern_market": (96, 120),
    "the_club": (126, 144),
    "rooftop": (104, 130),
    "the_tunnel": (140, 152),
    "orange_plaza": (128, 156),
    "pineapple_hall": (134, 160),
    "grand_stage": (117, 150),
}

TRUE_PEAK_LIMIT = -1.0  # dBTP


def loudness(path: Path) -> tuple[float, float]:
    """Integrated loudness (LUFS) and true peak (dBTP) of an audio file."""
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True,
        text=True,
        check=True,
    ).stderr
    summary = out[out.rfind("Summary:") :]
    lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    peak = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary).group(1))
    return lufs, peak


def stretch(song: str) -> dict:
    src = ORIGINALS / f"{song}.mp3"
    old, new = TEMPOS[song]
    ratio = new / old
    with tempfile.TemporaryDirectory() as tmp:
        dec = Path(tmp) / "dec.wav"
        fast = Path(tmp) / "fast.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ar", "44100", "-ac", "2", "-c:a", "pcm_f32le", str(dec)], check=True)
        subprocess.run(["rubberband", "-q", "-3", "--centre-focus", "-T", f"{ratio:.6f}", str(dec), str(fast)], check=True, capture_output=True)
        want, _ = loudness(src)
        got, _ = loudness(fast)
        gain = want - got
        # alimiter's limit is linear; it only acts on the rare peaks above it.
        limit = 10 ** (TRUE_PEAK_LIMIT / 20) * 0.97
        dest = OUT / f"{song}.mp3"
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-y", "-i", str(fast),
                "-af", f"volume={gain:.3f}dB,alimiter=limit={limit:.4f}:attack=1:release=60:level=disabled",
                "-c:a", "libmp3lame", "-b:a", "160k", str(dest),
            ],
            check=True,
        )
    lufs, peak = loudness(dest)
    return {"song": song, "from_bpm": old, "to_bpm": new, "ratio": round(ratio, 4), "lufs_original": want, "lufs": lufs, "true_peak": peak}


def main() -> int:
    songs = sys.argv[1:] or list(TEMPOS)
    for song in songs:
        print(json.dumps(stretch(song)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
