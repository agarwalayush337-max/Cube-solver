/* =========================================================
   RUBIK'S CUBE SOLVER – VISUAL GUIDE (ORIENTATION FIXED)
   ========================================================= */

/* =======================
   CONFIG & CONSTANTS
======================= */
const colors = {
    U: 0xffffff, // White
    R: 0xb90000, // Red
    F: 0x00ff00, // Green
    D: 0xffd500, // Yellow
    L: 0xff3300, // Orange
    B: 0x0051ba, // Blue
    Core: 0x202020 
};

const colorKeys = ['U', 'R', 'F', 'D', 'L', 'B'];

const ALL_CORNERS = [
    ["U","R","F"], ["U","F","L"], ["U","L","B"], ["U","B","R"],
    ["D","F","R"], ["D","L","F"], ["D","B","L"], ["D","R","B"]
];
const ALL_EDGES = [
    ["U","R"], ["U","F"], ["U","L"], ["U","B"],
    ["D","R"], ["D","F"], ["D","L"], ["D","B"],
    ["F","R"], ["F","L"], ["B","L"], ["B","R"]
];

const SCRAMBLE_MOVES = ["U","U'","R","R'","F","F'","D","D'","L","L'","B","B'"];
const PLAY_SPEED = 900;    // ms for a quarter turn (a half turn takes 1.5x)
const MOVE_GAP = 1200;     // pause between moves while playing

// Viewing angle like a cube held in front of you: turned 45° so the front and
// right faces show equally, then tipped forward so the top shows. Yaw first,
// then pitch, keeps the vertical edges upright (no sideways tilt).
const VIEW_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, -Math.PI / 4, 0, "XYZ"));

/* =======================
   GLOBAL STATE
======================= */
let scene, camera, renderer;
let raycaster, mouse;
let cubes = [], pivotGroup;
let hintBox; 

let isAnimating = false;
let paintColor = "U";

let solutionMoves = []; 
let displayMoves = [];  
let moveIndex = 0;
let playInterval = null;
let autofillCount = 0; 

let isMouseDown = false;
let isDragging = false;
let startMouse = { x: 0, y: 0 };
let lastMouse = { x: 0, y: 0 };

// Camera State
let videoStream = null;
let isCameraActive = false;
let scanIndex = 0;
let scannedFacesData = [];   // [{ rgb: [9 x [r,g,b]], manual: [9 x letter|null] }]
let liveCells = [];          // latest 9 sticker RGB readings from the camera
let prevCells = null;
let stableFrames = 0;
let autoCapture = true;
const STABLE_FRAMES_NEEDED = 36;   // ~1.2 s at 30 fps of a steady picture
const STABLE_MAX_CHANGE = 1200;    // redmean distance allowed between frames
const CAPTURE_PAUSE_MS = 900;      // show "captured" before looking for the next face
let steadyFrames = [];             // readings during the current steady hold
let pausedUntil = 0;

// Highlighted stickers (errors / auto-corrections)
let highlightedMats = [];

/* =======================
   UI ELEMENTS
======================= */
const statusEl = document.getElementById("status");
const solutionTextEl = document.getElementById("solutionText");

// Stats
const statsDiv = document.createElement("div");
statsDiv.style.position = "absolute";
statsDiv.style.bottom = "20px";
statsDiv.style.left = "20px";
statsDiv.style.color = "#00ff88";
statsDiv.style.fontFamily = "Arial, sans-serif";
statsDiv.style.fontSize = "18px";
statsDiv.style.fontWeight = "bold";
statsDiv.style.pointerEvents = "none";
statsDiv.style.textShadow = "0 0 5px black";
statsDiv.innerText = "Autofilled: 0";
statsDiv.style.display = "none";   // manual painting removed
document.body.appendChild(statsDiv);

// Camera Button
const toolRow = document.getElementById("tool-row");
if(toolRow) {
    const camBtn = document.createElement("button");
    camBtn.innerText = "📷 SCAN CUBE";
    camBtn.className = "tool-btn";
    camBtn.style.background = "#0051ba";
    camBtn.onclick = startCameraMode;
    toolRow.appendChild(camBtn);
}

// ---------------------------------------------------------
// CSS 3D CUBE FOR SCANNING (LIVE PREVIEW)
// ---------------------------------------------------------
const guideStyle = document.createElement("style");
guideStyle.innerHTML = `
    .scan-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background: #1e1e1e;
    }
    .scan-top {
        flex: 1;
        position: relative;
        overflow: hidden;
        border-bottom: 4px solid #333;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .scan-bottom {
        flex: 1;
        position: relative;
        perspective: 1200px;
        display: flex;
        justify-content: center;
        align-items: center;
        background: #151515;
    }
    
    .cube-wrapper {
        width: 150px;
        height: 150px;
        position: relative;
        transform-style: preserve-3d;
        transform: rotateX(-20deg) rotateY(-25deg); 
    }

    .cube-preview {
        width: 100%;
        height: 100%;
        position: absolute;
        transform-style: preserve-3d;
        transition: transform 2.0s cubic-bezier(0.25, 1, 0.5, 1);
    }
    
    .p-face {
        position: absolute;
        width: 150px;
        height: 150px;
        background: #000;
        border: 2px solid #555;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(3, 1fr);
        backface-visibility: visible; 
        opacity: 0.95;
    }
    
    .p-sticker {
        width: 100%;
        height: 100%;
        border: 1px solid rgba(0,0,0,0.3);
        box-shadow: inset 0 0 5px rgba(0,0,0,0.5);
        background-color: #2a2a2a; 
        transition: background-color 0.2s;
    }

    .p-front  { transform: rotateY(  0deg) translateZ(75px); }
    .p-right  { transform: rotateY( 90deg) translateZ(75px); }
    .p-back   { transform: rotateY(180deg) translateZ(75px); }
    .p-left   { transform: rotateY(-90deg) translateZ(75px); }
    .p-top    { transform: rotateX( 90deg) translateZ(75px); }
    .p-bottom { transform: rotateX(-90deg) translateZ(75px); }
    
    #cam-instruction {
        position: absolute;
        top: 20px;
        width: 100%;
        text-align: center;
        color: white;
        z-index: 10;
        pointer-events: none;
        text-shadow: 0 2px 4px rgba(0,0,0,0.9);
    }
    .nav-btn {
        position: absolute;
        bottom: 25px;
        z-index: 20;
        padding: 14px 30px;
        border-radius: 50px;
        border: none;
        font-weight: 800;
        font-size: 16px;
        cursor: pointer;
        box-shadow: 0 6px 15px rgba(0,0,0,0.4);
        letter-spacing: 1px;
    }
    
    #grid-overlay {
        position: absolute;
        width: min(66vw, 30vh);
        height: min(66vw, 30vh);
        transition: left 0.08s linear, top 0.08s linear, width 0.08s linear, height 0.08s linear, border-color 0.2s;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        grid-template-rows: 1fr 1fr 1fr;
        border: 3px solid rgba(0,255,136,0.6);
        box-shadow: 0 0 30px rgba(0,0,0,0.7);
        z-index: 5;
    }
    #grid-overlay.locked { border-color: rgba(0,220,255,0.95); }
    #grid-overlay.locked > div { border-color: rgba(0,220,255,0.7) !important; }
`;
document.head.appendChild(guideStyle);

const camOverlay = document.createElement("div");
camOverlay.id = "cam-overlay";
Object.assign(camOverlay.style, {
    position: 'absolute', top:0, left:0, width:'100%', height:'100%',
    background: '#000', zIndex: 100, display: 'none'
});

camOverlay.innerHTML = `
    <div class="scan-container">
        <div class="scan-top">
            <div id="cam-instruction">
                <h2 id="cam-msg" style="margin:0; font-size:22px;">Scan Top Face</h2>
                <div id="cam-sub-msg" style="font-size:14px; color:#aaa;">Center the white center</div>
            </div>
            
            <video id="cam-video" autoplay playsinline style="height:100%; width:100%; object-fit:cover;"></video>
            <canvas id="cam-canvas" style="display:none;"></canvas>
            
            <div id="grid-overlay"></div>
            
            <button id="btn-capture" class="nav-btn" style="background:#00ff88; color:#000; bottom: 20px;">CAPTURE</button>
            <button id="btn-undo" class="nav-btn" style="display:none; background:#333; color:#fff; left: 20px; font-size:12px; padding:10px 16px; bottom: 26px;">UNDO</button>
            <button id="btn-auto" class="nav-btn" style="background:#333; color:#fff; right: 20px; font-size:12px; padding:10px 16px; bottom: 26px;">AUTO: ON</button>
        </div>

        <div class="scan-bottom">
            <div class="cube-wrapper"> 
                <div class="cube-preview" id="live-cube">
                    <div class="p-face p-front" id="face-0"></div> 
                    <div class="p-face p-top"   id="face-1"></div> 
                    <div class="p-face p-right" id="face-2"></div> 
                    <div class="p-face p-back"  id="face-3"></div> 
                    <div class="p-face p-left"  id="face-4"></div> 
                    <div class="p-face p-bottom" id="face-5"></div> 
                </div>
            </div>
            <button id="btn-cancel" class="nav-btn" style="background:#ff4444; color:white; left: 20px; font-size:12px; padding:10px 20px; bottom:20px;">EXIT</button>
        </div>
    </div>
`;
document.body.appendChild(camOverlay);

const videoEl = document.getElementById("cam-video");
const canvasEl = document.getElementById("cam-canvas");
const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
const gridEl = document.getElementById("grid-overlay");
const liveCube = document.getElementById("live-cube");
const camMsg = document.getElementById("cam-msg");
const camSubMsg = document.getElementById("cam-sub-msg");

for(let i=0; i<9; i++) {
    let cell = document.createElement("div");
    cell.style.border = "1px solid rgba(255,255,255,0.2)";
    cell.style.display = "flex";
    cell.style.alignItems = "center";
    cell.style.justifyContent = "center";
    
    let dot = document.createElement("div");
    dot.className = "cam-dot";
    dot.style.width = "25%";
    dot.style.height = "25%";
    dot.style.borderRadius = "50%";
    dot.style.background = "rgba(0,0,0,0.5)";
    dot.style.border = "2px solid white";
    dot.style.cursor = "pointer";
    
    dot.onclick = function() {
        const current = dot.dataset.color || 'U';
        let idx = colorKeys.indexOf(current);
        idx = (idx + 1) % colorKeys.length;
        const next = colorKeys[idx];
        dot.style.backgroundColor = hexToString(colors[next]);
        dot.dataset.color = next;
        dot.dataset.manual = "true"; 
    };
    
    cell.appendChild(dot);
    gridEl.appendChild(cell);
}

for(let f=0; f<6; f++) {
    const faceDiv = document.getElementById(`face-${f}`);
    for(let s=0; s<9; s++) {
        const sticker = document.createElement("div");
        sticker.className = "p-sticker";
        sticker.id = `s-${f}-${s}`;
        faceDiv.appendChild(sticker);
    }
}

document.getElementById("btn-cancel").onclick = stopCameraMode;
document.getElementById("btn-capture").onclick = () => captureFace(false);
document.getElementById("btn-undo").onclick = undoLastFace;
document.getElementById("btn-auto").onclick = function () {
    autoCapture = !autoCapture;
    this.innerText = autoCapture ? "AUTO: ON" : "AUTO: OFF";
    stableFrames = 0;
};

statusEl.innerText = "Loading engine…";
statusEl.style.color = "orange";

const solverWorker = new Worker("worker.js?v=" + Date.now());
let engineReady = false;

solverWorker.onmessage = (e) => {
    const d = e.data;
    if (d.type === "ready") {
        engineReady = true;
        statusEl.innerText = "Ready! Tap SCAN CUBE.";
        statusEl.style.color = "#00ff00";
        if (pendingSolve) { pendingSolve = false; solveCube(); }
    }
    if (d.type === "solution") {
        if (!d.solution || d.solution.startsWith("Error")) {
            statusEl.innerText = "Unsolvable! Check for duplicate colors.";
            statusEl.style.color = "red";
            return;
        }
        if (d.solution.trim() === "") {
             statusEl.innerText = "Cube is already solved!";
             statusEl.style.color = "#00ff88";
             return;
        }

        let rawMoves = d.solution.trim().split(/\s+/).filter(m => m.length > 0);
        solutionMoves = [];
        // keep double turns (F2) as one step
        solutionMoves = rawMoves.slice();
        moveIndex = 0;
        document.getElementById("action-controls").style.display = "none";
        document.getElementById("playback-controls").style.display = "flex";
        updateDisplayMoves();
        updateStepStatus();
        if(hintBox) hintBox.visible = false;
    }
    if (d.type === "error") {
        statusEl.innerText = "Solver error: " + d.message;
        statusEl.style.color = "red";
    }
};

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 19);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById("canvas-container").appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    // light from the viewer's side so the face held towards you is bright
    const fl = new THREE.DirectionalLight(0xffffff, 0.55);
    fl.position.set(0, 2, 20);
    scene.add(fl);
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(10, 20, 10);
    scene.add(dl);
    const bl = new THREE.DirectionalLight(0xffffff, 0.5);
    bl.position.set(-10, -10, -10);
    scene.add(bl);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    pivotGroup = new THREE.Group();
    scene.add(pivotGroup);

    const boxGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05); 
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    hintBox = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 }));
    hintBox.visible = false;
    pivotGroup.add(hintBox);

    createCube();
    
    pivotGroup.quaternion.copy(VIEW_TILT);

    document.addEventListener("mousedown", onInputStart);
    document.addEventListener("mousemove", onInputMove);
    document.addEventListener("mouseup", onInputEnd);
    document.addEventListener("touchstart", onInputStart, { passive: false });
    document.addEventListener("touchmove", onInputMove, { passive: false });
    document.addEventListener("touchend", onInputEnd);

    updatePaletteCounts();
}

function createCube() {
    const children = [...pivotGroup.children];
    children.forEach(c => {
        if(c !== hintBox) pivotGroup.remove(c);
    });

    cubes = [];
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
                    isCenter: (Math.abs(x) + Math.abs(y) + Math.abs(z)) === 1
                };
                pivotGroup.add(cube);
                cubes.push(cube);
            }
}

async function startCameraMode() {
    if(isAnimating) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: {ideal: 1280}, height: {ideal: 720} } 
        });
        videoEl.srcObject = stream;
        videoStream = stream;
        camOverlay.style.display = 'block';
        isCameraActive = true;
        scanIndex = 0;
        scannedFacesData = [];
        liveCells = [];
        prevCells = null;
        stableFrames = 0;
        autoArmed = true;
        steadyFrames = [];
        pausedUntil = 0;
        gridState = null;
        gridLostFrames = 0;
        gridEl.classList.remove("locked");
        document.getElementById("btn-undo").style.display = "none";
        clearHighlights();
        
        document.querySelectorAll('.p-sticker').forEach(s => s.style.backgroundColor = '#2a2a2a');
        const dots = document.getElementsByClassName("cam-dot");
        for(let d of dots) d.dataset.manual = "";

        updateCamInstruction();
        requestAnimationFrame(processCameraFrame);
    } catch(e) {
        alert("Camera access denied. " + e.message);
    }
}

/* Keep the camera's colour settings fixed after the first face, so every
   face is judged under the same white balance (hue is what separates red
   from orange). Only some browsers allow this (e.g. Chrome on Android);
   elsewhere it silently does nothing. */
function lockWhiteBalance() {
    try {
        const track = videoStream && videoStream.getVideoTracks()[0];
        const caps = track && track.getCapabilities ? track.getCapabilities() : {};
        if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes("manual")) {
            track.applyConstraints({ advanced: [{ whiteBalanceMode: "manual" }] }).catch(() => {});
        }
    } catch (e) { /* not supported */ }
}

function stopCameraMode() {
    isCameraActive = false;
    camOverlay.style.display = 'none';
    if(videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

// Start with ANY face. Between scans the user makes these moves; the app
// uses them (with the centre colours) to know exactly how each face was
// held, so no colour has to be on top.
//   tilt = the bottom face comes towards the camera
//   turn = the right face comes towards the camera (turn the cube left)
const SCAN_MOVES = ["tilt", "turn", "turn", "turn", "tilt"];
const SCAN_ORDER = [
    { id: "face-1", rot: "rotateX(-90deg)",
      msg: "1/6 · Show any face", sub: "Hold the cube straight, face filling the square" },
    { id: "face-0", rot: "rotateX(0deg)",
      msg: "2/6 · Tilt the cube towards you", sub: "The bottom face comes to the camera" },
    { id: "face-2", rot: "rotateY(-90deg)",
      msg: "3/6 · Turn the cube left", sub: "The right face comes to the camera" },
    { id: "face-3", rot: "rotateY(-180deg)",
      msg: "4/6 · Turn the cube left", sub: "Keep the same face on top" },
    { id: "face-4", rot: "rotateY(-270deg)",
      msg: "5/6 · Turn the cube left", sub: "Keep the same face on top" },
    { id: "face-5", rot: "rotateZ(90deg) rotateX(90deg)",
      msg: "6/6 · Tilt the cube towards you", sub: "The last unseen face comes to the camera" }
];

function updateCamInstruction() {
    if(scanIndex >= 6) return;
    const step = SCAN_ORDER[scanIndex];
    liveCube.style.transform = step.rot;
    camMsg.innerText = step.msg;
    camSubMsg.innerText = step.sub;
}


/* Where a screen rectangle (relative to the page) lies in the video frame */
function screenRectToVideo(rect) {
    const videoRect = videoEl.getBoundingClientRect();
    const videoRatio = videoEl.videoWidth / videoEl.videoHeight;
    const displayRatio = videoRect.width / videoRect.height;
    let renderW, renderH, renderX, renderY;
    if (displayRatio > videoRatio) {
        renderW = videoRect.width; renderH = videoRect.width / videoRatio;
        renderX = 0; renderY = (videoRect.height - renderH) / 2;
    } else {
        renderW = videoRect.height * videoRatio; renderH = videoRect.height;
        renderX = (videoRect.width - renderW) / 2; renderY = 0;
    }
    const scale = videoEl.videoWidth / renderW;
    return {
        x: (rect.left - videoRect.left - renderX) * scale,
        y: (rect.top - videoRect.top - renderY) * scale,
        w: rect.width * scale, h: rect.height * scale
    };
}

/* ---- Tracking grid: find the cube face in a wide area of the picture
   and move the grid onto it (like ASolver's grid that follows the cube). */
const DET_SIZE = 160;
const detCanvas = document.createElement("canvas");
detCanvas.width = detCanvas.height = DET_SIZE;
const detCtx = detCanvas.getContext("2d", { willReadFrequently: true });
let gridState = null;      // smoothed { x, y, size } relative to the camera area
let gridLostFrames = 0;
let frameCounter = 0;
let gridMoving = false;    // the grid is still sliding onto the cube
let gridLocked = false;    // the grid has found the cube's 3x3 lattice

function defaultGridRect(top) {
    const size = Math.min(window.innerWidth * 0.66, window.innerHeight * 0.30);
    return { x: (top.width - size) / 2, y: (top.height - size) / 2 + top.height * 0.04, size };
}

function placeGrid(r) {
    gridEl.style.left = r.x + "px";
    gridEl.style.top = r.y + "px";
    gridEl.style.width = gridEl.style.height = r.size + "px";
}

function trackFaceGrid() {
    const topEl = gridEl.parentElement;
    const top = topEl.getBoundingClientRect();
    if (!gridState) { gridState = defaultGridRect(top); placeGrid(gridState); }
    if (frameCounter++ % 2) return;                 // every other frame is enough

    // search a square covering most of the camera area
    const side = Math.min(top.width, top.height) * 0.94;
    const search = { left: top.left + (top.width - side) / 2, top: top.top + (top.height - side) / 2, width: side, height: side };
    const src = screenRectToVideo(search);
    detCtx.drawImage(videoEl, src.x, src.y, src.w, src.h, 0, 0, DET_SIZE, DET_SIZE);
    const det = CubeLogic.detectFaceGrid(detCtx.getImageData(0, 0, DET_SIZE, DET_SIZE).data, DET_SIZE, DET_SIZE);

    if (det && det.score >= 7) {
        gridLostFrames = 0;
        const k = side / DET_SIZE;
        const target = { x: search.left - top.left + det.x * k, y: search.top - top.top + det.y * k, size: det.size * k };
        // smooth the movement; jump if the cube moved a lot
        const jump = Math.abs(target.x - gridState.x) + Math.abs(target.y - gridState.y) > target.size * 0.5;
        const a = jump ? 1 : 0.35;
        // small jitter of the detection is normal; only a real slide counts
        gridMoving = Math.abs(target.x - gridState.x) + Math.abs(target.y - gridState.y) +
                     Math.abs(target.size - gridState.size) > target.size * 0.12;
        gridLocked = true;
        gridState = { x: gridState.x + (target.x - gridState.x) * a, y: gridState.y + (target.y - gridState.y) * a,
                      size: gridState.size + (target.size - gridState.size) * a };
        gridEl.classList.add("locked");
    } else if (++gridLostFrames > 15) {
        gridMoving = false;
        gridLocked = false;
        gridState = defaultGridRect(top);
        gridEl.classList.remove("locked");
    }
    placeGrid(gridState);
}

function processCameraFrame() {
    if(!isCameraActive) return;

    if(videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        trackFaceGrid();
        const src = screenRectToVideo(gridEl.getBoundingClientRect());

        canvasEl.width = 300;
        canvasEl.height = 300;
        const ctx2 = canvasEl.getContext("2d");
        ctx2.drawImage(videoEl, src.x, src.y, src.w, src.h, 0, 0, 300, 300);

        liveCells = sampleStickers(ctx2, 300);
        updateLiveDots();
        trackStability();
    }
    requestAnimationFrame(processCameraFrame);
}

/* Read the 9 stickers from the 300x300 crop of the guide square
   (see CubeLogic.analyzeFaceImage: 7x7 samples inset 20% from each
   sticker's edges, median colour, plus a check that the square really
   shows a cube face – stickered or stickerless). */
let liveLooksLikeCube = false;
function sampleStickers(ctx2, size) {
    const res = CubeLogic.analyzeFaceImage(ctx2.getImageData(0, 0, size, size).data, size, { gridLocked });
    liveLooksLikeCube = res.looksLikeCube;
    return res.cells;
}

/* Centre colours of the faces already captured – used as references
   so the live preview gets more accurate as you go. */
function knownCentreColours() {
    const known = {};
    scannedFacesData.forEach(f => {
        const letter = f.manual[4] || CubeLogic.guessLetter(f.rgb[4]);
        known[letter] = f.rgb[4];
    });
    return known;
}

function updateLiveDots() {
    const dots = document.getElementsByClassName("cam-dot");
    const known = knownCentreColours();
    const step = SCAN_ORDER[scanIndex];
    for (let i = 0; i < 9; i++) {
        const dot = dots[i];
        if (!dot.dataset.manual) {
            const match = CubeLogic.guessLetter(liveCells[i], known);
            dot.style.backgroundColor = hexToString(colors[match]);
            dot.dataset.color = match;
        }
        // live-fill the face being scanned on the small 3D guide cube
        if (step) {
            const el = document.getElementById(`${step.id.replace("face", "s")}-${i}`);
            if (el) el.style.backgroundColor = `rgb(${liveCells[i].map(Math.round).join(",")})`;
        }
    }
}

/* Auto-capture: capture when the picture has been steady for ~1.2 s,
   the 9 colour guesses haven't changed during that time, the square shows
   a cube face, and it is a new face. The colours used are the median over
   the whole hold (not one frame), which removes flicker and motion blur.
   After each capture the cube has to be turned (the centre changes or the
   face leaves the square) before the next auto-capture. */
let autoArmed = true;
let holdGuess = "";        // the colour guesses when the current hold started
/* red and orange can flicker on a stickerless cube; that is decided later
   from the median of the hold and the whole-cube check, so it doesn't count
   as movement here */
const guessGroup = l => (l === "L" ? "R" : l);
function guessMismatches(a, b) {
    let n = 0;
    for (let i = 0; i < 9; i++) if (guessGroup(a[i]) !== guessGroup(b[i])) n++;
    return n;
}
function trackStability() {
    const btn = document.getElementById("btn-capture");
    const guess = [...document.getElementsByClassName("cam-dot")].map(d => d.dataset.color).join("");
    /* Each frame is: "moved" (the cube moved or a different face is shown –
       start over), "shaky" (a little noise or glare – doesn't count but
       doesn't reset either) or "still" (counts towards the hold). */
    let state = "moved";
    if (prevCells && liveCells.length === 9 && holdGuess.length === 9) {
        const changes = liveCells.map((c, i) => CubeLogic.redmeanDistance(c, prevCells[i]));
        const big = changes.filter(d => d > STABLE_MAX_CHANGE * 4).length;
        const changed = changes.filter(d => d > STABLE_MAX_CHANGE).length;
        const moved = gridMoving || big >= 3 ||
            guessGroup(guess[4]) !== guessGroup(holdGuess[4]) ||
            guessMismatches(guess, holdGuess) > 2;
        state = moved ? "moved" : changed ? "shaky" : "still";
    }
    prevCells = liveCells.map(c => c.slice());
    if (state === "moved") { stableFrames = 0; steadyFrames = []; holdGuess = guess; }
    else if (state === "still") { stableFrames++; steadyFrames.push(liveCells.map(c => c.slice())); }

    const last = scannedFacesData[scannedFacesData.length - 1];
    if (!autoArmed && (!liveLooksLikeCube || !last || !CubeLogic.sameColour(liveCells[4], last.rgb[4]))) autoArmed = true;

    if (performance.now() < pausedUntil) { stableFrames = 0; steadyFrames = []; return; }
    if (!autoCapture) { btn.innerText = "CAPTURE"; return; }
    if (!liveLooksLikeCube) {
        btn.innerText = "ALIGN CUBE";
        stableFrames = 0; steadyFrames = []; holdGuess = "";
        return;
    }
    if (!autoArmed || isAlreadyScanned(liveCells[4], null)) {
        btn.innerText = "TURN CUBE";
        stableFrames = 0; steadyFrames = [];
        return;
    }
    const pct = Math.min(100, Math.round(stableFrames / STABLE_FRAMES_NEEDED * 100));
    btn.innerText = pct < 100 ? `HOLD STILL ${pct}%` : "CAPTURE";
    if (stableFrames >= STABLE_FRAMES_NEEDED) captureFace(true);
}

/* Median of each sticker's colour over the frames of the steady hold. */
function steadyReading() {
    if (steadyFrames.length < 3) return liveCells.map(c => c.slice());
    return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => CubeLogic.medianRGB(steadyFrames.map(f => f[i])));
}

function undoLastFace() {
    if (!isCameraActive || !scannedFacesData.length) return;
    scannedFacesData.pop();
    scanIndex--;
    const prefix = SCAN_ORDER[scanIndex].id.replace("face", "s");
    for (let i = 0; i < 9; i++) {
        const el = document.getElementById(`${prefix}-${i}`);
        if (el) el.style.backgroundColor = "#2a2a2a";
    }
    autoArmed = true;
    stableFrames = 0; steadyFrames = [];
    updateCamInstruction();
    camSubMsg.innerText = "Last face removed – show it again.";
    document.getElementById("btn-undo").style.display = scannedFacesData.length ? "block" : "none";
}

/* Has this face already been captured? Only nearly identical centre
   colours count, so similar colours (red/orange) never block a scan. */
function isAlreadyScanned(centreRgb, manualCentre) {
    return scannedFacesData.some(f => {
        if (manualCentre && f.manual[4]) return manualCentre === f.manual[4];
        return CubeLogic.sameColour(centreRgb, f.rgb[4]);
    });
}

function hexToString(hex) {
    return "#" + hex.toString(16).padStart(6, '0');
}

function captureFace(isAuto) {
    if (!isCameraActive || scanIndex >= 6 || liveCells.length !== 9) return;
    const dots = document.getElementsByClassName("cam-dot");
    const manual = [];
    const shown = [];
    for (let i = 0; i < 9; i++) {
        manual.push(dots[i].dataset.manual ? dots[i].dataset.color : null);
        shown.push(dots[i].dataset.color);
    }

    // Auto-capture never takes the same face twice; a manual CAPTURE is
    // always accepted (the user decides), duplicates are reported later.
    if (isAuto && isAlreadyScanned(liveCells[4], manual[4])) return;

    const reading = steadyReading();
    scannedFacesData.push({ rgb: reading, manual });
    if (scannedFacesData.length === 1) lockWhiteBalance();

    // freeze the captured colours on the small guide cube
    const prefix = SCAN_ORDER[scanIndex].id.replace("face", "s");
    for (let i = 0; i < 9; i++) {
        const el = document.getElementById(`${prefix}-${i}`);
        if (el) el.style.backgroundColor = hexToString(colors[shown[i]]);
    }
    if (navigator.vibrate) navigator.vibrate(60);

    for (let d of dots) d.dataset.manual = "";
    stableFrames = 0;
    steadyFrames = [];
    autoArmed = false;
    pausedUntil = performance.now() + CAPTURE_PAUSE_MS;
    const btn = document.getElementById("btn-capture");
    btn.innerText = `✓ FACE ${scanIndex + 1} CAPTURED`;
    document.getElementById("btn-undo").style.display = "block";

    scanIndex++;
    if (scanIndex >= 6) {
        stopCameraMode();
        processScannedData();
    } else {
        updateCamInstruction();
    }
}

/* =========================================================
   PART 2: SCAN PROCESSING
   - centre colours decide which face each scan is
   - per-face lighting correction + "9 of each colour" matching
   - every rotation of every face is tried; the valid cube wins
   - if the reading is impossible, uncertain stickers are swapped
     to find a valid cube (and shown to the user)
   ========================================================= */

/* Standard facelet positions (same order as the solver string) */
const FACELET_LAYOUT = [
    { face: 'U', norm: [0,1,0],  pts: [[-1,1,-1],[0,1,-1],[1,1,-1], [-1,1,0],[0,1,0],[1,1,0], [-1,1,1],[0,1,1],[1,1,1]] },
    { face: 'R', norm: [1,0,0],  pts: [[1,1,1],[1,1,0],[1,1,-1], [1,0,1],[1,0,0],[1,0,-1], [1,-1,1],[1,-1,0],[1,-1,-1]] },
    { face: 'F', norm: [0,0,1],  pts: [[-1,1,1],[0,1,1],[1,1,1], [-1,0,1],[0,0,1],[1,0,1], [-1,-1,1],[0,-1,1],[1,-1,1]] },
    { face: 'D', norm: [0,-1,0], pts: [[-1,-1,1],[0,-1,1],[1,-1,1], [-1,-1,0],[0,-1,0],[1,-1,0], [-1,-1,-1],[0,-1,-1],[1,-1,-1]] },
    { face: 'L', norm: [-1,0,0], pts: [[-1,1,-1],[-1,1,0],[-1,1,1], [-1,0,-1],[-1,0,0],[-1,0,1], [-1,-1,-1],[-1,-1,0],[-1,-1,1]] },
    { face: 'B', norm: [0,0,-1], pts: [[1,1,-1],[0,1,-1],[-1,1,-1], [1,0,-1],[0,0,-1],[-1,0,-1], [1,-1,-1],[0,-1,-1],[-1,-1,-1]] }
];

/* Material of the sticker at facelet index 0..53 */
function faceletMaterial(index) {
    const f = FACELET_LAYOUT[Math.floor(index / 9)];
    const pt = f.pts[index % 9];
    const cube = cubes.find(c => Math.round(c.position.x) === pt[0] && Math.round(c.position.y) === pt[1] && Math.round(c.position.z) === pt[2]);
    if (!cube) return null;
    const idx = getVisibleFaceMatIndex(cube, new THREE.Vector3(f.norm[0], f.norm[1], f.norm[2]));
    return idx === -1 ? null : cube.material[idx];
}

function applyFacelets(str) {
    snapToGrid();
    for (let i = 0; i < 54; i++) {
        const m = faceletMaterial(i);
        if (m && colors[str[i]] !== undefined) { m.color.setHex(colors[str[i]]); m.needsUpdate = true; }
    }
}

function highlightFacelets(indices) {
    clearHighlights();
    indices.forEach(i => {
        const m = faceletMaterial(i);
        if (m && highlightedMats.indexOf(m) === -1) highlightedMats.push(m);
    });
}

function clearHighlights() {
    highlightedMats.forEach(m => { if (m.emissive) m.emissive.setHex(0x000000); });
    highlightedMats = [];
}

/* Map a camera-grid position of scan `s` to its facelet index, given the
   rotation the processor chose for that scan. */
function scanCellToFacelet(face, rot, cell) {
    // rotateGrid moves value at ROT_CW[i] to position i; follow `cell` forward
    const ROT_CW = [6, 3, 0, 7, 4, 1, 8, 5, 2];
    let pos = cell;
    for (let t = 0; t < rot; t++) pos = ROT_CW.indexOf(pos);
    return "URFDLB".indexOf(face) * 9 + pos;
}

/* Turn the 3D cube so that `face` points at the viewer with the same
   side up as in the camera (grid rotation `rot` from the scan), plus a
   small tilt so the top and right faces are visible too. */
function orientViewToScan(face, rot) {
    const n = CubeLogic.NORMAL[face];
    const u = CubeLogic.imageUpFor(face, rot);
    const x = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]];
    // rows: camera right, up, towards-viewer – each in cube coordinates
    const m = new THREE.Matrix4().set(
        x[0], x[1], x[2], 0,
        u[0], u[1], u[2], 0,
        n[0], n[1], n[2], 0,
        0, 0, 0, 1);
    const target = new THREE.Quaternion().setFromRotationMatrix(m).premultiply(VIEW_TILT);
    const start = pivotGroup.quaternion.clone(), t0 = performance.now();
    (function step() {
        const p = Math.min(1, (performance.now() - t0) / 700);
        pivotGroup.quaternion.copy(start).slerp(target, p * (2 - p));
        if (p < 1) requestAnimationFrame(step);
        else if (solutionMoves.length) { updateDisplayMoves(); updateStepStatus(); }
    })();
}

function processScannedData() {
    const scans = scannedFacesData.map(f => f.rgb);
    const overrides = scannedFacesData.map(f => f.manual);
    const res = CubeLogic.processScans(scans, { overrides, motions: SCAN_MOVES });

    if (!res.facelets) {
        statusEl.innerText = res.errors[0].message;
        statusEl.style.color = "red";
        return;
    }

    clearSolution();
    applyFacelets(res.facelets);
    updatePaletteCounts();
    // Show the cube the way it is held now: the last scanned face towards
    // the user, with the same side up, so the solution moves match the hand.
    if (res.faceOfScan && res.rotByScan) orientViewToScan(res.faceOfScan[5], res.rotByScan[5]);

    if (res.ok) {
        if (res.fixed.length) {
            const idx = res.fixed.map(fx => fx.facelet);
            highlightFacelets(idx);
            statusEl.innerText = "Scanned! " + res.fixed.length + " unclear sticker" + (res.fixed.length > 1 ? "s were" : " was") + " corrected using the cube's pieces (glowing) – check them. Solving…";
        } else {
            statusEl.innerText = "Scanned! Keep the last face towards you – solving…";
        }
        statusEl.style.color = "#00ff88";
        solveCube();
    } else {
        const bad = [];
        res.errors.forEach(e => (e.facelets || []).forEach(i => bad.push(i)));
        highlightFacelets(bad);
        statusEl.innerText = res.errors[0].message + " Please scan again.";
        statusEl.style.color = "orange";
    }
}

function getFaceNormal(face) {
    if(face === 'U') return new THREE.Vector3(0,1,0);
    if(face === 'D') return new THREE.Vector3(0,-1,0);
    if(face === 'R') return new THREE.Vector3(1,0,0);
    if(face === 'L') return new THREE.Vector3(-1,0,0);
    if(face === 'F') return new THREE.Vector3(0,0,1);
    if(face === 'B') return new THREE.Vector3(0,0,-1);
}

function getColorKey(hex) {
    for (const k in colors) { if (k !== "Core" && colors[k] === hex) return k; }
    return null; 
}

function snapToGrid() {
    cubes.forEach(c => {
        c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z));
        const e = new THREE.Euler().setFromQuaternion(c.quaternion);
        e.x = Math.round(e.x / (Math.PI/2)) * (Math.PI/2);
        e.y = Math.round(e.y / (Math.PI/2)) * (Math.PI/2);
        e.z = Math.round(e.z / (Math.PI/2)) * (Math.PI/2);
        c.quaternion.setFromEuler(e);
        c.updateMatrix();
        c.userData.ix = Math.round(c.position.x);
        c.userData.iy = Math.round(c.position.y);
        c.userData.iz = Math.round(c.position.z);
    });
}

function getVisibleFaceMatIndex(cube, worldDir) {
    const localDir = worldDir.clone().applyQuaternion(cube.quaternion.clone().invert()).round();
    if (localDir.x === 1) return 0;
    if (localDir.x === -1) return 1;
    if (localDir.y === 1) return 2;
    if (localDir.y === -1) return 3;
    if (localDir.z === 1) return 4;
    if (localDir.z === -1) return 5;
    return -1;
}

function saveBoardState() { return cubes.map(c => c.material.map(m => m.color.getHex())); }
function restoreBoardState(saved) {
    cubes.forEach((c, i) => {
        c.material.forEach((m, j) => { m.color.setHex(saved[i][j]); m.needsUpdate = true; });
    });
}

function runLogicalAutofill(simulationMode = false) {
    let loopChanges = true;
    let iteration = 0;
    let filledInThisRun = 0;
    while (loopChanges && iteration < 20) {
        loopChanges = false;
        iteration++;
        let currentCounts = { U:0, R:0, F:0, D:0, L:0, B:0 };
        if (!simulationMode) currentCounts = countColors(getCubeStateString());

        const getExposedFaces = (c) => {
            const x = Math.round(c.position.x), y = Math.round(c.position.y), z = Math.round(c.position.z);
            const exposed = [];
            const check = (wx, wy, wz, faceName) => {
                if ((wx!==0 && x===wx) || (wy!==0 && y===wy) || (wz!==0 && z===wz)) {
                    const idx = getVisibleFaceMatIndex(c, new THREE.Vector3(wx, wy, wz));
                    if (idx !== -1) {
                        const k = getColorKey(c.material[idx].color.getHex());
                        exposed.push({ dir: faceName, mat: c.material[idx], color: k });
                    }
                }
            };
            check(0,1,0,"U"); check(0,-1,0,"D");
            check(1,0,0,"R"); check(-1,0,0,"L");
            check(0,0,1,"F"); check(0,0,-1,"B");
            return exposed;
        };

        let boardAnalysis = []; 
        cubes.forEach(c => {
            if(c.userData.isCenter) return;
            const faces = getExposedFaces(c);
            if(faces.length === 0) return;
            const paintedColors = faces.map(f => f.color).filter(c => c !== null);
            boardAnalysis.push({
                obj: c, type: faces.length === 3 ? 'corner' : 'edge',
                faces: faces, painted: paintedColors,
                isComplete: paintedColors.length === faces.length
            });
        });

        let availableCorners = [...ALL_CORNERS];
        let availableEdges = [...ALL_EDGES];

        boardAnalysis.forEach(p => {
            if (p.isComplete) {
                const set = new Set(p.painted);
                if(p.type === 'corner') {
                    const idx = availableCorners.findIndex(c => c.length === 3 && c.every(col => set.has(col)));
                    if(idx !== -1) availableCorners.splice(idx, 1);
                } else {
                    const idx = availableEdges.findIndex(e => e.length === 2 && e.every(col => set.has(col)));
                    if(idx !== -1) availableEdges.splice(idx, 1);
                }
            }
        });

        boardAnalysis.forEach(p => {
            if (p.isComplete || p.painted.length === 0) return; 
            let candidates = [];
            if (p.type === 'corner') candidates = availableCorners.filter(c => p.painted.every(paint => c.includes(paint)));
            else candidates = availableEdges.filter(e => p.painted.every(paint => e.includes(paint)));
            p.possibleCandidates = candidates; 
            if (candidates.length === 1) {
                if(!simulationMode) {
                    const cand = candidates[0];
                    const needed = cand.filter(c => !p.painted.includes(c));
                    if (needed.some(c => currentCounts[c] >= 9)) return; 
                }
                if(fillPiece(p, candidates[0], simulationMode)) {
                    loopChanges = true;
                    filledInThisRun++;
                }
            }
        });

        if (!loopChanges && !simulationMode) {
            availableCorners.forEach(cand => {
                const compatiblePieces = boardAnalysis.filter(p => p.type === 'corner' && !p.isComplete && p.painted.every(col => cand.includes(col)));
                if (compatiblePieces.length === 1) {
                    if(fillPiece(compatiblePieces[0], cand, simulationMode)) {
                        loopChanges = true;
                        filledInThisRun++;
                    }
                }
            });
            availableEdges.forEach(cand => {
                const compatiblePieces = boardAnalysis.filter(p => p.type === 'edge' && !p.isComplete && p.painted.every(col => cand.includes(col)));
                if (compatiblePieces.length === 1) {
                    if(fillPiece(compatiblePieces[0], cand, simulationMode)) {
                        loopChanges = true;
                        filledInThisRun++;
                    }
                }
            });
        }
    }
    
    if(!simulationMode) {
        let finalAnalysis = generateBoardAnalysis(); 
        calculatePredictiveHint(finalAnalysis);
        updatePaletteCounts();
    }
    return filledInThisRun;
}

function generateBoardAnalysis() { return []; } 

function fillPiece(p, candidateColors, isSimulation) {
    let filledSomething = false;
    const missing = candidateColors.filter(c => !p.painted.includes(c));
    const empty = p.faces.filter(f => f.color === null);
    if (!missing.length || missing.length !== empty.length) return false;

    // Choose the order of the missing colours. For corners only one order
    // is a real piece (the other is its mirror image), so check handedness.
    let order = missing;
    if (p.type === 'corner') {
        const perms = missing.length === 2 ? [missing, [missing[1], missing[0]]] : [missing];
        order = perms.find(perm => {
            let k = 0;
            const cols = p.faces.map(f => f.color !== null ? f.color : perm[k++]);
            return CubeLogic.cornerChiralityOk(p.faces.map(f => f.dir), cols);
        });
        if (!order) return false; // painted colours already form an impossible corner
    } else if (missing.length > 1) {
        return false; // an edge with both sides empty can go either way – don't guess
    }

    let k = 0;
    empty.forEach(f => {
        const fill = order[k++];
        f.mat.color.setHex(colors[fill]);
        f.mat.needsUpdate = true;
        filledSomething = true;
        if(!isSimulation) {
            autofillCount++;
            statsDiv.innerText = "Autofilled: " + autofillCount;
        }
    });
    return filledSomething;
}

function calculatePredictiveHint(boardPieces) {
    hintBox.visible = false;
}

function handlePaint(clientX, clientY) {
    return; // manual colour painting removed – colours come from the scan
    if (isAnimating) return;
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubes);
    if (intersects.length > 0) {
        const hit = intersects[0];
        const obj = hit.object;
        if (obj.userData.isCenter) { statusEl.innerText = "Centers are fixed!"; return; }
        const matIndex = hit.face.materialIndex;
        if (obj.material[matIndex].color.getHex() !== colors[paintColor]) {
             const m = obj.material[matIndex];
             const hi = highlightedMats.indexOf(m);
             if (hi !== -1) { m.emissive.setHex(0x000000); highlightedMats.splice(hi, 1); }
             if (solutionMoves.length) clearSolution();
             obj.material[matIndex].color.setHex(colors[paintColor]);
             obj.material[matIndex].needsUpdate = true;
             updatePaletteCounts();
             runLogicalAutofill(false); 
        }
    }
}

function clearCube() {
    if(isAnimating) return;
    if(!confirm("Clear all colors? Centers will remain.")) return;
    cubes.forEach(c => {
        if(!c.userData.isCenter) c.material.forEach(m => { m.color.setHex(colors.Core); m.needsUpdate = true; });
    });
    solutionTextEl.innerText = "";
    document.getElementById("action-controls").style.display = "flex";
    document.getElementById("playback-controls").style.display = "none";
    autofillCount = 0;
    statsDiv.innerText = "Autofilled: 0";
    hintBox.visible = false;
    updatePaletteCounts();
    statusEl.innerText = "Cube Cleared";
}

function getVisualMove(move) {
    const face = move[0], suffix = move.substring(1);
    const logicalAxes = { U:new THREE.Vector3(0,1,0), D:new THREE.Vector3(0,-1,0), R:new THREE.Vector3(1,0,0), L:new THREE.Vector3(-1,0,0), F:new THREE.Vector3(0,0,1), B:new THREE.Vector3(0,0,-1) };
    // Name moves relative to how the cube is held (front = face towards you),
    // not the tilted 3D view – at 45° two faces would tie.
    const held = VIEW_TILT.clone().invert().multiply(pivotGroup.quaternion);
    const vec = logicalAxes[face].clone().applyQuaternion(held);
    let bestFace = face, maxDot = -Infinity;
    for(const [k, v] of Object.entries(logicalAxes)) {
        const dot = vec.dot(v);
        if(dot > maxDot) { maxDot = dot; bestFace = k; }
    }
    return bestFace + suffix;
}

function updateDisplayMoves() {
    displayMoves = solutionMoves.map(m => getVisualMove(m));
    if(displayMoves.length > 0) solutionTextEl.innerText = "Visual: " + displayMoves.join(" ");
}

function rotateFace(move, reverse=false, onComplete=null, duration=PLAY_SPEED) {
    if (isAnimating && !onComplete) return;
    isAnimating = true;
    let face = move[0], prime = move.includes("'");
    if (reverse) prime = !prime;
    let dir = prime ? 1 : -1, axis = "y", group = [];
    cubes.forEach(c => {
        const { ix, iy, iz } = c.userData;
        if(face==="U" && iy === 1) { axis="y"; group.push(c); }
        if(face==="D" && iy === -1){ axis="y"; dir *= -1; group.push(c); }
        if(face==="R" && ix === 1) { axis="x"; group.push(c); }
        if(face==="L" && ix === -1){ axis="x"; dir *= -1; group.push(c); }
        if(face==="F" && iz === 1) { axis="z"; group.push(c); }
        if(face==="B" && iz === -1){ axis="z"; dir *= -1; group.push(c); }
    });
    const pivot = new THREE.Object3D();
    pivotGroup.add(pivot);
    group.forEach(c => pivot.attach(c));
    const turns = move.includes("2") ? 2 : 1;          // F2 = one half turn
    const targetAngle = (Math.PI/2) * dir * turns, start = Date.now();
    const time = duration * (turns === 2 ? 1.5 : 1);
    function step(){
        const now = Date.now();
        let p = (now - start) / time;
        if(p > 1) p = 1;
        const ease = p * (2 - p);
        pivot.rotation[axis] = targetAngle * ease;
        if(p < 1) requestAnimationFrame(step);
        else {
            pivot.rotation[axis] = targetAngle;
            pivot.updateMatrixWorld();
            group.forEach(c => pivotGroup.attach(c));
            pivotGroup.remove(pivot);
            snapToGrid();
            isAnimating = false;
            runLogicalAutofill(false);
            if(onComplete) onComplete();
        }
    }
    step();
}

function scrambleCube() {
    if (isAnimating) return;
    clearSolution();
    clearHighlights();
    statusEl.innerText = "Scrambling...";
    const moves = Array.from({length: 20}, () => SCRAMBLE_MOVES[Math.floor(Math.random()*SCRAMBLE_MOVES.length)]);
    let i = 0;
    function nextMove() { if(i < moves.length) rotateFace(moves[i++], false, nextMove, 250); else statusEl.innerText = "Ready to Solve"; }
    nextMove();
}

let pendingSolve = false;

function solveCube() {
    if (isAnimating) return;
    if (!engineReady) {
        pendingSolve = true;
        statusEl.innerText = "Solver engine still loading – will solve automatically…";
        statusEl.style.color = "orange";
        return;
    }
    snapToGrid();
    const cubeStr = getCubeStateString();
    if (cubeStr.includes("?")) {
        const missing = [];
        for (let i = 0; i < 54; i++) if (cubeStr[i] === "?") missing.push(i);
        highlightFacelets(missing);
        showProblem("Some stickers are not painted yet (glowing).");
        return;
    }
    // Same checks the solver needs, but with a clear reason and the
    // problem stickers glowing so they can be fixed by tapping.
    const check = CubeLogic.validate(cubeStr);
    if (!check.ok) {
        const bad = [];
        check.errors.forEach(e => (e.facelets || []).forEach(i => bad.push(i)));
        highlightFacelets(bad);
        showProblem(check.errors[0].message);
        return;
    }
    clearHighlights();
    statusEl.innerText = "Computing solution...";
    statusEl.style.color = "cyan";
    solverWorker.postMessage({ type:"solve", cube: cubeStr });
}

function showProblem(msg) {
    statusEl.innerText = "Can't solve: " + msg;
    statusEl.style.color = "orange";
}

function clearSolution() {
    solutionMoves = [];
    displayMoves = [];
    moveIndex = 0;
    if (playInterval) { clearInterval(playInterval); playInterval = null; }
    const btn = document.getElementById("playPauseBtn");
    if (btn) btn.innerText = "PLAY";
    solutionTextEl.innerText = "";
    document.getElementById("action-controls").style.display = "flex";
    document.getElementById("playback-controls").style.display = "none";
}

function getCubeStateString() {
    let state = "";
    const find = (x,y,z) => cubes.find(c => Math.round(c.position.x)===x && Math.round(c.position.y)===y && Math.round(c.position.z)===z);
    const faces = [
        { norm: new THREE.Vector3(0,1,0), pts: [[-1,1,-1],[0,1,-1],[1,1,-1], [-1,1,0],[0,1,0],[1,1,0], [-1,1,1],[0,1,1],[1,1,1]] }, 
        { norm: new THREE.Vector3(1,0,0), pts: [[1,1,1],[1,1,0],[1,1,-1], [1,0,1],[1,0,0],[1,0,-1], [1,-1,1],[1,-1,0],[1,-1,-1]] }, 
        { norm: new THREE.Vector3(0,0,1), pts: [[-1,1,1],[0,1,1],[1,1,1], [-1,0,1],[0,0,1],[1,0,1], [-1,-1,1],[0,-1,1],[1,-1,1]] }, 
        { norm: new THREE.Vector3(0,-1,0), pts: [[-1,-1,1],[0,-1,1],[1,-1,1], [-1,-1,0],[0,-1,0],[1,-1,0], [-1,-1,-1],[0,-1,-1],[1,-1,-1]] }, 
        { norm: new THREE.Vector3(-1,0,0), pts: [[-1,1,-1],[-1,1,0],[-1,1,1], [-1,0,-1],[-1,0,0],[-1,0,1], [-1,-1,-1],[-1,-1,0],[-1,-1,1]] }, 
        { norm: new THREE.Vector3(0,0,-1), pts: [[1,1,-1],[0,1,-1],[-1,1,-1], [1,0,-1],[0,0,-1],[-1,0,-1], [1,-1,-1],[0,-1,-1],[-1,-1,-1]] } 
    ];
    faces.forEach(f => {
        f.pts.forEach(pt => {
            const cube = find(pt[0], pt[1], pt[2]);
            if(cube) {
                const matIdx = getVisibleFaceMatIndex(cube, f.norm);
                const hex = cube.material[matIdx].color.getHex();
                state += getColorKey(hex) || "?";
            } else state += "?";
        });
    });
    return state;
}

function countColors(state) {
    const c = { U:0,R:0,F:0,D:0,L:0,B:0 };
    for (const ch of state) if (c[ch] !== undefined) c[ch]++;
    return c;
}

function updatePaletteCounts() {
    if(isAnimating) return;
    const counts = countColors(getCubeStateString());
    document.querySelectorAll(".swatch").forEach(s => {
        const color = s.dataset.color;
        const span = s.querySelector(".count");
        if (span) span.innerText = counts[color];
        s.style.opacity = (counts[color] >= 9) ? 0.3 : 1;
        if(color === paintColor) s.style.opacity = 1;
    });
}

function selectColor(el, c) {
    paintColor = c;
    document.querySelectorAll(".swatch").forEach(s => s.classList.remove("selected"));
    el.classList.add("selected");
    updatePaletteCounts();
}

function updateStepStatus() {
    const currentVisMove = moveIndex < displayMoves.length ? displayMoves[moveIndex] : "-";
    statusEl.innerHTML = `Move: <b>${currentVisMove}</b> (Step ${moveIndex+1}/${solutionMoves.length})`;
}

function nextMove() {
    if (isAnimating || moveIndex >= solutionMoves.length) return;
    updateDisplayMoves(); updateStepStatus();
    rotateFace(solutionMoves[moveIndex], false, () => {
        moveIndex++;
        if(playInterval && moveIndex < solutionMoves.length) setTimeout(nextMove, MOVE_GAP);
        else if(moveIndex >= solutionMoves.length) { clearInterval(playInterval); playInterval = null; document.getElementById("playPauseBtn").innerText = "PLAY"; statusEl.innerText = "Solved!"; }
    });
}

function prevMove() {
    if (isAnimating || moveIndex <= 0) return;
    moveIndex--; updateDisplayMoves(); updateStepStatus(); rotateFace(solutionMoves[moveIndex], true);
}

function togglePlay() {
    const btn = document.getElementById("playPauseBtn");
    if (playInterval) { clearInterval(playInterval); playInterval = null; if(btn) btn.innerText = "PLAY"; }
    else { if(!solutionMoves.length) return; if(moveIndex >= solutionMoves.length) moveIndex = 0; if(btn) btn.innerText = "PAUSE"; nextMove(); playInterval = 1; }
}

function resetCube() { location.reload(); }

function onInputStart(e) {
    isMouseDown = true; isDragging = false;
    const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
    startMouse = { x: cx, y: cy }; lastMouse = { x: cx, y: cy };
}
// FIX: FREE TRACKBALL ROTATION (No Gimbal Lock)
// FIX: FLAT ROTATION (Dominant Axis Locking)
// FIX: FLAT ROTATION (Dominant Axis Locking)
function onInputMove(e) {
    if (!isMouseDown) return;
    
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    
    const dx = cx - lastMouse.x;
    const dy = cy - lastMouse.y;
    
    if (Math.abs(cx - startMouse.x) > 5 || Math.abs(cy - startMouse.y) > 5) {
        isDragging = true;
    }
    
    if (isDragging) {
        const moveSpeed = 0.006;
        
        // DOMINANT AXIS CHECK
        // If moving mostly Left/Right, ONLY rotate horizontally (Y-axis)
        // If moving mostly Up/Down, ONLY rotate vertically (X-axis)
        
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal Drag -> World Y Rotation
            pivotGroup.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dx * moveSpeed);
        } else {
            // Vertical Drag -> World X Rotation
            pivotGroup.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), dy * moveSpeed);
        }
        
        if(solutionMoves.length > 0) { 
            updateDisplayMoves(); 
            updateStepStatus(); 
        } 
    }
    
    lastMouse = { x: cx, y: cy };
}


function onInputEnd(e) {
    isMouseDown = false;
    if (!isDragging) {
        let cx, cy;
        if(e.changedTouches && e.changedTouches.length > 0) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; } else { cx = e.clientX; cy = e.clientY; }
        handlePaint(cx, cy);
    }
    isDragging = false;
}

function animate() {
    requestAnimationFrame(animate);
    if (hintBox && hintBox.visible) { const time = Date.now() * 0.005; const scale = 1.05 + Math.sin(time * 2) * 0.05; hintBox.scale.set(scale, scale, scale); }
    if (highlightedMats.length) {
        // pulse the stickers that need checking
        const glow = 0.25 + 0.25 * Math.sin(Date.now() * 0.008);
        highlightedMats.forEach(m => m.emissive.setRGB(glow, glow, glow * 0.2));
    }
    renderer.render(scene, camera);
}
