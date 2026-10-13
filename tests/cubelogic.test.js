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

function shadeFace(rgb, light, cast) {
    return rgb.map((v, i) => Math.max(0, Math.min(255, Math.round(v * light * cast[i] + gauss() * 6))));
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
        scans.push(seen.map(c => shadeFace(TRUE_RGB[c], light, cast)));
        truthRot.push(r);
    });
    return { scans, order, truthRot };
}

function run(n, harsh, useExpected) {
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
    console.log(`${harsh ? "harsh" : "normal"} light${useExpected ? " (scan order followed)" : " (any order)"}: ${ok}/${n} exact, ${wrong} wrong, ${fail} unresolved, ${fixedCount} auto-fixed, ${multi} with >1 valid orientation, ${((Date.now() - t0) / n).toFixed(1)} ms/scan`);
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
assert(r1.wrong === 0 && r1.fail === 0, "normal light, scan order followed: every cube read exactly");
assert(r2.ok / N >= 0.98, "harsh light, scan order followed: >= 98% exact");
assert(r3.ok / N >= 0.97, "any scan order: >= 97% exact");
