/* End-to-end test: fake camera shows a scrambled cube face by face,
   the app auto-captures, reads, solves and plays the solution.
   Run: node tests/e2e.scan.js   (needs playwright + a local http server) */
"use strict";
const path = require("path");
const http = require("http");
const fs = require("fs");
const { chromium } = require(process.env.PW_PATH || "playwright");
const L = require("../cubelogic.js");
const min2phase = require("../solver.js");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    fs.readFile(p, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
        res.end(data);
    });
});

/* Camera-like sticker colours */
/* STYLE=stickerless: colours measured from a real stickerless cube
   (dark red + red-orange, lime green, sky blue), hairline gaps, and the
   cube turned straight from one face to the next (no empty frames). */
const STICKERLESS = process.env.STYLE === "stickerless";
const STICKERLESS_RGB = {
    U: [215, 212, 195], R: [143, 31, 24], F: [138, 229, 92],
    D: [216, 233, 76], L: [219, 77, 52], B: [70, 130, 195]
};
const CAM_RGB_CLASSIC = {
    U: [222, 226, 220], R: [175, 28, 38], F: [25, 150, 85],
    D: [232, 208, 45], L: [238, 104, 35], B: [25, 72, 168]
};
const CAM_RGB = STICKERLESS ? STICKERLESS_RGB : CAM_RGB_CLASSIC;
/* Physical simulation: the cube starts in a random orientation and the
   user follows the on-screen moves (tilt, turn left x3, tilt). */
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
    let Q = [[1,0,0],[0,1,0],[0,0,1]];
    const Rx = [[1,0,0],[0,0,-1],[0,1,0]], Ry = [[0,0,1],[0,1,0],[-1,0,0]];
    for (let i = 0; i < 12; i++) Q = mm(Math.random() < 0.5 ? Rx : Ry, Q);
    return Q;
}
function cameraView(cube, Q) {
    const right = Q[0], up = Q[1], n = Q[2];
    const face = L.FACES.find(f => L.NORMAL[f].every((v, i) => v === n[i]));
    const out = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const p = [0,1,2].map(i => n[i] + (1 - row) * up[i] + (col - 1) * right[i]);
        out.push(cube[L.FACES.indexOf(face) * 9 + FACELET_POS[face].findIndex(q => q.every((v, i) => v === p[i]))]);
    }
    return { face, grid: out };
}

(async () => {
    await new Promise(r => server.listen(0, r));
    const port = server.address().port;
    const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
    const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    page.on("dialog", d => { errors.push("dialog: " + d.message()); d.dismiss(); });

    /* fake camera: a canvas stream; the face drawn exactly under the guide square */
    await page.addInitScript(() => {
        const cv = document.createElement("canvas");
        cv.width = 1280; cv.height = 720;
        const g = cv.getContext("2d");
        window.__face = null;
        window.__gap = 0.08;
        function draw() {
            g.fillStyle = "#6b5440"; g.fillRect(0, 0, cv.width, cv.height);
            const v = document.getElementById("cam-video"), grid = document.getElementById("grid-overlay");
            if (window.__face && v && grid && v.videoWidth) {
                const gr = grid.getBoundingClientRect(), vr = v.getBoundingClientRect();
                const vRatio = v.videoWidth / v.videoHeight, dRatio = vr.width / vr.height;
                let rw, rh, rx, ry;
                if (dRatio > vRatio) { rw = vr.width; rh = vr.width / vRatio; rx = 0; ry = (vr.height - rh) / 2; }
                else { rw = vr.height * vRatio; rh = vr.height; rx = (vr.width - rw) / 2; ry = 0; }
                const sc = v.videoWidth / rw;
                const sx = (gr.left - vr.left - rx) * sc, sy = (gr.top - vr.top - ry) * sc, sw = gr.width * sc;
                const cell = sw / 3;
                g.fillStyle = window.__gap < 0.05 ? "#3c3732" : "#111"; g.fillRect(sx, sy, sw, sw);
                window.__face.forEach((rgb, i) => {
                    const r = Math.floor(i / 3), c = i % 3;
                    g.fillStyle = `rgb(${rgb.join(",")})`;
                    const gp = window.__gap; g.fillRect(sx + c * cell + cell * gp, sy + r * cell + cell * gp, cell * (1 - 2 * gp), cell * (1 - 2 * gp));
                    /* a glare spot on some stickers */
                    if ((i + window.__glare) % 4 === 0) { g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(sx + c * cell + cell * 0.3, sy + r * cell + cell * 0.3, cell * 0.08, cell * 0.08); }
                });
            }
            requestAnimationFrame(draw);
        }
        draw();
        /* like a real camera: a fresh stream every time it is opened */
        navigator.mediaDevices.getUserMedia = async () => cv.captureStream(30);
    });

    await page.goto(`http://localhost:${port}/index.html`);
    if (STICKERLESS) await page.evaluate(() => { window.__gap = 0.015; });
    await page.waitForFunction(() => document.getElementById("status").innerText.startsWith("Ready"), null, { timeout: 120000 });
    console.log("engine ready");

    let passed = 0;
    const RUNS = +process.env.RUNS || 3;
    for (let run = 0; run < RUNS; run++) {
        const cube = min2phase.randomCube();
        await page.evaluate(() => { window.__face = null; });
        await page.evaluate(() => startCameraMode());
        await page.waitForTimeout(500);

        let Q = randomOrientation();
        let lastQ = null;
        for (let step = 0; step < 6; step++) {
            const view = cameraView(cube, Q);
            const f = view.face, seen = view.grid;
            lastQ = Q;
            if (step < 5) Q = mm(MOVES[SEQ[step]], Q);
            const light = 0.7 + Math.random() * 0.45;
            const cast = [1 + (Math.random() - 0.5) * 0.12, 1, 1 + (Math.random() - 0.5) * 0.12];
            const rgb = seen.map(c => CAM_RGB[c].map((v, ch) => Math.max(0, Math.min(255, Math.round(v * light * cast[ch])))));
            /* moving between faces: blank frames, then the new face
               (stickerless mode: straight to the next face) */
            if (!STICKERLESS) {
                await page.evaluate(() => { window.__face = null; });
                await page.waitForTimeout(300);
            }
            await page.evaluate(([face, gl]) => { window.__face = face; window.__glare = gl; }, [rgb, step]);
            try {
                await page.waitForFunction(n => scanIndex > n || !isCameraActive, step, { timeout: 15000 });
            } catch (e) {
                const dbg = await page.evaluate(() => ({ scanIndex, btn: document.getElementById("btn-capture").innerText,
                    dots: [...document.getElementsByClassName("cam-dot")].map(d => d.dataset.color).join(""),
                    centres: scannedFacesData.map(f => CubeLogic.guessLetter(f.rgb[4], knownCentreColours())).join(""),
                    stable: stableFrames, live: liveCells.map(c => c.map(Math.round).join("/")) }));
                console.log("STALL at step", step, "face", f, JSON.stringify(dbg), "\n sent", JSON.stringify(rgb));
                throw e;
            }
        }

        await page.waitForFunction(() => document.getElementById("playback-controls").style.display === "flex" ||
            /Can't|Check|error/i.test(document.getElementById("status").innerText), null, { timeout: 60000 });
        const read = await page.evaluate(() => getCubeStateString());
        const status = await page.evaluate(() => document.getElementById("status").innerText);
        const okRead = read === cube;
        /* 3D view: which cube directions point at the viewer and up? */
        await page.waitForTimeout(1200); /* let the turn animation finish */
        const view = await page.evaluate(() => {
            const q = pivotGroup.quaternion.clone().invert();
            const toCube = v => { const w = new THREE.Vector3(...v).applyQuaternion(q); return [w.x, w.y, w.z].map(Math.round); };
            /* undo the small viewing tilt before comparing */
            const qq = pivotGroup.quaternion.clone().premultiply(VIEW_TILT.clone().invert()).invert();
            const back = v => { const w = new THREE.Vector3(...v).applyQuaternion(qq); return [w.x, w.y, w.z].map(Math.round); };
            return { towards: back([0, 0, 1]), up: back([0, 1, 0]) };
        });
        const viewOk = JSON.stringify(view.towards) === JSON.stringify(lastQ[2]) && JSON.stringify(view.up) === JSON.stringify(lastQ[1]);
        console.log(`  3D view matches the hand (last face towards you, same side up): ${viewOk ? "YES" : "NO " + JSON.stringify(view) + " vs " + JSON.stringify([lastQ[2], lastQ[1]])}`);
        if (!viewOk) { console.log(`run ${run + 1}: read ${okRead ? "EXACT" : "WRONG"}`); continue; }
        console.log(`run ${run + 1}: read ${okRead ? "EXACT" : "WRONG"} | status: ${status}`);
        if (!okRead) { console.log(" expected", cube, "\n got     ", read); continue; }

        /* play the whole solution and confirm the cube ends solved */
        const nMoves = await page.evaluate(() => solutionMoves.length);
        await page.screenshot({ path: path.join(__dirname, `e2e-before-run${run + 1}.png`) });
        await page.evaluate(() => togglePlay());
        await page.waitForFunction(() => document.getElementById("status").innerText === "Solved!", null, { timeout: 120000 });
        const finalState = await page.evaluate(() => getCubeStateString());
        const solved = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
        console.log(`  played ${nMoves} quarter turns -> ${finalState === solved ? "SOLVED" : "NOT SOLVED"}`);
        if (finalState === solved) passed++;
        await page.screenshot({ path: path.join(__dirname, `e2e-run${run + 1}.png`) });
    }

    console.log(`\n${passed}/${RUNS} scans read exactly and solved`);
    if (errors.length) console.log("page errors:", errors);
    await browser.close();
    server.close();
    process.exitCode = passed === RUNS && !errors.length ? 0 : 1;
})().catch(e => { console.error(e); process.exit(1); });
