#!/usr/bin/env python3
"""Build the hit layer ("lead") stem of each stop song.

The battles play a song's lead (its melody, chords and any voice) only while
someone is hitting notes, like the vocal track in Friday Night Funkin'. The game
plays the full mix as it is and, on top, the lead stem with a negative gain:
mix - (1 - open) * depth * lead. With the gate open that is exactly the full
mix; shut, the lead drops to (1 - depth) of its level. See src/core/hitLayer.ts.

So the lead must line up with the shipped mix to the sample. It is separated
from that very file:
  1. tools/stretch_songs.py (or, for the short songs of battles A and B,
     tools/sublevel_songs.py) writes public/assets/audio/<song>.mp3.
  2. Each mix is split into four stems (vocals, drums, bass, other) with
     htdemucs (Higgsfield's separate_stems, mode "four"). The stem files go in
     one folder per song: <stems>/<song>/{vocals,other,drums}.flac.
  3. This script sums the lead stems (vocals and other, see LEAD_STEMS), checks that it lines up
     with the decoded mix, and writes public/assets/audio/stems/<song>_lead.mp3
     (128 kbps, the same encoder as the mix, so both decode with the same delay).

Run from the repo root:
    python3 tools/hit_layer_stems.py STEMS_DIR             # every stop song
    python3 tools/hit_layer_stems.py STEMS_DIR berry_town  # just these

It prints, per song: the alignment lag (must be 0), the levels of the mix, the
lead and what is left with the lead out, and the true peak of the lead file.
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
AUDIO = ROOT / "public" / "assets" / "audio"
OUT = AUDIO / "stems"
SR = 44100
SONGS = [
    "berry_town", "peel_street", "graffiti_corner", "vine_crossing", "citrus_labs", "lantern_market",
    "the_club", "rooftop", "the_tunnel", "orange_plaza", "pineapple_hall", "grand_stage",
]
# The short songs of battles A and B of every stop (tools/sublevel_songs.py).
SONGS += [f"{song}_{battle}" for song in list(SONGS) for battle in "ab"]
# Stems that make up each song's lead. Most songs carry their tune in "other"
# (keys, synths, horns) plus any voice. The Tunnel is drums and bass with only a
# faint pad, so there the bass line is the tune and goes in the layer too. Bass
# is what is left of the mix once vocals, other and drums are taken out. Peel Street's
# first short song is built on its slap bass, and the Tunnel's two short songs on their
# bass lines, so those carry the hook there too.
_WITH_BASS = ("vocals", "other", "bass")
LEAD_STEMS = {"the_tunnel": _WITH_BASS, "peel_street_a": _WITH_BASS, "the_tunnel_a": _WITH_BASS, "the_tunnel_b": _WITH_BASS}
# Must match LAYER_DEPTH in src/core/hitLayer.ts: how much of the lead a shut gate takes out.
DEPTH = 0.8


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def db(x: np.ndarray) -> float:
    return float(20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12))


def write_wav(path: Path, x: np.ndarray) -> None:
    data = (np.clip(x, -1, 1) * 32767).round().astype("<i2")
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(data.tobytes())


def lag(a: np.ndarray, b: np.ndarray) -> int:
    """Offset in samples (within +-256) that best lines b up with a."""
    seg = slice(SR * 5, SR * 25)
    x, y = a[seg, 0], b[:, 0]
    best = max(range(-256, 257), key=lambda k: float(np.dot(x, y[seg.start + k : seg.stop + k])))
    return best


def build(stems: Path, song: str) -> dict:
    mix = decode(AUDIO / f"{song}.mp3")
    parts = {name: decode(stems / song / f"{name}.flac") for name in ("vocals", "other", "drums")}
    n = min(len(mix), *(len(x) for x in parts.values()))
    mix = mix[:n]
    parts = {name: x[:n] for name, x in parts.items()}
    parts["bass"] = mix - parts["vocals"] - parts["other"] - parts["drums"]
    lead = sum(parts[name] for name in LEAD_STEMS.get(song, ("vocals", "other")))
    # Check the alignment on the stems with sharp attacks: a bass line alone repeats too evenly.
    shift = lag(mix, parts["drums"] + parts["other"] + parts["vocals"])
    if shift != 0:
        raise SystemExit(f"{song}: the stems are {shift} samples off the mix")
    peak = float(np.abs(lead).max())
    if peak >= 0.99:
        raise SystemExit(f"{song}: lead stem peaks at {peak:.3f}, it would clip")
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / f"{song}_lead.mp3"
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "lead.wav"
        write_wav(wav, lead)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "128k", str(dest)], check=True)
    # What the game hears, from the two shipped files.
    shipped = decode(dest)[:n]
    if lag(lead, shipped) != 0:
        raise SystemExit(f"{song}: the encoded lead does not line up with the mix")
    shut = mix - DEPTH * shipped
    ideal = mix - DEPTH * lead
    return {
        "song": song,
        "mix_db": round(db(mix), 1),
        "lead_db": round(db(lead), 1),
        "shut_db": round(db(shut), 1),
        "drop_db": round(db(shut) - db(mix), 1),
        "encode_error_db": round(db(shut - ideal), 1),
        "lead_peak": round(peak, 3),
        "shut_peak": round(float(np.abs(shut).max()), 3),
        "kb": dest.stat().st_size // 1024,
    }


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    stems = Path(sys.argv[1])
    for song in sys.argv[2:] or SONGS:
        print(json.dumps(build(stems, song)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
