# Rubik's Cube Solver

A browser app that scans a 3x3 cube with the phone camera (or lets you paint
the colours by hand), checks the cube is valid, and shows the solution step by
step on a 3D model.

## How scanning works

1. **Tracking grid and sampling** – the cube face is found anywhere in the camera
   view (4 evenly spaced lines each way: outer edges and the gaps between
   stickers) and the grid moves onto it, turning blue when locked. Each sticker is
   read on a 7x7 grid of points kept 20% away from its edges, and the median
   colour is used so glare spots don't spoil the reading.
2. **Auto-capture** – start with **any face**, then follow the moves on screen
   (tilt towards you, turn left ×3, tilt). A face is captured after about 1.2 s
   of steady picture; small shakes, glare and red/orange flicker don't restart
   the count, and the colours are the median over that hold (the brightest 30% of
   each sticker's samples are ignored, which removes glare). It must be a cube
   face (stickered, stickerless, or all-white once the grid has locked onto it)
   and a face you haven't
   scanned yet; after each capture, turn the cube before the next one. **UNDO**
   removes the last face. Turn **AUTO** off to use the **CAPTURE** button only.
3. **Colour matching** – after all six faces, the centre colours decide which face
   each scan is. Each face's brightness is estimated and removed, then every
   sticker is matched to a centre colour by hue, saturation and brightness (HSV –
   hue is what separates red from orange, which can be only ~5° apart on
   stickerless cubes), with the rule that each colour appears exactly 9 times
   (optimal assignment). Where the browser allows it, white balance is locked
   after the first face.
4. **Whole-piece matching** – like a real cube, every scanned corner and edge must
   be one of the 8 corners / 12 edges, each used once. Each scanned piece is scored
   against every real piece in every orientation and the best overall assignment
   is chosen; then twist, flip and parity are enforced with the cheapest changes.
   A sticker whose colour is unclear (e.g. red vs orange on stickerless cubes) is
   decided by the piece it belongs to. Stickers that were corrected glow so you can
   check them.
5. **Orientation** – each face's rotation follows from the scan moves; if the moves
   weren't followed, the plausible rotations are searched and the lowest-cost cube
   is used.

After scanning, the 3D cube turns to match how you are holding the real cube
(last scanned face towards you, same side up), so the solution moves can be
followed directly. Solving uses the min2phase two-phase algorithm in a Web Worker.

## Tests

```
node tests/cubelogic.test.js     # simulated scans: colour reading, orientation, validation
node tests/e2e.scan.js           # full app in headless Chromium with a fake camera (needs playwright)
```
