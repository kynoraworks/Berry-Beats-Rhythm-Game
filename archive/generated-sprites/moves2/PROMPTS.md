# Moves sheet extension prompts

Model gpt_image_2_6, quality high, aspect 3:2, background transparent, one
reference image per character (refs/<sheet>_ref.png: nine of the character's
own frames at 8x). Each generation is a 3x2 sheet of six poses. Raw results are
in raw/, pixelized cells in the parent folder (see tools/build_moves.py).

Common prefix (with the character description filled in):

Pixel art sprite sheet: exactly 6 poses arranged in a 3 by 2 grid (3 columns,
2 rows), of the SAME character as in the reference image: CHARACTER. Keep the
design, colours, proportions, chunky dark outline and retro 16-bit pixel art
style exactly like the reference; each figure about 48 art pixels tall, full
body, feet visible, crisp hard pixel edges. Transparent background, each pose
centred in its own equal cell with empty space around it, no overlap between
cells, no text, no numbers, no grid lines, no floor shadow. Poses in reading
order (top row left to right, then bottom row):
