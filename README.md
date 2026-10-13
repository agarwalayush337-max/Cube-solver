# Rubik's Cube Solver

A browser app that scans a 3x3 cube with the phone camera (or lets you paint
the colours by hand), checks the cube is valid, and shows the solution step by
step on a 3D model.

## How scanning works

1. **Sampling** – each sticker is read on a 7x7 grid of points kept 20% away from
   its edges (so the black plastic is ignored), and the median colour is used so
   glare spots don't spoil the reading.
2. **Auto-capture** – start with **any face**, then follow the moves on screen
   (tilt towards you, turn left ×3, tilt). A face is captured after about 1.2 s
   of steady picture with unchanging colours; the colours are averaged over that
   hold. It must be a cube face (stickered or stickerless) and a face you haven't
   scanned yet; after each capture, turn the cube before the next one. **UNDO**
   removes the last face. Tap a dot to set its colour by hand; turn **AUTO** off
   to use the **CAPTURE** button only.
3. **Colour matching** – after all six faces, the centre colours decide which face
   each scan is. Each face's brightness and colour cast is estimated and removed,
   then every sticker is matched to a centre colour with the rule that each colour
   appears exactly 9 times (optimal assignment).
4. **Orientation** – every rotation of every face is tried, and the combination
   that forms a real, solvable cube is used, so small mistakes in how the cube is
   held don't matter.
5. **Validation and auto-fix** – corners, edges, twist, flip and parity are
   checked. If the reading is impossible, uncertain stickers are swapped to find a
   valid cube; corrected stickers glow so you can check them. Problems that can't
   be fixed automatically are explained, with the stickers involved glowing.

After scanning, the 3D cube turns to match how you are holding the real cube
(last scanned face towards you, same side up), so the solution moves can be
followed directly. Solving uses the min2phase two-phase algorithm in a Web Worker.

## Tests

```
node tests/cubelogic.test.js     # simulated scans: colour reading, orientation, validation
node tests/e2e.scan.js           # full app in headless Chromium with a fake camera (needs playwright)
```
