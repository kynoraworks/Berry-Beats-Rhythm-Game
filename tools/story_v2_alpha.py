#!/usr/bin/env python3
"""Clear a soft background from a raw generation that came back without full transparency.

Run from the repo root:  python3 tools/story_v2_alpha.py TAG [THRESHOLD]

Some gpt_image_2_6 sheets (story_v2/raw/<TAG>.png) come back with a pale,
partly transparent background or a soft halo around each figure. Every pixel
less opaque than THRESHOLD (default 235) is made fully transparent, in place;
the figures themselves are fully opaque, so they are kept as drawn.

  python3 tools/story_v2_alpha.py TAG --key

For a sheet that came back with the whole image slightly transparent and a
near-white background: the pale background is flood-filled from the sheet's
edges (pixels whose darkest channel is above 222) and cleared, and everything
else is made fully opaque, so white details inside a figure are kept.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RAW = Path(__file__).resolve().parent.parent / "archive" / "generated-sprites" / "story_v2" / "raw"
tag = sys.argv[1]
path = RAW / f"{tag}.png"
pixels = np.array(Image.open(path).convert("RGBA"))
if len(sys.argv) > 2 and sys.argv[2] == "--key":
    from scipy import ndimage
    pale = (pixels[..., :3].min(axis=2) > 222) | (pixels[..., 3] < 60)
    labels, _ = ndimage.label(pale)
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    background = np.isin(labels, list(edge))
    pixels[..., 3] = 255
    pixels[background] = 0
else:
    threshold = int(sys.argv[2]) if len(sys.argv) > 2 else 235
    pixels[pixels[..., 3] < threshold] = 0
Image.fromarray(pixels).save(path)
print(f"{tag}: cleared {(pixels[..., 3] == 0).mean():.0%} of the sheet")
