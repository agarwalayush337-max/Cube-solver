/* =========================================================
   CUBE LOGIC – colour reading, face orientation, validation
   and auto-fix for a 3x3x3 cube.

   Facelet order follows the standard (Kociemba / min2phase)
   string:  U1..U9 R1..R9 F1..F9 D1..D9 L1..L9 B1..B9

   Works in the browser (window.CubeLogic) and in Node
   (module.exports) so it can be unit-tested.
   ========================================================= */
(function (root) {
    "use strict";

    const FACES = ["U", "R", "F", "D", "L", "B"];

    /* Standard colour scheme: face letter -> sticker colour name */
    const SCHEME = { U: "white", R: "red", F: "green", D: "yellow", L: "orange", B: "blue" };

    /* Typical sRGB values of real cube stickers, only used as a
       rough guide before the real centre colours are known. */
    const REFERENCE_RGB = {
        U: [235, 235, 235],
        R: [185, 20, 30],
        F: [0, 160, 90],
        D: [250, 215, 20],
        L: [255, 105, 20],
        B: [0, 75, 190]
    };

    /* ---------- colour maths ---------- */

    function srgbToLinear(c) {
        c /= 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    function rgbToLab(rgb) {
        const r = srgbToLinear(rgb[0]), g = srgbToLinear(rgb[1]), b = srgbToLinear(rgb[2]);
        let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
        let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
        let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
        const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
        x = f(x); y = f(y); z = f(z);
        return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    }

    /* Lightness is down-weighted: the same sticker gets brighter or
       darker as the cube is turned under the light, but its hue and
       saturation stay roughly the same. */
    const L_WEIGHT = 0.5;
    function labDistance(a, b) {
        const dl = (a[0] - b[0]) * L_WEIGHT, da = a[1] - b[1], db = a[2] - b[2];
        return Math.sqrt(dl * dl + da * da + db * db);
    }

    /* "Redmean" weighted RGB distance (fast, used for live checks). */
    function redmeanDistance(c1, c2) {
        const rm = (c1[0] + c2[0]) / 2;
        const dr = c1[0] - c2[0], dg = c1[1] - c2[1], db = c1[2] - c2[2];
        return (((512 + rm) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rm) * db * db) >> 8);
    }

    /* Median of each channel – robust against glare spots and borders. */
    function medianRGB(samples) {
        if (!samples.length) return [0, 0, 0];
        const out = [];
        for (let ch = 0; ch < 3; ch++) {
            const v = samples.map(s => s[ch]).sort((a, b) => a - b);
            const m = v.length >> 1;
            out.push(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2);
        }
        return out;
    }

    /* ---------- assignment (Hungarian algorithm) ---------- */

    /* Minimum-cost perfect matching on an n x n cost matrix.
       Returns assignment[row] = column. */
    function hungarian(cost) {
        const n = cost.length;
        const INF = 1e18;
        const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
        const p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
        for (let i = 1; i <= n; i++) {
            p[0] = i;
            let j0 = 0;
            const minv = new Array(n + 1).fill(INF);
            const used = new Array(n + 1).fill(false);
            do {
                used[j0] = true;
                const i0 = p[j0];
                let delta = INF, j1 = 0;
                for (let j = 1; j <= n; j++) {
                    if (used[j]) continue;
                    const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
                    if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
                    if (minv[j] < delta) { delta = minv[j]; j1 = j; }
                }
                for (let j = 0; j <= n; j++) {
                    if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
                    else minv[j] -= delta;
                }
                j0 = j1;
            } while (p[j0] !== 0);
            do {
                const j1 = way[j0];
                p[j0] = p[j1];
                j0 = j1;
            } while (j0);
        }
        const assign = new Array(n);
        for (let j = 1; j <= n; j++) if (p[j]) assign[p[j] - 1] = j - 1;
        return assign;
    }

    function permutations(arr) {
        if (arr.length <= 1) return [arr.slice()];
        const out = [];
        arr.forEach((x, i) => {
            const rest = arr.slice(0, i).concat(arr.slice(i + 1));
            permutations(rest).forEach(p => out.push([x].concat(p)));
        });
        return out;
    }

    /* Decide which face letter each scanned centre belongs to.
       centreRgbs: array of 6 RGB values (one per scanned face).
       Returns array of 6 face letters, or null if two centres
       look like the same colour. */
    function identifyCentres(centreRgbs) {
        const labs = centreRgbs.map(rgbToLab);
        const refs = FACES.map(f => rgbToLab(REFERENCE_RGB[f]));
        let best = null, bestCost = Infinity;
        permutations([0, 1, 2, 3, 4, 5]).forEach(perm => {
            let c = 0;
            for (let i = 0; i < 6; i++) c += labDistance(labs[i], refs[perm[i]]);
            if (c < bestCost) { bestCost = c; best = perm; }
        });
        return best.map(i => FACES[i]);
    }

    /* Classify all 54 stickers.
       scans: array of 6 arrays of 9 RGB values (camera order, row by row).
       overrides (optional): scans-shaped array with a face letter or null
       for stickers the user set by hand.
       Returns { faceOfScan: [letters], letters: 6x9 letters, costs: 6x9 maps } */
    function classifyScans(scans, overrides) {
        const centreRgbs = scans.map(s => s[4]);
        const faceOfScan = identifyCentres(centreRgbs);
        const scanOfFace = {};
        faceOfScan.forEach((f, s) => { scanOfFace[f] = s; });

        /* Each face was photographed under its own lighting. Model every
           sticker as  seen = faceGain[scan] * stickerColour[colour]  (per
           RGB channel) and estimate both, alternating with the colour
           assignment. This removes per-face brightness and colour casts. */
        const EPS = 1;
        const lg = v => Math.log(Math.max(v, 0) + EPS);
        const logX = scans.map(face => face.map(rgb => rgb.map(lg)));
        let gain = scans.map(() => [0, 0, 0]);            /* log gain per scan */
        let col = {};                                      /* log colour per face letter */
        FACES.forEach(f => { col[f] = logX[scanOfFace[f]][4].slice(); });

        const slots = [];
        FACES.forEach(f => { for (let i = 0; i < 8; i++) slots.push(f); });

        let items, assign;
        const median = a => { const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
        const toRgb = l => l.map(v => Math.exp(v) - EPS);

        for (let iter = 0; iter < 4; iter++) {
            const refLab = {};
            FACES.forEach(f => { refLab[f] = rgbToLab(toRgb(col[f])); });

            items = [];
            for (let s = 0; s < 6; s++) {
                for (let k = 0; k < 9; k++) {
                    if (k === 4) continue;
                    const norm = toRgb(logX[s][k].map((v, ch) => v - gain[s][ch]));
                    const lab = rgbToLab(norm);
                    const cost = {};
                    const forced = overrides && overrides[s] && overrides[s][k];
                    FACES.forEach(f => {
                        cost[f] = forced ? (forced === f ? 0 : 1e6) : labDistance(lab, refLab[f]);
                    });
                    items.push({ s, k, cost });
                }
            }
            /* every colour must be used exactly 8 times on non-centre stickers */
            assign = hungarian(items.map(it => slots.map(f => it.cost[f])));
            if (iter === 3) break;

            /* re-estimate face gains and sticker colours from the assignment */
            const label = scans.map(() => new Array(9));
            faceOfScan.forEach((f, s) => { label[s][4] = f; });
            items.forEach((it, i) => { label[it.s][it.k] = slots[assign[i]]; });
            for (let rep = 0; rep < 3; rep++) {
                const newCol = {};
                FACES.forEach(f => {
                    newCol[f] = [0, 1, 2].map(ch => {
                        const v = [];
                        for (let s = 0; s < 6; s++) for (let k = 0; k < 9; k++) if (label[s][k] === f) v.push(logX[s][k][ch] - gain[s][ch]);
                        return median(v);
                    });
                });
                col = newCol;
                gain = scans.map((_, s) => [0, 1, 2].map(ch => {
                    const v = [];
                    for (let k = 0; k < 9; k++) v.push(logX[s][k][ch] - col[label[s][k]][ch]);
                    return median(v);
                }));
                /* fix the overall scale: average gain = 1 */
                for (let ch = 0; ch < 3; ch++) {
                    const m = gain.reduce((a, g) => a + g[ch], 0) / 6;
                    gain.forEach(g => { g[ch] -= m; });
                    FACES.forEach(f => { col[f][ch] += m; });
                }
            }
        }

        const letters = scans.map(() => new Array(9).fill(null));
        const costs = scans.map(() => new Array(9).fill(null));
        faceOfScan.forEach((f, s) => { letters[s][4] = f; });
        items.forEach((it, i) => {
            letters[it.s][it.k] = slots[assign[i]];
            costs[it.s][it.k] = it.cost;
        });
        return { faceOfScan, letters, costs };
    }

    /* Quick per-sticker guess for the live camera preview. */
    function guessLetter(rgb, knownCentres) {
        const lab = rgbToLab(rgb);
        let best = "U", bestD = Infinity;
        FACES.forEach(f => {
            const ref = (knownCentres && knownCentres[f]) ? rgbToLab(knownCentres[f]) : rgbToLab(REFERENCE_RGB[f]);
            const d = labDistance(lab, ref);
            if (d < bestD) { bestD = d; best = f; }
        });
        return best;
    }

    /* ---------- facelet geometry ---------- */

    /* 0-based facelet indices: U=0..8, R=9..17, F=18..26, D=27..35, L=36..44, B=45..53 */
    const CORNER_FACELETS = [
        [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
        [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]
    ];
    const CORNER_COLORS = [
        ["U", "R", "F"], ["U", "F", "L"], ["U", "L", "B"], ["U", "B", "R"],
        ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"]
    ];
    const EDGE_FACELETS = [
        [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
        [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]
    ];
    const EDGE_COLORS = [
        ["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"],
        ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"]
    ];
    const CORNER_NAMES = ["UFR", "UFL", "UBL", "UBR", "DFR", "DFL", "DBL", "DBR"];
    const EDGE_NAMES = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"];

    function permutationParity(p) {
        let parity = 0;
        for (let i = 0; i < p.length; i++)
            for (let j = i + 1; j < p.length; j++)
                if (p[i] > p[j]) parity ^= 1;
        return parity;
    }

    /* Full validity check of a 54-letter facelet string.
       Returns { ok, errors: [{type, message, facelets}] } */
    function validate(facelets) {
        const f = typeof facelets === "string" ? facelets.split("") : facelets;
        const errors = [];
        if (f.length !== 54) return { ok: false, errors: [{ type: "length", message: "Cube is incomplete.", facelets: [] }] };

        for (let i = 0; i < 6; i++) {
            if (f[i * 9 + 4] !== FACES[i]) {
                errors.push({ type: "centre", message: "Centre colours are not in the standard scheme.", facelets: [i * 9 + 4] });
                return { ok: false, errors };
            }
        }
        const counts = {};
        f.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
        const badCount = FACES.filter(c => counts[c] !== 9);
        if (badCount.length) {
            errors.push({
                type: "count",
                message: "Each colour must appear exactly 9 times (" + badCount.map(c => SCHEME[c] + " " + (counts[c] || 0)).join(", ") + ").",
                facelets: []
            });
            return { ok: false, errors };
        }

        const cp = new Array(8).fill(-1), co = new Array(8).fill(0);
        for (let i = 0; i < 8; i++) {
            const fl = CORNER_FACELETS[i];
            let ori = 0;
            for (; ori < 3; ori++) if (f[fl[ori]] === "U" || f[fl[ori]] === "D") break;
            if (ori === 3) {
                errors.push({ type: "corner", message: "Corner " + CORNER_NAMES[i] + " has impossible colours.", facelets: fl.slice() });
                continue;
            }
            const c1 = f[fl[(ori + 1) % 3]], c2 = f[fl[(ori + 2) % 3]];
            const j = CORNER_COLORS.findIndex(cc => cc[0] === f[fl[ori]] && cc[1] === c1 && cc[2] === c2);
            if (j < 0) {
                errors.push({ type: "corner", message: "Corner " + CORNER_NAMES[i] + " has impossible colours (wrong order or not a real piece).", facelets: fl.slice() });
                continue;
            }
            cp[i] = j; co[i] = ori % 3;
        }

        const ep = new Array(12).fill(-1), eo = new Array(12).fill(0);
        for (let i = 0; i < 12; i++) {
            const fl = EDGE_FACELETS[i];
            const a = f[fl[0]], b = f[fl[1]];
            let found = false;
            for (let j = 0; j < 12; j++) {
                if (EDGE_COLORS[j][0] === a && EDGE_COLORS[j][1] === b) { ep[i] = j; eo[i] = 0; found = true; break; }
                if (EDGE_COLORS[j][0] === b && EDGE_COLORS[j][1] === a) { ep[i] = j; eo[i] = 1; found = true; break; }
            }
            if (!found) errors.push({ type: "edge", message: "Edge " + EDGE_NAMES[i] + " has impossible colours.", facelets: fl.slice() });
        }
        if (errors.length) return { ok: false, errors };

        /* duplicates */
        const dupC = cp.filter((v, i) => cp.indexOf(v) !== i);
        const dupE = ep.filter((v, i) => ep.indexOf(v) !== i);
        if (dupC.length || dupE.length) {
            cp.forEach((v, i) => {
                if (dupC.includes(v)) errors.push({ type: "duplicate", message: "Corner " + CORNER_NAMES[v] + " appears twice.", facelets: CORNER_FACELETS[i].slice() });
            });
            ep.forEach((v, i) => {
                if (dupE.includes(v)) errors.push({ type: "duplicate", message: "Edge " + EDGE_NAMES[v] + " appears twice.", facelets: EDGE_FACELETS[i].slice() });
            });
            return { ok: false, errors };
        }

        const twist = co.reduce((a, b) => a + b, 0) % 3;
        if (twist) errors.push({ type: "twist", message: "One corner is twisted. Check corner colours.", facelets: [] });
        const flip = eo.reduce((a, b) => a + b, 0) % 2;
        if (flip) errors.push({ type: "flip", message: "One edge is flipped. Check edge colours.", facelets: [] });
        if (permutationParity(cp) !== permutationParity(ep))
            errors.push({ type: "parity", message: "Two pieces are swapped. Check the colours you entered.", facelets: [] });

        return { ok: errors.length === 0, errors, cp, co, ep, eo };
    }

    /* Quick boolean check used inside search loops. */
    function isValid(f) {
        return validate(f).ok;
    }

    /* ---------- face orientation ---------- */

    /* Rotate a 3x3 grid (row-major) 90 degrees clockwise `times` times. */
    const ROT_CW = [6, 3, 0, 7, 4, 1, 8, 5, 2];
    function rotateGrid(arr, times) {
        let res = arr.slice();
        for (let t = 0; t < ((times % 4) + 4) % 4; t++) res = ROT_CW.map(i => res[i]);
        return res;
    }

    /* Build the 54-letter string from per-face grids and rotations. */
    function buildFacelets(gridByFace, rot) {
        let s = "";
        FACES.forEach(f => { s += rotateGrid(gridByFace[f], rot[f]).join(""); });
        return s;
    }

    /* Try every rotation of every scanned face (4^6 = 4096) and return
       the valid cube that needs the fewest changes from the expected
       rotations (expectedRot[f], default 0). */
    /* Pieces that become fully known once faces 0..i (in FACES order)
       have been placed – used to reject bad rotations early. */
    const faceOfFacelet = i => Math.floor(i / 9);
    const CORNERS_DONE_AT = FACES.map(() => []);
    CORNER_FACELETS.forEach((fl, i) => { CORNERS_DONE_AT[Math.max.apply(null, fl.map(faceOfFacelet))].push(i); });
    const EDGES_DONE_AT = FACES.map(() => []);
    EDGE_FACELETS.forEach((fl, i) => { EDGES_DONE_AT[Math.max.apply(null, fl.map(faceOfFacelet))].push(i); });

    function cornerPieceOk(f, i) {
        const fl = CORNER_FACELETS[i];
        for (let ori = 0; ori < 3; ori++) {
            const a = f[fl[ori]];
            if (a !== "U" && a !== "D") continue;
            const b = f[fl[(ori + 1) % 3]], c = f[fl[(ori + 2) % 3]];
            for (let j = 0; j < 8; j++) {
                const cc = CORNER_COLORS[j];
                if (cc[0] === a && cc[1] === b && cc[2] === c) return true;
            }
            return false;
        }
        return false;
    }
    function edgePieceOk(f, i) {
        const fl = EDGE_FACELETS[i], a = f[fl[0]], b = f[fl[1]];
        for (let j = 0; j < 12; j++) {
            const e = EDGE_COLORS[j];
            if ((e[0] === a && e[1] === b) || (e[0] === b && e[1] === a)) return true;
        }
        return false;
    }

    /* Try every rotation of every scanned face (up to 4^6 = 4096,
       pruned as soon as a piece is impossible) and return the valid
       cube that needs the fewest changes from the expected rotations
       (expectedRot[f], default 0). */
    function solveOrientation(gridByFace, expectedRot) {
        expectedRot = expectedRot || {};
        let best = null, bestScore = Infinity, count = 0;
        const rot = {};
        const f = new Array(54);
        const rotated = {};
        FACES.forEach(face => { rotated[face] = [0, 1, 2, 3].map(r => rotateGrid(gridByFace[face], r)); });
        const rec = (i) => {
            if (i === 6) {
                if (isValid(f)) {
                    count++;
                    let score = 0;
                    FACES.forEach(face => { if (rot[face] !== ((expectedRot[face] || 0) % 4)) score++; });
                    if (score < bestScore) { bestScore = score; best = { facelets: f.join(""), rot: Object.assign({}, rot) }; }
                }
                return;
            }
            const face = FACES[i];
            for (let r = 0; r < 4; r++) {
                rot[face] = r;
                const g = rotated[face][r];
                for (let k = 0; k < 9; k++) f[i * 9 + k] = g[k];
                if (CORNERS_DONE_AT[i].some(c => !cornerPieceOk(f, c))) continue;
                if (EDGES_DONE_AT[i].some(e => !edgePieceOk(f, e))) continue;
                rec(i + 1);
            }
        };
        rec(0);
        if (best) best.solutions = count;
        return best;
    }

    /* ---------- full scan pipeline with auto-fix ---------- */

    /* scans: 6 x 9 RGB (camera order). expectedRotByScan: rotation the
       scan order predicts for each scan (optional). overrides: optional.
       Returns { ok, facelets, letters, faceOfScan, rotByScan, fixed: [...], errors } */
    function processScans(scans, opts) {
        opts = opts || {};
        const cls = classifyScans(scans, opts.overrides);
        const { faceOfScan, costs } = cls;
        let letters = cls.letters;

        if (new Set(faceOfScan).size !== 6) {
            return { ok: false, errors: [{ type: "centre", message: "Two faces have the same centre colour. Scan again.", facelets: [] }] };
        }

        const expected = {};
        if (opts.expectedRotByScan) faceOfScan.forEach((f, s) => { expected[f] = opts.expectedRotByScan[s] || 0; });

        const attempt = (lt) => {
            const grid = {};
            faceOfScan.forEach((f, s) => { grid[f] = lt[s]; });
            return solveOrientation(grid, expected);
        };

        let res = attempt(letters);
        let fixed = [];

        if (!res) {
            /* Swap the colours of two stickers whose readings were
               uncertain, cheapest swaps first. Swapping keeps every
               colour at exactly 9 stickers. */
            const list = [];
            for (let s = 0; s < 6; s++) for (let k = 0; k < 9; k++) if (k !== 4) list.push({ s, k });
            const pairs = [];
            for (let a = 0; a < list.length; a++) {
                for (let b = a + 1; b < list.length; b++) {
                    const A = list[a], B = list[b];
                    const la = letters[A.s][A.k], lb = letters[B.s][B.k];
                    if (la === lb) continue;
                    const ca = costs[A.s][A.k], cb = costs[B.s][B.k];
                    const extra = ca[lb] + cb[la] - ca[la] - cb[lb];
                    pairs.push({ A, B, la, lb, extra });
                }
            }
            pairs.sort((x, y) => x.extra - y.extra);
            const limit = Math.min(opts.maxSwaps || 150, pairs.length);
            for (let i = 0; i < limit && !res; i++) {
                const p = pairs[i];
                if (p.extra > 1e5) break;
                const lt = letters.map(r => r.slice());
                lt[p.A.s][p.A.k] = p.lb;
                lt[p.B.s][p.B.k] = p.la;
                const r = attempt(lt);
                if (r) {
                    res = r;
                    letters = lt;
                    fixed = [{ scan: p.A.s, index: p.A.k, from: p.la, to: p.lb }, { scan: p.B.s, index: p.B.k, from: p.lb, to: p.la }];
                }
            }
        }

        if (!res) {
            /* Not fixable automatically: report problems for the most
               likely orientation so the user can correct them. */
            const grid = {};
            faceOfScan.forEach((f, s) => { grid[f] = letters[s]; });
            const rot = {};
            FACES.forEach(f => { rot[f] = expected[f] || 0; });
            const s = buildFacelets(grid, rot);
            const v = validate(s);
            const rotByScan = faceOfScan.map(f => rot[f]);
            return { ok: false, facelets: s, letters, faceOfScan, rotByScan, fixed, errors: v.errors };
        }

        const rotByScan = faceOfScan.map(f => res.rot[f]);
        return { ok: true, facelets: res.facelets, letters, faceOfScan, rotByScan, fixed, errors: [], solutions: res.solutions };
    }

    /* ---------- piece helpers for manual painting ---------- */

    const NORMALS = {
        U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1]
    };
    function det3(a, b, c) {
        return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    /* A corner with sticker directions dirs[0..2] (face letters of the
       directions they point) and colours cols[0..2] is a real piece only
       if both triples have the same handedness. */
    function cornerChiralityOk(dirs, cols) {
        const d = det3(NORMALS[dirs[0]], NORMALS[dirs[1]], NORMALS[dirs[2]]);
        const c = det3(NORMALS[cols[0]], NORMALS[cols[1]], NORMALS[cols[2]]);
        return d !== 0 && Math.sign(d) === Math.sign(c);
    }

    const api = {
        FACES, SCHEME, REFERENCE_RGB,
        rgbToLab, labDistance, redmeanDistance, medianRGB,
        hungarian, identifyCentres, classifyScans, guessLetter,
        validate, isValid, rotateGrid, buildFacelets, solveOrientation,
        processScans, cornerChiralityOk,
        CORNER_FACELETS, EDGE_FACELETS
    };

    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.CubeLogic = api;
})(typeof self !== "undefined" ? self : this);
