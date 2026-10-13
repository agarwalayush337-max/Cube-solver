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

    /* Typical camera readings of real cube colours, only used as a rough
       guide before the real centre colours are known. Several variants per
       colour: classic stickered cubes and bright stickerless cubes (lime
       green, sky blue, red-orange "orange", dark red "red"). */
    const PROTOTYPES = {
        U: [[235, 235, 235], [215, 212, 195], [200, 205, 210]],
        R: [[185, 20, 30], [143, 31, 24], [200, 35, 45], [160, 20, 50]],
        F: [[0, 160, 90], [138, 229, 92], [40, 180, 70]],
        D: [[250, 215, 20], [216, 233, 76], [240, 225, 60]],
        L: [[255, 105, 20], [219, 77, 52], [245, 130, 40]],
        B: [[0, 75, 190], [70, 130, 195], [30, 90, 200]]
    };
    const REFERENCE_RGB = { U: PROTOTYPES.U[0], R: PROTOTYPES.R[0], F: PROTOTYPES.F[0], D: PROTOTYPES.D[0], L: PROTOTYPES.L[0], B: PROTOTYPES.B[0] };
    const PROTO_LAB = {};
    Object.keys(PROTOTYPES).forEach(f => { PROTO_LAB[f] = PROTOTYPES[f].map(c => rgbToLabRaw(c)); });

    /* ---------- colour maths ---------- */

    function srgbToLinear(c) {
        c /= 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    function rgbToLab(rgb) { return rgbToLabRaw(rgb); }
    function rgbToLabRaw(rgb) {
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

    /* Feature used to match stickers: the share of red and green in the
       camera values (does not change with brightness) plus a little
       lightness. Separates colours that differ mainly in the R:G:B ratio,
       e.g. dark red vs red-orange on stickerless cubes. */
    function stickerFeature(rgb) {
        return rgbToHsv(rgb);
    }
    function featureDistance(a, b) {
        return hsvDistance(a, b);
    }

    /* HSV of camera values: hue in degrees, saturation and value 0..1.
       Hue does not change with brightness, and it is what separates red
       (hue ~2-4°) from orange (~8-14°) on stickerless cubes, where their
       G:R ratios overlap. */
    function rgbToHsv(rgb) {
        const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        let h = 0;
        if (d > 1e-6) {
            if (max === r) h = ((g - b) / d) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
            if (h < 0) h += 360;
        }
        return [h, max === 0 ? 0 : d / max, max];
    }
    /* Hue difference counts in proportion to saturation (grey/white has no
       meaningful hue); saturation separates white from coloured stickers;
       value (brightness) counts a little. */
    function hsvDistance(a, b) {
        let dh = Math.abs(a[0] - b[0]);
        if (dh > 180) dh = 360 - dh;
        const s = Math.min(a[1], b[1]);
        return Math.hypot(dh * 2.5 * s, (a[1] - b[1]) * 120, (a[2] - b[2]) * 40);
    }

    /* ---------- reading a camera image of one face ---------- */

    /* img: RGBA bytes of a size x size crop of the guide square.
       Each sticker is sampled on a 7x7 grid kept 20% away from its edges;
       the median colour ignores borders and glare.
       looksLikeCube is true when the square really shows a cube face:
       either dark gaps/plastic between most stickers (stickered cubes), or
       nine even patches that are all cube colours with at least two
       clearly coloured ones (stickerless cubes have only hairline gaps). */
    function analyzeFaceImage(img, size) {
        const INSET = 0.2, N = 7;
        const cell = size / 3;
        const lumAt = (x, y) => {
            const p = (Math.round(Math.min(size - 1, Math.max(0, y))) * size + Math.round(Math.min(size - 1, Math.max(0, x)))) * 4;
            return 0.299 * img[p] + 0.587 * img[p + 1] + 0.114 * img[p + 2];
        };
        const cells = [], spreads = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const x0 = col * cell + cell * INSET, x1 = (col + 1) * cell - cell * INSET;
                const y0 = row * cell + cell * INSET, y1 = (row + 1) * cell - cell * INSET;
                const samples = [];
                for (let i = 0; i < N; i++) {
                    for (let j = 0; j < N; j++) {
                        const x = Math.round(x0 + (x1 - x0) * i / (N - 1));
                        const y = Math.round(y0 + (y1 - y0) * j / (N - 1));
                        const p = (y * size + x) * 4;
                        samples.push([img[p], img[p + 1], img[p + 2]]);
                    }
                }
                const med = medianRGB(samples);
                cells.push(med);
                /* how even the sticker is: median absolute deviation of luminance */
                const lum = samples.map(c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]).sort((a, b) => a - b);
                const m = lum[lum.length >> 1];
                const dev = lum.map(v => Math.abs(v - m)).sort((a, b) => a - b);
                spreads.push(dev[dev.length >> 1]);
            }
        }

        /* dark borders between neighbouring stickers */
        const cellLum = cells.map(c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);
        const reach = cell * 0.15;
        let darkBorders = 0;
        for (let line = 1; line <= 2; line++) {
            const L0 = line * cell;
            for (let k = 0; k < 3; k++) {
                const mid0 = k * cell + cell * 0.3, mid1 = (k + 1) * cell - cell * 0.3;
                let minV = Infinity, minH = Infinity;
                for (let d = -reach; d <= reach; d += 1) {
                    const colV = [], colH = [];
                    for (let t = mid0; t <= mid1; t += 3) { colV.push(lumAt(L0 + d, t)); colH.push(lumAt(t, L0 + d)); }
                    colV.sort((a, b) => a - b); colH.sort((a, b) => a - b);
                    minV = Math.min(minV, colV[colV.length >> 1]);
                    minH = Math.min(minH, colH[colH.length >> 1]);
                }
                if (minV < 0.7 * Math.min(cellLum[k * 3 + line - 1], cellLum[k * 3 + line])) darkBorders++;
                if (minH < 0.7 * Math.min(cellLum[(line - 1) * 3 + k], cellLum[line * 3 + k])) darkBorders++;
            }
        }

        let cubeColoured = 0, even = 0, chromatic = 0;
        cells.forEach((c, i) => {
            if (nearestCubeColourDistance(c) < 28) cubeColoured++;
            if (spreads[i] < 14) even++;
            const lab = rgbToLab(c);
            if (Math.hypot(lab[1], lab[2]) > 30) chromatic++;
        });
        const bright = Math.max.apply(null, cellLum) >= 40;
        const looksLikeCube = bright && (
            (darkBorders >= 6 && cubeColoured >= 7) ||
            (cubeColoured >= 8 && even >= 7 && chromatic >= 2));
        return { cells, looksLikeCube, darkBorders, cubeColoured, even, chromatic, spreads };
    }

    /* ---------- finding the cube face in the camera picture ---------- */

    /* img: RGBA bytes of a W x H picture. A 3x3 face shows as 4 evenly
       spaced lines in each direction (the outer edges and the gaps between
       stickers), with flat colour in between. Colour edges are summed into
       column and row profiles, and the best evenly spaced set of 4 peaks
       (with low values half-way between them) is found, using the same
       spacing horizontally and vertically.
       Returns { x, y, size, score } in picture pixels, or null. */
    function detectFaceGrid(img, W, H) {
        const gx = new Float32Array(W * H), gy = new Float32Array(W * H);
        const at = (x, y) => (y * W + x) * 4;
        for (let y = 1; y < H - 1; y++) {
            for (let x = 1; x < W - 1; x++) {
                const l = at(x - 1, y), r = at(x + 1, y), u = at(x, y - 1), d = at(x, y + 1);
                gx[y * W + x] = Math.abs(img[r] - img[l]) + Math.abs(img[r + 1] - img[l + 1]) + Math.abs(img[r + 2] - img[l + 2]);
                gy[y * W + x] = Math.abs(img[d] - img[u]) + Math.abs(img[d + 1] - img[u + 1]) + Math.abs(img[d + 2] - img[u + 2]);
            }
        }
        const profile = (g, along, y0, y1, horizontal) => {
            const p = new Float32Array(along);
            for (let a = 0; a < along; a++) {
                let sum = 0;
                for (let b = y0; b < y1; b++) sum += horizontal ? g[b * W + a] : g[a * W + b];
                p[a] = sum / Math.max(1, y1 - y0);
            }
            return p;
        };
        const peak = (p, v) => {
            const i = Math.round(v);
            let m = 0;
            for (let d = -1; d <= 1; d++) if (i + d >= 0 && i + d < p.length) m = Math.max(m, p[i + d]);
            return m;
        };
        const val = (p, v) => { const i = Math.round(v); return i >= 0 && i < p.length ? p[i] : 0; };
        /* best start for a given spacing: strong lines, flat stickers */
        const bestStart = (p, s) => {
            let best = -Infinity, bx = 0;
            for (let x0 = 0; x0 + 3 * s < p.length; x0++) {
                let line = 0, mid = 0;
                for (let k = 0; k < 4; k++) line += peak(p, x0 + k * s);
                for (let k = 0; k < 3; k++) mid += val(p, x0 + (k + 0.5) * s);
                const sc = line / 4 - mid / 3;
                if (sc > best) { best = sc; bx = x0; }
            }
            return { x0: bx, score: best };
        };
        const minS = Math.floor(Math.min(W, H) * 0.11), maxS = Math.floor(Math.min(W, H) * 0.33);
        const search = (px, py) => {
            let best = null;
            for (let s = minS; s <= maxS; s++) {
                const bx = bestStart(px, s), by = bestStart(py, s);
                const sc = bx.score + by.score;
                if (!best || sc > best.score) best = { x: bx.x0, y: by.x0, s, score: sc };
            }
            return best;
        };
        /* pass 1: whole picture; pass 2: profiles limited to the face found */
        let g = search(profile(gx, W, 0, H, true), profile(gy, H, 0, W, false));
        if (!g) return null;
        const y0 = Math.max(0, g.y), y1 = Math.min(H, g.y + 3 * g.s), x0 = Math.max(0, g.x), x1 = Math.min(W, g.x + 3 * g.s);
        const g2 = search(profile(gx, W, y0, y1, true), profile(gy, H, x0, x1, false));
        if (g2) g = g2;
        /* how much the lines stand out from the picture's average edges */
        let mean = 0;
        for (let i = 0; i < W * H; i++) mean += gx[i] + gy[i];
        mean /= (2 * W * H);
        return { x: g.x, y: g.y, size: 3 * g.s, score: g.score / Math.max(1, mean) };
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
        return rankCentreIdentities(centreRgbs, 1)[0];
    }

    /* All ways of naming the 6 centres, most likely first (top `k`). */
    function rankCentreIdentities(centreRgbs, k) {
        const cost = centreRgbs.map(rgb => { const h = rgbToHsv(rgb); return FACES.map(f => protoDistanceHsv(h, f)); });
        return permutations([0, 1, 2, 3, 4, 5])
            .map(perm => ({ perm, c: perm.reduce((a, p, i) => a + cost[i][p], 0) }))
            .sort((a, b) => a.c - b.c)
            .slice(0, k)
            .map(x => x.perm.map(i => FACES[i]));
    }

    /* Distance from a colour to the nearest prototype of face colour f. */
    function protoDistanceHsv(hsv, f) {
        let d = Infinity;
        PROTOTYPES[f].forEach(p => { d = Math.min(d, hsvDistance(hsv, rgbToHsv(p))); });
        return d;
    }
    function protoDistanceLab(lab, f) {
        let d = Infinity;
        PROTO_LAB[f].forEach(p => { d = Math.min(d, labDistance(lab, p)); });
        return d;
    }

    /* Distance to the closest cube colour of any kind (used to check that
       the camera is really looking at stickers). */
    function nearestCubeColourDistance(rgb) {
        const lab = rgbToLab(rgb);
        return Math.min.apply(null, FACES.map(f => protoDistanceLab(lab, f)));
    }

    /* Brightness-independent colour: chromaticity of linear RGB. */
    function chromaticity(rgb) {
        const l = rgb.map(srgbToLinear);
        const s = l[0] + l[1] + l[2] + 1e-6;
        return [l[0] / s, l[1] / s];
    }

    /* Nearly identical colour (the same centre seen again)? Compared by
       hue, which brightness doesn't change. Deliberately strict: red and
       orange on stickerless cubes are only ~5° of hue apart; "not sure"
       is treated as "different". White/grey has no reliable hue, so two
       unsaturated colours count as the same. */
    function sameColour(rgbA, rgbB) {
        const a = rgbToHsv(rgbA), b = rgbToHsv(rgbB);
        const GREY = 0.25;
        if (a[1] < GREY || b[1] < GREY) return a[1] < GREY && b[1] < GREY;
        let dh = Math.abs(a[0] - b[0]);
        if (dh > 180) dh = 360 - dh;
        return dh < 2 && Math.abs(a[1] - b[1]) < 0.1;
    }

    /* Classify all 54 stickers.
       scans: array of 6 arrays of 9 RGB values (camera order, row by row).
       overrides (optional): scans-shaped array with a face letter or null
       for stickers the user set by hand.
       Returns { faceOfScan: [letters], letters: 6x9 letters, costs: 6x9 maps } */
    function classifyScans(scans, overrides, faceOfScanGiven) {
        const centreRgbs = scans.map(s => s[4]);
        const faceOfScan = faceOfScanGiven || identifyCentres(centreRgbs);
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
            const refFeat = {};
            FACES.forEach(f => { refFeat[f] = stickerFeature(toRgb(col[f])); });

            items = [];
            for (let s = 0; s < 6; s++) {
                for (let k = 0; k < 9; k++) {
                    if (k === 4) continue;
                    const norm = toRgb(logX[s][k].map((v, ch) => v - gain[s][ch]));
                    const feat = stickerFeature(norm);
                    const cost = {};
                    const forced = overrides && overrides[s] && overrides[s][k];
                    FACES.forEach(f => {
                        cost[f] = forced ? (forced === f ? 0 : 1e6) : featureDistance(feat, refFeat[f]);
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
                /* per face: overall brightness, plus only a small colour cast
                   (max ~10% per channel) so red can't be "explained" as
                   darkened orange */
                const MAX_CAST = 0;   /* brightness only: never shifts hue */
                gain = scans.map((_, s) => {
                    const g = [0, 1, 2].map(ch => {
                        const v = [];
                        for (let k = 0; k < 9; k++) v.push(logX[s][k][ch] - col[label[s][k]][ch]);
                        return median(v);
                    });
                    const bright = (g[0] + g[1] + g[2]) / 3;
                    return g.map(x => bright + Math.max(-MAX_CAST, Math.min(MAX_CAST, x - bright)));
                });
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
        const hsv = rgbToHsv(rgb);
        let best = "U", bestD = Infinity;
        FACES.forEach(f => {
            /* the real centre of this cube is the best reference once scanned */
            const d = (knownCentres && knownCentres[f])
                ? hsvDistance(hsv, rgbToHsv(knownCentres[f])) * 0.8
                : protoDistanceHsv(hsv, f);
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

    /* ---------- following the cube through the scan moves ---------- */

    /* Camera frame: X = image right, Y = image up, Z = towards the camera.
       Cube frame:   R = +x, U = +y, F = +z.
       Moves the user makes between scans (as rotations in camera frame): */
    const MOVES = {
        tilt: [[1, 0, 0], [0, 0, 1], [0, -1, 0]],   /* bottom face comes to the camera */
        turn: [[0, 0, -1], [0, 1, 0], [1, 0, 0]]    /* right face comes to the camera  */
    };
    const NORMAL = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
    /* "up" of each face in the standard facelet layout */
    const LAYOUT_UP = { U: [0, 0, -1], D: [0, 0, 1], R: [0, 1, 0], F: [0, 1, 0], L: [0, 1, 0], B: [0, 1, 0] };

    const matMul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    const neg = a => a.map(v => -v);

    /* all 24 orientations of a cube */
    const ORIENTATIONS = (() => {
        const out = [];
        permutations([0, 1, 2]).forEach(p => {
            for (let sgn = 0; sgn < 8; sgn++) {
                const M = [0, 1, 2].map(i => [0, 1, 2].map(j => (j === p[i] ? ((sgn >> i) & 1 ? -1 : 1) : 0)));
                const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
                if (det === 1) out.push(M);
            }
        });
        return out;
    })();

    /* The grid rotation (0..3 clockwise turns) that maps what the camera
       saw onto the standard layout, given the cube direction that was at
       the top of the image. */
    function rotationForUp(face, imageUp) {
        const up = LAYOUT_UP[face];
        const right = cross(neg(NORMAL[face]), up);
        if (eq(imageUp, up)) return 0;
        if (eq(imageUp, right)) return 1;
        if (eq(imageUp, neg(up))) return 2;
        if (eq(imageUp, neg(right))) return 3;
        return 0;
    }
    /* Inverse: which cube direction is at the top of the image for a face
       scanned with grid rotation `rot` (used to orient the 3D view). */
    function imageUpFor(face, rot) {
        const up = LAYOUT_UP[face], right = cross(neg(NORMAL[face]), up);
        return [up, right, neg(up), neg(right)][((rot % 4) + 4) % 4];
    }

    /* Given which face each scan showed and the moves made between scans
       (e.g. ["tilt","turn","turn","turn","tilt"]), find how the cube was
       held at the start and return the grid rotation of every scan.
       Works whatever face the user starts with. Returns null if the scans
       don't fit the moves (the user scanned in some other way). */
    function expectedRotations(faceOfScan, motions) {
        for (const Q0 of ORIENTATIONS) {
            let Q = Q0, ok = true;
            const rots = [];
            for (let k = 0; k < faceOfScan.length; k++) {
                /* rows of Q are the camera axes expressed in cube coordinates */
                if (!eq(Q[2], NORMAL[faceOfScan[k]])) { ok = false; break; }
                rots.push(rotationForUp(faceOfScan[k], Q[1]));
                if (k < motions.length) Q = matMul(MOVES[motions[k]], Q);
            }
            if (ok) return rots;
        }
        return null;
    }

    /* ---------- piece-based matching (whole corners and edges) ---------- */

    /* C: 54 cost maps (C[i][colour] = how unlike that colour sticker i is).
       Each scanned corner/edge position is matched to a real piece and
       orientation as a whole, every real piece used exactly once (optimal
       assignment). Then the cube rules are enforced with the cheapest
       changes: corner twist, edge flip and permutation parity.
       Always returns a valid cube and its total cost. */
    function pieceSolve(C) {
        const cc = (i, j, o) => {
            const fl = CORNER_FACELETS[i], col = CORNER_COLORS[j];
            return C[fl[o % 3]][col[0]] + C[fl[(o + 1) % 3]][col[1]] + C[fl[(o + 2) % 3]][col[2]];
        };
        const ec = (i, j, o) => {
            const fl = EDGE_FACELETS[i], col = EDGE_COLORS[j];
            return o ? C[fl[0]][col[1]] + C[fl[1]][col[0]] : C[fl[0]][col[0]] + C[fl[1]][col[1]];
        };
        const cornerCost = [], cornerOri = [];
        for (let i = 0; i < 8; i++) {
            cornerCost.push([]); cornerOri.push([]);
            for (let j = 0; j < 8; j++) {
                let best = Infinity, bo = 0;
                for (let o = 0; o < 3; o++) { const v = cc(i, j, o); if (v < best) { best = v; bo = o; } }
                cornerCost[i].push(best); cornerOri[i].push(bo);
            }
        }
        const edgeCost = [], edgeOri = [];
        for (let i = 0; i < 12; i++) {
            edgeCost.push([]); edgeOri.push([]);
            for (let j = 0; j < 12; j++) {
                const a = ec(i, j, 0), b = ec(i, j, 1);
                edgeCost[i].push(Math.min(a, b)); edgeOri[i].push(a <= b ? 0 : 1);
            }
        }
        const cp = hungarian(cornerCost), ep = hungarian(edgeCost);

        /* complete a permutation choice: best orientations, then fix twist and flip */
        const complete = (cp, ep) => {
            const co = cp.map((j, i) => cornerOri[i][j]), eo = ep.map((j, i) => edgeOri[i][j]);
            let cost = 0;
            cp.forEach((j, i) => { cost += cc(i, j, co[i]); });
            ep.forEach((j, i) => { cost += ec(i, j, eo[i]); });
            const tw = co.reduce((a, b) => a + b, 0) % 3;
            if (tw) {
                let bi = -1, bd = Infinity, bo = 0;
                for (let i = 0; i < 8; i++) {
                    for (const no of [(co[i] + 1) % 3, (co[i] + 2) % 3]) {
                        const t2 = (tw - co[i] + no + 3) % 3;
                        if (t2 !== 0) continue;
                        const d = cc(i, cp[i], no) - cc(i, cp[i], co[i]);
                        if (d < bd) { bd = d; bi = i; bo = no; }
                    }
                }
                co[bi] = bo; cost += bd;
            }
            if (eo.reduce((a, b) => a + b, 0) % 2) {
                let bi = -1, bd = Infinity;
                for (let i = 0; i < 12; i++) {
                    const d = ec(i, ep[i], 1 - eo[i]) - ec(i, ep[i], eo[i]);
                    if (d < bd) { bd = d; bi = i; }
                }
                eo[bi] = 1 - eo[bi]; cost += bd;
            }
            return { cp, co, ep, eo, cost };
        };

        let best = complete(cp.slice(), ep.slice());
        if (permutationParity(cp) !== permutationParity(ep)) {
            /* swap two corners or two edges – whichever costs least */
            best = null;
            for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
                const c2 = cp.slice(); [c2[a], c2[b]] = [c2[b], c2[a]];
                const r = complete(c2, ep.slice());
                if (!best || r.cost < best.cost) best = r;
            }
            for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) {
                const e2 = ep.slice(); [e2[a], e2[b]] = [e2[b], e2[a]];
                const r = complete(cp.slice(), e2);
                if (r.cost < best.cost) best = r;
            }
        }

        const f = new Array(54);
        for (let i = 0; i < 6; i++) f[i * 9 + 4] = FACES[i];
        best.cp.forEach((j, i) => { for (let k = 0; k < 3; k++) f[CORNER_FACELETS[i][(best.co[i] + k) % 3]] = CORNER_COLORS[j][k]; });
        best.ep.forEach((j, i) => {
            const fl = EDGE_FACELETS[i], col = EDGE_COLORS[j];
            if (best.eo[i]) { f[fl[0]] = col[1]; f[fl[1]] = col[0]; } else { f[fl[0]] = col[0]; f[fl[1]] = col[1]; }
        });
        return { facelets: f.join(""), cost: best.cost };
    }

    /* Rotation combinations worth a full piece match: each sticker may be
       its best or second-best colour, and at most 2 pieces may look
       impossible. Pruned search, so it is fast. */
    function plausibleRotations(costGrid) {
        const top2 = {};
        FACES.forEach(f => {
            top2[f] = [0, 1, 2, 3].map(r => rotateGrid(costGrid[f], r).map(c => {
                const ord = FACES.slice().sort((a, b) => c[a] - c[b]);
                return [ord[0], ord[1]];
            }));
        });
        const cand = new Array(54);
        const has = (i, col) => cand[i][0] === col || cand[i][1] === col;
        const cornerOk = i => {
            const fl = CORNER_FACELETS[i];
            for (let j = 0; j < 8; j++) for (let o = 0; o < 3; o++)
                if (has(fl[o], CORNER_COLORS[j][0]) && has(fl[(o + 1) % 3], CORNER_COLORS[j][1]) && has(fl[(o + 2) % 3], CORNER_COLORS[j][2])) return true;
            return false;
        };
        const edgeOk = i => {
            const fl = EDGE_FACELETS[i];
            for (let j = 0; j < 12; j++) {
                const e = EDGE_COLORS[j];
                if ((has(fl[0], e[0]) && has(fl[1], e[1])) || (has(fl[0], e[1]) && has(fl[1], e[0]))) return true;
            }
            return false;
        };
        const out = [], rot = {};
        const rec = (i, bad) => {
            if (i === 6) { out.push(Object.assign({}, rot)); return; }
            const f = FACES[i];
            for (let r = 0; r < 4; r++) {
                rot[f] = r;
                top2[f][r].forEach((t, k) => { cand[i * 9 + k] = t; });
                let b = bad;
                CORNERS_DONE_AT[i].forEach(c => { if (!cornerOk(c)) b++; });
                EDGES_DONE_AT[i].forEach(e => { if (!edgeOk(e)) b++; });
                if (b <= 2) rec(i + 1, b);
            }
        };
        rec(0, 0);
        return out.length ? out : [{ U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 }];
    }

    /* Run piece matching for one naming of the centres; try the grid
       rotations predicted by the scan moves, or all 4^6 if unknown. */
    function pieceProcess(scans, opts, faceOfScan) {
        const cls = classifyScans(scans, opts.overrides, faceOfScan);
        const costGrid = {};
        faceOfScan.forEach((f, s) => {
            costGrid[f] = cls.costs[s].map((c, k) => {
                if (k !== 4) return c;
                const o = {}; FACES.forEach(x => { o[x] = x === f ? 0 : 1e3; }); return o;
            });
        });
        let rotSets;
        const exp = opts.expectedRotByScan || (opts.motions ? expectedRotations(faceOfScan, opts.motions) : null);
        if (exp) {
            const r = {}; faceOfScan.forEach((f, s) => { r[f] = exp[s] || 0; });
            rotSets = [r];
        } else {
            rotSets = plausibleRotations(costGrid);
        }
        let best = null;
        for (const rot of rotSets) {
            const C = [];
            FACES.forEach(f => { rotateGrid(costGrid[f], rot[f]).forEach(c => C.push(c)); });
            const r = pieceSolve(C);
            if (!best || r.cost < best.cost) best = { facelets: r.facelets, cost: r.cost, rot: Object.assign({}, rot), C };
        }
        /* stickers whose final colour is not their own best guess (shown glowing) */
        const fixed = [];
        for (let i = 0; i < 54; i++) {
            if (i % 9 === 4) continue;
            const c = best.C[i];
            let arg = null, v = Infinity;
            FACES.forEach(x => { if (c[x] < v) { v = c[x]; arg = x; } });
            if (arg !== best.facelets[i]) fixed.push({ facelet: i, from: arg, to: best.facelets[i] });
        }
        return {
            ok: true, facelets: best.facelets, cost: best.cost, faceOfScan,
            rotByScan: faceOfScan.map(f => best.rot[f]), fixed, errors: [], solutions: 1,
            letters: cls.letters
        };
    }

    /* ---------- full scan pipeline with auto-fix ---------- */

    /* scans: 6 x 9 RGB (camera order). expectedRotByScan: rotation the
       scan order predicts for each scan (optional). overrides: optional.
       Returns { ok, facelets, letters, faceOfScan, rotByScan, fixed: [...], errors } */
    function processScans(scans, opts) {
        opts = opts || {};
        const centres = scans.map(s => s[4]);
        /* a face scanned twice is only reported if no valid cube is found */
        let duplicate = false;
        for (let a = 0; a < 6; a++)
            for (let b = a + 1; b < 6; b++)
                if (sameColour(centres[a], centres[b])) duplicate = true;

        /* Most likely naming of the centres first; similar colours (e.g. red
           and orange on stickerless cubes) may need the second choice. The
           valid cube decides. User-set centre colours are respected. */
        const ov = opts.overrides;
        const ids = rankCentreIdentities(centres, 720)
            .filter(perm => !ov || perm.every((f, s) => !(ov[s] && ov[s][4]) || ov[s][4] === f))
            .slice(0, 6);
        if (!ids.length) return { ok: false, errors: [{ type: "centre", message: "The centre colours you set by hand are not all different.", facelets: [] }] };
        /* Like ASolver's Mapper: match whole pieces, keep the naming of the
           centres (and grid rotations) with the lowest total cost. */
        let best = null;
        const tryIds = (opts.expectedRotByScan || opts.motions) ? ids : ids.slice(0, 2);
        for (const id of tryIds) {
            const r = pieceProcess(scans, opts, id);
            if (!best || r.cost < best.cost) best = r;
        }
        if (duplicate && best.fixed.length > 12)
            return { ok: false, errors: [{ type: "centre", message: "Two scans seem to show the same face (same centre colour). Scan again.", facelets: [] }] };
        if (best.fixed.length > 16)
            return Object.assign({}, best, { ok: false, errors: [{ type: "unreadable", message: "Too many stickers could not be read reliably (" + best.fixed.length + "). Check the glowing stickers or scan again in better light.", facelets: best.fixed.map(x => x.facelet) }] });
        return best;
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
        FACES, SCHEME, REFERENCE_RGB, PROTOTYPES,
        rgbToLab, labDistance, redmeanDistance, medianRGB,
        nearestCubeColourDistance, chromaticity, sameColour, analyzeFaceImage, rgbToHsv, hsvDistance, detectFaceGrid,
        hungarian, identifyCentres, classifyScans, guessLetter,
        validate, isValid, rotateGrid, buildFacelets, solveOrientation,
        processScans, cornerChiralityOk, expectedRotations, imageUpFor, NORMAL,
        CORNER_FACELETS, EDGE_FACELETS
    };

    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.CubeLogic = api;
})(typeof self !== "undefined" ? self : this);
