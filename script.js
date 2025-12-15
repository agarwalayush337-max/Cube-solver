
/* =========================================================
   RUBIK'S CUBE SOLVER – FULL FEATURED script.js
   ========================================================= */

/* =======================
   CONFIG
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

const SCRAMBLE_MOVES = ["U","U'","R","R'","F","F'","D","D'","L","L'","B","B'"];
const PLAY_SPEED = 300; // ms (reduced speed)

/* =======================
   GLOBAL STATE
======================= */
let scene, camera, renderer;
let raycaster, mouse;
let cubes = [], pivotGroup;

let isAnimating = false;
let paintColor = "U";

let solutionMoves = [];
let moveIndex = 0;
let playInterval = null;

let isMouseDown = false;
let isDragging = false;
let lastMouse = { x: 0, y: 0 };

/* =======================
   COLOR HELPERS
======================= */
function getColorChar(hex) {
    let best = null, min = Infinity;
    for (const k in colors) {
        if (k === "Core") continue;
        const v = colors[k];
        const d =
            Math.abs(((hex >> 16) & 255) - ((v >> 16) & 255)) +
            Math.abs(((hex >> 8) & 255) - ((v >> 8) & 255)) +
            Math.abs((hex & 255) - (v & 255));
        if (d < min) {
            min = d;
            best = k;
        }
    }
    return best;
}

function countColors(state) {
    const c = { U:0,R:0,F:0,D:0,L:0,B:0 };
    for (const ch of state) if (c[ch] !== undefined) c[ch]++;
    return c;
}

/* =======================
   WORKER
======================= */
const statusEl = document.getElementById("status");
const solutionTextEl = document.getElementById("solutionText");

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
            statusEl.innerText = "Invalid or already solved cube";
            statusEl.style.color = "red";
            return;
        }

        solutionMoves = d.solution.trim().split(/\s+/);
        moveIndex = 0;

        solutionTextEl.innerText = "Solution: " + d.solution;

        document.getElementById("action-controls").style.display = "none";
        document.getElementById("playback-controls").style.display = "flex";
        document.getElementById("resetBtn").style.display = "inline-block";

        updateStepStatus();
    }

    if (d.type === "error") alert(d.message);
};

/* =======================
   INIT SCENE
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
   NUMBER TEXTURE (SAFE)
======================= */
function createNumberTexture(num) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.font = "bold 72px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num, size / 2, size / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

/* =======================
   CUBE CREATION
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
                    ix: x, iy: y, iz: z,
                    isCenter: Math.abs(x) + Math.abs(y) + Math.abs(z) === 1
                };

                pivotGroup.add(cube);
                cubes.push(cube);
            }
}

/* =======================
   PALETTE COUNTS (INSIDE COLOR BOX)
======================= */
function updatePaletteCounts() {
    const counts = countColors(getCubeStateString());
    document.querySelectorAll(".swatch").forEach(s => {
        const color = s.dataset.color;
        const span = s.querySelector(".count");
        if (span) span.innerText = counts[color];
    });
}

/* =======================
   PAINTING + SMART ASSIST
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

    const mat = hit.object.material[hit.face.materialIndex];
    mat.color.setHex(colors[paintColor]);

    const counts = countColors(getCubeStateString());
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = createNumberTexture(counts[paintColor]);
    mat.needsUpdate = true;

    smartAutoFill();
    updatePaletteCounts();
}

function smartAutoFill() {
    const counts = countColors(getCubeStateString());
    const missing = Object.entries(counts).filter(([_,v]) => v < 9).map(([k]) => k);

    if (missing.length !== 1) return;

    cubes.forEach(c => {
        c.material.forEach(m => {
            if (m.color.getHex() === colors.Core) {
                m.color.setHex(colors[missing[0]]);
            }
        });
    });
}

/* =======================
   INPUT
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
   CUBE STATE CAPTURE
======================= */
function getCubeStateString() {
    let state = "";

    const find = (x,y,z) =>
        cubes.find(c => c.userData.ix===x && c.userData.iy===y && c.userData.iz===z);

    const faces = [
        [[-1,1,-1],[0,1,-1],[1,1,-1],[-1,1,0],[0,1,0],[1,1,0],[-1,1,1],[0,1,1],[1,1,1]],
        [[1,1,1],[1,1,0],[1,1,-1],[1,0,1],[1,0,0],[1,0,-1],[1,-1,1],[1,-1,0],[1,-1,-1]],
        [[-1,1,1],[0,1,1],[1,1,1],[-1,0,1],[0,0,1],[1,0,1],[-1,-1,1],[0,-1,1],[1,-1,1]],
        [[-1,-1,1],[0,-1,1],[1,-1,1],[-1,-1,0],[0,-1,0],[1,-1,0],[-1,-1,-1],[0,-1,-1],[1,-1,-1]],
        [[-1,1,-1],[-1,1,0],[-1,1,1],[-1,0,-1],[-1,0,0],[-1,0,1],[-1,-1,-1],[-1,-1,0],[-1,-1,1]],
        [[1,1,-1],[0,1,-1],[-1,1,-1],[1,0,-1],[0,0,-1],[-1,0,-1],[1,-1,-1],[0,-1,-1],[-1,-1,-1]]
    ];

    const mats = [2,0,4,3,1,5];

    faces.forEach((face,i)=>
        face.forEach(p=>{
            const c = find(...p);
            state += getColorChar(c.material[mats[i]].color.getHex());
        })
    );
    return state;
}

/* =======================
   SOLVE + SCRAMBLE
======================= */
function solveCube() {
    if (!engineReady) return alert("Engine loading");

    const cube = getCubeStateString();
    const counts = countColors(cube);

    const invalid = Object.entries(counts).filter(([_,v])=>v!==9);
    if (invalid.length) {
        alert("Each color must appear exactly 9 times");
        return;
    }

    statusEl.innerText = "Analyzing…";
    statusEl.style.color = "orange";
    solverWorker.postMessage({ type:"solve", cube });
}

function scrambleCube() {
    if (isAnimating) return;

    let i = 0;
    const scramble = Array.from({length: 20},
        () => SCRAMBLE_MOVES[Math.floor(Math.random()*SCRAMBLE_MOVES.length)]
    );

    function apply() {
        if (i >= scramble.length) return;
        rotateFace(scramble[i++]);
        setTimeout(apply, 120);
    }
    apply();
}

/* =======================
   ROTATION ENGINE
======================= */
function rotateFace(move, reverse=false) {
    if (isAnimating) return;
    isAnimating = true;

    let face = move[0];
    let prime = move.includes("'");
    let twice = move.includes("2");
    if (reverse) prime = !prime;

    let axis, dir = prime ? 1 : -1;
    let group = [];

    cubes.forEach(c=>{
        if(face==="R"&&c.position.x>0.5)axis="x",group.push(c);
        if(face==="L"&&c.position.x<-0.5)axis="x",dir*=-1,group.push(c);
        if(face==="U"&&c.position.y>0.5)axis="y",group.push(c);
        if(face==="D"&&c.position.y<-0.5)axis="y",dir*=-1,group.push(c);
        if(face==="F"&&c.position.z>0.5)axis="z",group.push(c);
        if(face==="B"&&c.position.z<-0.5)axis="z",dir*=-1,group.push(c);
    });

    const pivot = new THREE.Object3D();
    pivotGroup.add(pivot);
    group.forEach(c=>pivot.attach(c));

    const angle = (twice ? Math.PI : Math.PI/2) * dir;
    const start = Date.now();

    function step(){
        const p=Math.min((Date.now()-start)/250,1);
        pivot.rotation[axis]=angle*p;
        if(p<1)requestAnimationFrame(step);
        else{
            group.forEach(c=>pivotGroup.attach(c));
            pivotGroup.remove(pivot);
            isAnimating=false;
        }
    }
    step();
}

/* =======================
   PLAYBACK
======================= */
function updateStepStatus() {
    statusEl.innerHTML = `Step ${moveIndex} / ${solutionMoves.length}`;
}

function nextMove() {
    if (isAnimating || moveIndex>=solutionMoves.length) return;
    rotateFace(solutionMoves[moveIndex]);
    moveIndex++;
    updateStepStatus();
}

function prevMove() {
    if (isAnimating || moveIndex<=0) return;
    moveIndex--;
    rotateFace(solutionMoves[moveIndex], true);
    updateStepStatus();
}

function togglePlay() {
    const btn = document.getElementById("playPauseBtn");

    if (playInterval) {
        clearInterval(playInterval);
        playInterval=null;
        if(btn)btn.innerText="PLAY";
    } else {
        if(!solutionMoves.length)return;
        if(btn)btn.innerText="PAUSE";
        playInterval=setInterval(()=>{
            if(!isAnimating){
                if(moveIndex<solutionMoves.length)nextMove();
                else{
                    clearInterval(playInterval);
                    playInterval=null;
                    if(btn)btn.innerText="PLAY";
                }
            }
        },PLAY_SPEED);
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
