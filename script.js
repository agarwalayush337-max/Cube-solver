/* =========================================================
   RUBIK'S CUBE SOLVER – COMPLETE script.js
   ========================================================= */

/* =======================
   CONFIG & CONSTANTS
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

const SOLVED_STATE =
  "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

const SCRAMBLE_MOVES = ["U","U'","U2","R","R'","R2","F","F'","F2","D","D'","D2","L","L'","L2","B","B'","B2"];
const PLAY_SPEED = 300;

/* =======================
   GLOBAL STATE
======================= */
let scene, camera, renderer;
let raycaster, mouse;
let pivotGroup;
let cubes = [];

let isAnimating = false;
let paintColor = "U";

let logicalCubeState = SOLVED_STATE;

let solutionMoves = [];
let moveIndex = 0;
let playInterval = null;

let isMouseDown = false;
let isDragging = false;
let lastMouse = { x: 0, y: 0 };

/* =======================
   DOM ELEMENTS
======================= */
const statusEl = document.getElementById("status");
const solutionTextEl = document.getElementById("solutionText");

/* =======================
   WORKER (Min2Phase)
======================= */
const solverWorker = new Worker("worker.js?v=" + Date.now());
let engineReady = false;

statusEl.innerText = "Loading engine…";
statusEl.style.color = "orange";

solverWorker.onmessage = e => {
  const d = e.data;

  if (d.type === "ready") {
    engineReady = true;
    statusEl.innerText = "Ready! Paint / Scramble & Solve.";
    statusEl.style.color = "#00ff00";
  }

  if (d.type === "solution") {
    solutionMoves = d.solution.trim().split(/\s+/);
    moveIndex = 0;

    solutionTextEl.innerText = "Solution: " + d.solution;

    document.getElementById("action-controls").style.display = "none";
    document.getElementById("playback-controls").style.display = "flex";
    document.getElementById("resetBtn").style.display = "inline-block";

    updateStepStatus();
  }

  if (d.type === "error") {
    alert(d.message);
  }
};

/* =======================
   INIT THREE.JS
======================= */
init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
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

  updatePaletteCounts();
}

/* =======================
   CREATE CUBE
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
        pivotGroup.add(cube);
        cubes.push(cube);
      }
}

/* =======================
   COLOR + NUMBER OVERLAY
======================= */
function createNumberTexture(num) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.font = "bold 72px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(num, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/* =======================
   PALETTE LOGIC
======================= */
function selectColor(el, c) {
  paintColor = c;
  document.querySelectorAll(".swatch").forEach(s => s.classList.remove("selected"));
  el.classList.add("selected");
}

function updatePaletteCounts() {
  const counts = countColors(logicalCubeState);
  document.querySelectorAll(".swatch").forEach(s => {
    const color = s.dataset.color;
    s.querySelector(".count").innerText = counts[color];
  });
}

/* =======================
   PAINTING (VISUAL + LOGICAL)
======================= */
function handlePaintClick(x, y) {
  if (isAnimating) return;

  mouse.x = (x / window.innerWidth) * 2 - 1;
  mouse.y = -(y / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObjects(cubes)[0];
  if (!hit) return;

  const mat = hit.object.material[hit.face.materialIndex];
  mat.color.setHex(colors[paintColor]);

  logicalCubeState = updateLogicalFromVisual();
  const counts = countColors(logicalCubeState);

  mat.emissive = new THREE.Color(0xffffff);
  mat.emissiveMap = createNumberTexture(counts[paintColor]);
  mat.needsUpdate = true;

  updatePaletteCounts();
}

/* =======================
   MOUSE INPUT
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
   LOGICAL STATE HELPERS
======================= */
function countColors(state) {
  const c = { U:0,R:0,F:0,D:0,L:0,B:0 };
  for (const ch of state) c[ch]++;
  return c;
}

function updateLogicalFromVisual() {
  // fallback for painting: treat visual colors as state
  let state = "";
  cubes.forEach(c => {
    c.material.forEach(m => {
      const hex = m.color.getHex();
      const k = Object.keys(colors).find(k => colors[k] === hex);
      if (k && k !== "Core") state += k;
    });
  });
  return state.padEnd(54, "U").slice(0, 54);
}

/* =======================
   LOGICAL MOVE ENGINE
======================= */
function applyMoveToState(state, move) {
  const maps = {
    U:[0,1,2,5,8,7,6,3,9,10,11,18,19,20,36,37,38,45,46,47],
    D:[27,28,29,32,35,34,33,30,15,16,17,24,25,26,42,43,44,51,52,53],
    F:[18,19,20,23,26,25,24,21,6,7,8,9,12,15,27,28,29,44,41,38],
    B:[45,46,47,50,53,52,51,48,2,1,0,11,14,17,33,34,35,36,39,42],
    R:[9,10,11,14,17,16,15,12,2,5,8,20,23,26,29,32,35,47,50,53],
    L:[36,37,38,41,44,43,42,39,0,3,6,18,21,24,27,30,33,51,48,45]
  };

  let times = move.includes("2") ? 2 : 1;
  if (move.includes("'")) times = 4 - times;

  let arr = state.split("");
  const idx = maps[move[0]];

  for (let t = 0; t < times; t++) {
    const temp = arr[idx[0]];
    for (let i = 0; i < idx.length - 1; i++) {
      arr[idx[i]] = arr[idx[i + 1]];
    }
    arr[idx[idx.length - 1]] = temp;
  }
  return arr.join("");
}

/* =======================
   SCRAMBLE
======================= */
function scrambleCube() {
  if (isAnimating) return;

  logicalCubeState = SOLVED_STATE;
  let i = 0;
  const seq = Array.from({ length: 20 }, () =>
    SCRAMBLE_MOVES[Math.floor(Math.random() * SCRAMBLE_MOVES.length)]
  );

  function step() {
    if (i >= seq.length) return;
    const m = seq[i++];
    logicalCubeState = applyMoveToState(logicalCubeState, m);
    rotateFace(m);
    setTimeout(step, 120);
  }
  step();
}

/* =======================
   SOLVE
======================= */
function solveCube() {
  if (!engineReady) return alert("Engine loading");
  const counts = countColors(logicalCubeState);
  if (Object.values(counts).some(v => v !== 9)) {
    alert("Invalid cube colors");
    return;
  }
  statusEl.innerText = "Analyzing…";
  solverWorker.postMessage({ type:"solve", cube: logicalCubeState });
}

/* =======================
   ROTATION (VISUAL ONLY)
======================= */
function rotateFace(move) {
  if (isAnimating) return;
  isAnimating = true;

  let face = move[0];
  let prime = move.includes("'");
  let twice = move.includes("2");

  let axis, dir = prime ? 1 : -1;
  let group = [];

  cubes.forEach(c => {
    if (face==="R" && c.position.x>0.5) axis="x",group.push(c);
    if (face==="L" && c.position.x<-0.5) axis="x",dir*=-1,group.push(c);
    if (face==="U" && c.position.y>0.5) axis="y",group.push(c);
    if (face==="D" && c.position.y<-0.5) axis="y",dir*=-1,group.push(c);
    if (face==="F" && c.position.z>0.5) axis="z",group.push(c);
    if (face==="B" && c.position.z<-0.5) axis="z",dir*=-1,group.push(c);
  });

  const pivot = new THREE.Object3D();
  pivotGroup.add(pivot);
  group.forEach(c => pivot.attach(c));

  const angle = (twice ? Math.PI : Math.PI/2) * dir;
  const start = Date.now();

  function anim() {
    const p = Math.min((Date.now() - start) / 250, 1);
    pivot.rotation[axis] = angle * p;
    if (p < 1) requestAnimationFrame(anim);
    else {
      group.forEach(c => pivotGroup.attach(c));
      pivotGroup.remove(pivot);
      isAnimating = false;
    }
  }
  anim();
}

/* =======================
   PLAYBACK
======================= */
function updateStepStatus() {
  statusEl.innerText = `Step ${moveIndex} / ${solutionMoves.length}`;
}

function nextMove() {
  if (isAnimating || moveIndex >= solutionMoves.length) return;
  logicalCubeState = applyMoveToState(logicalCubeState, solutionMoves[moveIndex]);
  rotateFace(solutionMoves[moveIndex]);
  moveIndex++;
  updateStepStatus();
}

function prevMove() {
  if (isAnimating || moveIndex <= 0) return;
  moveIndex--;
  logicalCubeState = applyMoveToState(logicalCubeState, solutionMoves[moveIndex] + "'");
  rotateFace(solutionMoves[moveIndex] + "'");
  updateStepStatus();
}

function togglePlay() {
  const btn = document.getElementById("playPauseBtn");
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
    btn.innerText = "PLAY";
  } else {
    btn.innerText = "PAUSE";
    playInterval = setInterval(() => {
      if (!isAnimating) {
        if (moveIndex < solutionMoves.length) nextMove();
        else {
          clearInterval(playInterval);
          playInterval = null;
          btn.innerText = "PLAY";
        }
      }
    }, PLAY_SPEED);
  }
}

function resetCube() {
  location.reload();
}

/* =======================
   RENDER LOOP
======================= */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
