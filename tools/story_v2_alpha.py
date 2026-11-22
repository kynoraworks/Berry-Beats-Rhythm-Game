#!/usr/bin/env python3
"""Clear a soft background from a raw generation that came back without full transparency.

Run from the repo root:  python3 tools/story_v2_alpha.py TAG [THRESHOLD]

Some gpt_image_2_6 sheets (story_v2/raw/<TAG>.png) come back with a pale,
partly transparent background or a soft halo around each figure. Every pixel
less opaque than THRESHOLD (default 235) is made fully transparent, in place;
the figures themselves are fully opaque, so they are kept as drawn.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RAW = Path(__file__).resolve().parent.parent / "archive" / "generated-sprites" / "story_v2" / "raw"
tag = sys.argv[1]
threshold = int(sys.argv[2]) if len(sys.argv) > 2 else 235
path = RAW / f"{tag}.png"
pixels = np.array(Image.open(path).convert("RGBA"))
pixels[pixels[..., 3] < threshold] = 0
Image.fromarray(pixels).save(path)
print(f"{tag}: cleared {(pixels[..., 3] == 0).mean():.0%} of the sheet")
