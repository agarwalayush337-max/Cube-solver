/* Simulated-scan tests for cubelogic.js
   Run: node tests/cubelogic.test.js */
"use strict";
let seed = 12345;
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
Math.random = rand; /* deterministic random cubes */
const L = require("../cubelogic.js");
const min2phase = require("../solver.js");
function gauss() { return Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand()); }

/* Realistic sticker colours as a phone camera sees them */
const TRUE_RGB = {
    U: [225, 228, 222], R: [170, 25, 35], F: [20, 150, 80],
    D: [235, 210, 40], L: [240, 100, 30], B: [20, 70, 170]
};

let TRUE_RGB_ACTIVE = TRUE_RGB;
let NOISE = 6;
function shadeFace(rgb, light, cast) {
    return rgb.map((v, i) => Math.max(0, Math.min(255, Math.round(v * light * cast[i] + gauss() * NOISE))));
}

function simulateScan(facelets, harsh) {
    const order = L.FACES.slice().sort(() => rand() - 0.5);
    const scans = [], truthRot = [];
    order.forEach(f => {
        const i = L.FACES.indexOf(f);
        const grid = facelets.slice(i * 9, i * 9 + 9).split("");
        const r = Math.floor(rand() * 4);
        /* camera sees the face rotated; rotating it r times clockwise fixes it */
        const seen = L.rotateGrid(grid, 4 - r);
        const light = harsh ? 0.55 + rand() * 0.6 : 0.8 + rand() * 0.3;
        const cast = harsh ? [1 + (rand() - 0.5) * 0.15, 1, 1 + (rand() - 0.5) * 0.15] : [1, 1, 1];
        scans.push(seen.map(c => shadeFace(TRUE_RGB_ACTIVE[c], light, cast)));
        truthRot.push(r);
    });
    return { scans, order, truthRot };
}

/* Colours measured from a real stickerless cube on a phone camera */
const STICKERLESS_RGB = {
    U: [215, 212, 195], R: [143, 31, 24], F: [138, 229, 92],
    D: [216, 233, 76], L: [219, 77, 52], B: [70, 130, 195]
};

function run(n, harsh, useExpected, palette) {
    if (palette) TRUE_RGB_ACTIVE = palette; else TRUE_RGB_ACTIVE = TRUE_RGB;
    /* each sticker is the median of 49 camera pixels, so per-sticker noise is
       small; 6 is very pessimistic, 3 is still cautious for the dark-red cube */
    NOISE = palette ? 3 : 6;
    let ok = 0, wrong = 0, fail = 0, fixedCount = 0, multi = 0;
    const t0 = Date.now();
    for (let t = 0; t < n; t++) {
        const cube = min2phase.randomCube();
        const { scans, truthRot } = simulateScan(cube, harsh);
        const res = L.processScans(scans, useExpected ? { expectedRotByScan: truthRot } : {});
        if (!res.ok) { fail++; continue; }
        if (res.fixed.length) fixedCount++;
        if (res.solutions > 1) multi++;
        if (res.facelets === cube) ok++; else wrong++;
    }
    console.log(`${palette ? "stickerless, " : ""}${harsh ? "harsh" : "normal"} light${useExpected ? " (scan order followed)" : " (any order)"}: ${ok}/${n} exact, ${wrong} wrong, ${fail} unresolved, ${fixedCount} auto-fixed, ${multi} with >1 valid orientation, ${((Date.now() - t0) / n).toFixed(1)} ms/scan`);
    return { ok, wrong, fail };
}

/* --- unit checks --- */
function assert(c, m) { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok -", m); }

const solved = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
assert(L.validate(solved).ok, "solved cube is valid");
const rc = min2phase.randomCube();
assert(L.validate(rc).ok, "random cube is valid");

/* twist one corner: rotate the 3 stickers of URF */
const tw = rc.split("");
const [a, b, c] = L.CORNER_FACELETS[0];
[tw[a], tw[b], tw[c]] = [tw[c], tw[a], tw[b]];
const vt = L.validate(tw.join(""));
assert(!vt.ok && vt.errors.some(e => e.type === "twist"), "twisted corner detected");

/* flip one edge */
const fl = rc.split("");
const [e1, e2] = L.EDGE_FACELETS[0];
[fl[e1], fl[e2]] = [fl[e2], fl[e1]];
const vf = L.validate(fl.join(""));
assert(!vf.ok && vf.errors.some(e => e.type === "flip"), "flipped edge detected");

assert(L.cornerChiralityOk(["U", "R", "F"], ["U", "R", "F"]), "chirality: same corner ok");
assert(!L.cornerChiralityOk(["U", "R", "F"], ["U", "F", "R"]), "chirality: mirrored corner rejected");

/* hungarian sanity */
const h = L.hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]]);
assert(h.join(",") === "1,0,2", "hungarian optimal assignment");

/* --- simulated scans --- */
const N = 300;
const r1 = run(N, false, true);
const r2 = run(N, true, true);
const r3 = run(N, false, false);
const VIDEO_RGB = { U: [225, 222, 215], R: [205, 38, 28], F: [120, 225, 70],
    D: [235, 230, 60], L: [248, 63, 25], B: [60, 140, 230] };
const r6 = run(N, false, true, VIDEO_RGB);
const r4 = run(N, false, true, STICKERLESS_RGB);
const r5 = run(N, true, true, STICKERLESS_RGB);
assert(r1.wrong === 0 && r1.fail === 0, "normal light, scan order followed: every cube read exactly");
assert(r2.ok / N >= 0.98, "harsh light, scan order followed: >= 98% exact");
assert(r3.ok / N >= 0.97, "any scan order: >= 97% exact");
assert(r6.wrong === 0 && r6.ok / N >= 0.99, "cube colours from the phone video (red/orange 6° apart): >= 99% exact");
assert(r4.wrong === 0 && r4.ok / N >= 0.99, "stickerless cube, normal light: >= 99% exact");
assert(r5.wrong <= 3 && r5.ok / N >= 0.93, "stickerless cube, harsh light: >= 93% exact");

/* live preview guesses on real camera readings */
const realReadings = { B: [[66, 126, 190], [73, 133, 197]], F: [[138, 229, 92], [127, 216, 81], [145, 232, 98]],
    D: [[214, 234, 76], [218, 234, 76]], L: [[219, 77, 52], [220, 80, 56]], R: [[143, 31, 24]], U: [[216, 214, 196], [215, 210, 191]] };
Object.keys(realReadings).forEach(f => realReadings[f].forEach(rgb =>
    assert(L.guessLetter(rgb) === f, `live guess ${JSON.stringify(rgb)} -> ${L.SCHEME[f]} (got ${L.SCHEME[L.guessLetter(rgb)]})`)));
/* red and orange measured from a phone video of the same stickerless cube:
   hue ~2-4° vs ~8-14°, overlapping G:R ratios */
[[196,37,25],[218,37,31],[210,38,28],[208,34,22],[197,36,27],[211,46,33]].forEach(rgb =>
    assert(L.guessLetter(rgb) === "R", `video red ${JSON.stringify(rgb)} -> red (got ${L.SCHEME[L.guessLetter(rgb)]})`));
[[247,65,36],[239,58,20],[244,63,10],[255,58,23],[253,70,33],[255,109,78],[254,69,17]].forEach(rgb =>
    assert(L.guessLetter(rgb) === "L", `video orange ${JSON.stringify(rgb)} -> orange (got ${L.SCHEME[L.guessLetter(rgb)]})`));
assert(!L.sameColour([219, 77, 52], [143, 31, 24]), "stickerless red and orange centres are different");
assert(L.sameColour([219, 77, 52], [150, 52, 35]), "same orange centre in dimmer light counts as same");

/* --- start from any face: physical simulation of the scan moves --- */
const FACELET_POS = {
    U: [[-1,1,-1],[0,1,-1],[1,1,-1],[-1,1,0],[0,1,0],[1,1,0],[-1,1,1],[0,1,1],[1,1,1]],
    R: [[1,1,1],[1,1,0],[1,1,-1],[1,0,1],[1,0,0],[1,0,-1],[1,-1,1],[1,-1,0],[1,-1,-1]],
    F: [[-1,1,1],[0,1,1],[1,1,1],[-1,0,1],[0,0,1],[1,0,1],[-1,-1,1],[0,-1,1],[1,-1,1]],
    D: [[-1,-1,1],[0,-1,1],[1,-1,1],[-1,-1,0],[0,-1,0],[1,-1,0],[-1,-1,-1],[0,-1,-1],[1,-1,-1]],
    L: [[-1,1,-1],[-1,1,0],[-1,1,1],[-1,0,-1],[-1,0,0],[-1,0,1],[-1,-1,-1],[-1,-1,0],[-1,-1,1]],
    B: [[1,1,-1],[0,1,-1],[-1,1,-1],[1,0,-1],[0,0,-1],[-1,0,-1],[1,-1,-1],[0,-1,-1],[-1,-1,-1]]
};
const MOVES = { tilt: [[1,0,0],[0,0,1],[0,-1,0]], turn: [[0,0,-1],[0,1,0],[1,0,0]] };
const SEQ = ["tilt", "turn", "turn", "turn", "tilt"];
const mm = (A, B) => A.map(r => [0,1,2].map(j => r[0]*B[0][j] + r[1]*B[1][j] + r[2]*B[2][j]));
function randomOrientation() {
    /* random sequence of quarter turns of the whole cube */
    let Q = [[1,0,0],[0,1,0],[0,0,1]];
    const Rx = [[1,0,0],[0,0,-1],[0,1,0]], Ry = [[0,0,1],[0,1,0],[-1,0,0]];
    for (let i = 0; i < 12; i++) Q = mm(rand() < 0.5 ? Rx : Ry, Q);
    return Q;
}
/* What the camera sees: cell (row, col) lies at n + (1-row)*up + (col-1)*right */
function cameraView(cube, Q) {
    const right = Q[0], up = Q[1], n = Q[2];
    let face = null;
    for (const f of L.FACES) if (L.NORMAL[f].every((v, i) => v === n[i])) face = f;
    const out = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const p = [0,1,2].map(i => n[i] + (1 - row) * up[i] + (col - 1) * right[i]);
        const k = FACELET_POS[face].findIndex(q => q.every((v, i) => v === p[i]));
        out.push(cube[L.FACES.indexOf(face) * 9 + k]);
    }
    return { face, grid: out };
}
let anyStartOk = 0, motionsMatched = 0;
const M = 300;
TRUE_RGB_ACTIVE = STICKERLESS_RGB; NOISE = 3;
for (let t = 0; t < M; t++) {
    const cube = min2phase.randomCube();
    let Q = randomOrientation();
    const scans = [], faces = [];
    for (let k = 0; k < 6; k++) {
        const v = cameraView(cube, Q);
        faces.push(v.face);
        const light = 0.8 + rand() * 0.3;
        scans.push(v.grid.map(c => shadeFace(TRUE_RGB_ACTIVE[c], light, [1, 1, 1])));
        if (k < 5) Q = mm(MOVES[SEQ[k]], Q);
    }
    if (L.expectedRotations(faces, SEQ)) motionsMatched++;
    const res = L.processScans(scans, { motions: SEQ });
    if (res.ok && res.facelets === cube) anyStartOk++;
}
console.log(`any starting face, tilt/turn moves: ${anyStartOk}/${M} exact, moves recognised ${motionsMatched}/${M}`);
assert(motionsMatched === M, "scan moves recognised from any starting face");
assert(anyStartOk === M, "any starting face: every cube read exactly");
