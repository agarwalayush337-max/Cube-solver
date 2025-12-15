/* =========================================================
   RUBIK'S CUBE SOLVER – COMPLETE script.js
   Compatible with:
   - existing HTML
   - worker.js (min2phase)
   - Three.js
   ========================================================= */

/* =======================
   1. CONFIGURATION
======================= */
const colors = {
    U: 0xffffff,
    R: 0xb90000,
    F: 0x009e60,
    D: 0xffd500,
    L: 0xff5800,
    B: 0x0051ba,
    Core: 0x151515
};

function getColorChar(hex) {
    let min = Infinity, res = null;
    for (const k in colors) {
        if (k === "Core") continue;
        const v = colors[k];
        const d =
            Math.abs(((hex >> 16) & 255) - ((v >> 16) & 255)) +
            Math.abs(((hex >> 8) & 255) - ((v >> 8) & 255)) +
            Math.abs((hex & 255) - (v & 255));
        if (d < min) {
            min = d;
            res = k;
        }
    }
    return res;
}

/* =======================
   2. GLOBAL STATE
======================= */
let scene, camera, renderer;
let raycaster, mouse;
let cubes = [];
let pivotGroup;

let isAnimating = false;
let paintColor = "U";

let solutionMoves = [];
let moveIndex = 0;
let playInterval = null;

let isMouseDown = false;
let isDragging = false;
let lastMouse = { x: 0, y: 0 };

/* =======================
   3. WORKER
======================= */
const statusEl = document.getElementById("status");
statusEl.innerText = "Loading engine…";
statusEl.style.color = "orange";

const solverWorker = new Worker("worker.js?v=" + Date.now());
let engineReady = false;

solverWorker.onmessage = (e) => {
    const d = e.data;

    if (d.type === "ready") {
        engineReady = true;
        statusEl.innerText = "Ready! Paint & Solve.";
        statusEl.style.color = "#00ff00";
    }

    if (d.type === "solution") {
        if (!d.solution || !d.solution.trim()) {
            statusEl.innerText = "Already solved or invalid cube";
            statusEl.style.color = "red";
            return;
        }

        solutionMoves = d.solution.trim().split(/\s+/);
        moveIndex = 0;

        statusEl.innerHTML = `Solved (${solutionMoves.length} moves)`;
        statusEl.style.color = "#00ff00";

        document.getElementById("action-controls").style.display = "none";
        document.getElementById("playback-controls").style.display = "flex";
    }

    if (d.type === "error") {
        alert(d.message);
    }
};

/* =======================
   4. INIT SCENE
======================= */
init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.set(0, 0, 11);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById("canvas-container").appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(10, 20, 10);
    scene.add(dl);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    pivotGroup = new THREE.Group();
    scene.add(pivotGroup);

    createCube();
    pivotGroup.rotation.set(0.3, -0.4, 0);

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
}

/* =======================
   5. CUBE CREATION
======================= */
function createCube() {
    const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);

    for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
            for (let z = -1; z <= 1; z++) {
                const mats = [
                    new THREE.MeshPhongMaterial({ color: x === 1 ? colors.R : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: x === -1 ? colors.L : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: y === 1 ? colors.U : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: y === -1 ? colors.D : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: z === 1 ? colors.F : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: z === -1 ? colors.B : colors.Core })
                ];

                const cube = new THREE.Mesh(geo, mats);
                cube.position.set(x, y, z);
                cube.userData = {
                    ix: x,
                    iy: y,
                    iz: z,
                    isCenter: Math.abs(x) + Math.abs(y) + Math.abs(z) === 1
                };

                pivotGroup.add(cube);
                cubes.push(cube);
            }
}

/* =======================
   6. PAINTING
======================= */
function selectColor(el, c) {
    paintColor = c;
    document.querySelectorAll(".swatch").forEach(s => s.classList.remove("selected"));
    el.classList.add("selected");
}

function handlePaintClick(x, y) {
    if (isAnimating) return;

    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(cubes)[0];
    if (!hit) return;

    if (hit.object.userData.isCenter) {
        alert("Centers are fixed");
        return;
    }

    hit.object.material[hit.face.materialIndex].color.setHex(colors[paintColor]);
}

/* =======================
   7. INPUT HANDLERS
======================= */
function onMouseDown(e) {
    isMouseDown = true;
    isDragging = false;
    lastMouse = { x: e.clientX, y: e.clientY };
}

function onMouseMove(e) {
    if (!isMouseDown) return;

    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging = true;

    if (isDragging) {
        pivotGroup.rotation.y += dx * 0.005;
        pivotGroup.rotation.x += dy * 0.005;
    }

    lastMouse = { x: e.clientX, y: e.clientY };
}

function onMouseUp(e) {
    isMouseDown = false;
    if (!isDragging) handlePaintClick(e.clientX, e.clientY);
    isDragging = false;
}

/* =======================
   8. CUBE STATE CAPTURE
======================= */
function getCubeStateString() {
    let state = "";

    const find = (x, y, z) =>
        cubes.find(c => c.userData.ix === x && c.userData.iy === y && c.userData.iz === z);

    const faces = [
        [[-1,1,-1],[0,1,-1],[1,1,-1],[-1,1,0],[0,1,0],[1,1,0],[-1,1,1],[0,1,1],[1,1,1]], // U
        [[1,1,1],[1,1,0],[1,1,-1],[1,0,1],[1,0,0],[1,0,-1],[1,-1,1],[1,-1,0],[1,-1,-1]], // R
        [[-1,1,1],[0,1,1],[1,1,1],[-1,0,1],[0,0,1],[1,0,1],[-1,-1,1],[0,-1,1],[1,-1,1]], // F
        [[-1,-1,1],[0,-1,1],[1,-1,1],[-1,-1,0],[0,-1,0],[1,-1,0],[-1,-1,-1],[0,-1,-1],[1,-1,-1]], // D
        [[-1,1,-1],[-1,1,0],[-1,1,1],[-1,0,-1],[-1,0,0],[-1,0,1],[-1,-1,-1],[-1,-1,0],[-1,-1,1]], // L
        [[1,1,-1],[0,1,-1],[-1,1,-1],[1,0,-1],[0,0,-1],[-1,0,-1],[1,-1,-1],[0,-1,-1],[-1,-1,-1]]  // B
    ];

    const mats = [2,0,4,3,1,5];

    faces.forEach((face, i) =>
        face.forEach(p => {
            const c = find(...p);
            state += getColorChar(c.material[mats[i]].color.getHex());
        })
    );

    return state;
}

/* =======================
   9. SOLVE
======================= */
function solveCube() {
    if (!engineReady) {
        alert("Engine still loading");
        return;
    }

    const cube = getCubeStateString();
    console.log("Captured cube:", cube);

    statusEl.innerText = "Analyzing…";
    statusEl.style.color = "orange";

    solverWorker.postMessage({ type: "solve", cube });
}

/* =======================
   10. ROTATION ENGINE
======================= */
function rotateFace(move, reverse = false) {
    if (isAnimating) return;
    isAnimating = true;

    let face = move[0];
    let prime = move.includes("'");
    let twice = move.includes("2");

    if (reverse) prime = !prime;

    let axis, dir = prime ? 1 : -1;
    let group = [];

    cubes.forEach(c => {
        if (face === "R" && c.position.x > 0.5) axis="x", group.push(c);
        if (face === "L" && c.position.x < -0.5) axis="x", dir*=-1, group.push(c);
        if (face === "U" && c.position.y > 0.5) axis="y", group.push(c);
        if (face === "D" && c.position.y < -0.5) axis="y", dir*=-1, group.push(c);
        if (face === "F" && c.position.z > 0.5) axis="z", group.push(c);
        if (face === "B" && c.position.z < -0.5) axis="z", dir*=-1, group.push(c);
    });

    const pivot = new THREE.Object3D();
    pivotGroup.add(pivot);
    group.forEach(c => pivot.attach(c));

    const angle = (twice ? Math.PI : Math.PI / 2) * dir;
    const start = Date.now();

    function step() {
        const p = Math.min((Date.now() - start) / 250, 1);
        pivot.rotation[axis] = angle * p;

        if (p < 1) requestAnimationFrame(step);
        else {
            group.forEach(c => pivotGroup.attach(c));
            pivotGroup.remove(pivot);
            isAnimating = false;
        }
    }
    step();
}

/* =======================
   11. PLAYBACK CONTROLS
======================= */
function nextMove() {
    if (moveIndex >= solutionMoves.length) return;
    rotateFace(solutionMoves[moveIndex]);
    moveIndex++;
}

function prevMove() {
    if (moveIndex <= 0) return;
    moveIndex--;
    rotateFace(solutionMoves[moveIndex], true);
}

function togglePlay() {
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    } else {
        playInterval = setInterval(() => {
            if (!isAnimating) nextMove();
        }, 600);
    }
}

function resetCube() {
    location.reload();
}

/* =======================
   12. RENDER LOOP
======================= */
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
