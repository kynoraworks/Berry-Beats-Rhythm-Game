#!/usr/bin/env python3
"""Ship the short sub-level songs (battles A and B of each stop).

Each stop has three battles: A and B on short songs of their own (about a
minute, generated in the stop song's style, see archive/music/sublevels/
prompts.json), and C, the boss battle, on the stop's main song. The raw
generations are kept in archive/music/sublevels/raw. They came out at the
tempo they were asked for, so unlike tools/stretch_songs.py nothing is
stretched. This script only matches their loudness to the stretched stop
songs and writes public/assets/audio/<song>.mp3:

  1. Decode the raw generation (ffmpeg, 44.1 kHz stereo float).
  2. Set the integrated loudness to TARGET_LUFS (EBU R128), the level the
     stop songs sit at (-13.2 to -13.4 LUFS), and fade out the last second.
  3. A peak limiter keeps the true peak under -1 dBTP.
  4. Encode 160 kbps MP3, like the stop songs.

Run from the repo root:
    python3 tools/sublevel_songs.py                  # every raw song there is
    python3 tools/sublevel_songs.py berry_town_a     # just these

Afterwards: separate the lead stems (tools/hit_layer_stems.py), build the
charts (tools/analyze_audio.py) and copy the printed bpm/offset into
src/core/songs.ts.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "archive" / "music" / "sublevels" / "raw"
OUT = ROOT / "public" / "assets" / "audio"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from stretch_songs import TRUE_PEAK_LIMIT, loudness  # noqa: E402

# Aimed 0.4 dB above the stop songs (-13.3 LUFS): the fade and the limiter take about that back.
TARGET_LUFS = -12.9
FADE = 1.0  # seconds faded out at the very end


def ship(song: str) -> dict:
    src = RAW / f"{song}.mp3"
    with tempfile.TemporaryDirectory() as tmp:
        dec = Path(tmp) / "dec.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ar", "44100", "-ac", "2", "-c:a", "pcm_f32le", str(dec)], check=True)
        got, _ = loudness(dec)
        duration = float(subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dec)], capture_output=True, text=True, check=True
        ).stdout)
        limit = 10 ** (TRUE_PEAK_LIMIT / 20) * 0.97
        dest = OUT / f"{song}.mp3"
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-y", "-i", str(dec),
                "-af", f"volume={TARGET_LUFS - got:.3f}dB,afade=t=out:st={duration - FADE:.3f}:d={FADE},"
                f"alimiter=limit={limit:.4f}:attack=1:release=60:level=disabled",
                "-c:a", "libmp3lame", "-b:a", "160k", str(dest),
            ],
            check=True,
        )
    lufs, peak = loudness(dest)
    return {"song": song, "lufs_raw": got, "lufs": lufs, "true_peak": peak}


def main() -> int:
    songs = sys.argv[1:] or sorted(p.stem for p in RAW.glob("*.mp3"))
    for song in songs:
        print(json.dumps(ship(song)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
