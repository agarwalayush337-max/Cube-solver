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
const PLAY_SPEED = 400; 
const MOVE_GAP = 300;   

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
let scannedFacesData = [];

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
        width: min(70vw, 70vh);
        height: min(70vw, 70vh);
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        grid-template-rows: 1fr 1fr 1fr;
        border: 3px solid rgba(0,255,136,0.6);
        box-shadow: 0 0 30px rgba(0,0,0,0.7);
        z-index: 5;
    }
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
document.getElementById("btn-capture").onclick = captureFace;

statusEl.innerText = "Loading engine…";
statusEl.style.color = "orange";

const solverWorker = new Worker("worker.js?v=" + Date.now());
let engineReady = false;

solverWorker.onmessage = (e) => {
    const d = e.data;
    if (d.type === "ready") {
        engineReady = true;
        statusEl.innerText = "Ready! Paint, Scan or Scramble.";
        statusEl.style.color = "#00ff00";
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
        rawMoves.forEach(move => {
            if (move.includes("2")) {
                let base = move.replace("2", "");
                solutionMoves.push(base); solutionMoves.push(base); 
            } else {
                solutionMoves.push(move);
            }
        });
        
        moveIndex = 0;
        document.getElementById("action-controls").style.display = "none";
        document.getElementById("playback-controls").style.display = "flex";
        updateDisplayMoves();
        updateStepStatus();
        if(hintBox) hintBox.visible = false;
    }
    if (d.type === "error") {
        statusEl.innerText = "Invalid Configuration";
        statusEl.style.color = "red";
        alert("Solver Error: " + d.message);
    }
};

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 16); 
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById("canvas-container").appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
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
    
    pivotGroup.rotation.x = 0.5;
    pivotGroup.rotation.y = -0.6;

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
        
        document.querySelectorAll('.p-sticker').forEach(s => s.style.backgroundColor = '#2a2a2a');
        const dots = document.getElementsByClassName("cam-dot");
        for(let d of dots) d.dataset.manual = "";

        updateCamInstruction();
        requestAnimationFrame(processCameraFrame);
    } catch(e) {
        alert("Camera access denied. " + e.message);
    }
}

function stopCameraMode() {
    isCameraActive = false;
    camOverlay.style.display = 'none';
    if(videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

// SEQUENCE: Front -> Top -> Right -> Back -> Left -> Bottom
// This matches the video: Tilt Down, then Rotate Right, Right, Right, then Tilt to Bottom.
// SEQUENCE: Top -> Front -> Right -> Back -> Left -> Bottom (From Left)
// SEQUENCE: Top -> Front -> Right -> Back -> Left -> Bottom
const SCAN_ORDER = [
    { name: "TOP",   id: "face-1", rot: "rotateX(-90deg)" },                     // 1. Start Top
    { name: "FRONT", id: "face-0", rot: "rotateX(0deg)" },                       // 2. Rotate to Front
    { name: "RIGHT", id: "face-2", rot: "rotateY(-90deg)" },                     // 3. Rotate to Right
    { name: "BACK",  id: "face-3", rot: "rotateY(-180deg)" },                    // 4. Rotate to Back
    { name: "LEFT",  id: "face-4", rot: "rotateY(-270deg)" },                    // 5. Rotate to Left
    { name: "BOTTOM",id: "face-5", rot: "rotateZ(90deg) rotateX(90deg)" }        // 6. Twist Z & Flip X to Bottom
];

function updateCamInstruction() {
    if(scanIndex >= 6) return;
    const step = SCAN_ORDER[scanIndex];
    liveCube.style.transform = step.rot;
    
    if(scanIndex === 0) { 
        camMsg.innerText = "1. Scan TOP (White)"; 
        camSubMsg.innerText = "Start with the Top face"; 
    }
    else if(scanIndex === 1) { 
        camMsg.innerText = "2. Rotate UP -> Scan FRONT"; 
        camSubMsg.innerText = "Tilt cube to see Front (Green)"; 
    }
    else if(scanIndex === 2) { 
        camMsg.innerText = "3. Rotate RIGHT -> Scan RIGHT"; 
        camSubMsg.innerText = "Turn cube left to see Right (Red)"; 
    }
    else if(scanIndex === 3) { 
        camMsg.innerText = "4. Rotate RIGHT -> Scan BACK"; 
        camSubMsg.innerText = "Turn cube left to see Back (Blue)"; 
    }
    else if(scanIndex === 4) { 
        camMsg.innerText = "5. Rotate RIGHT -> Scan LEFT"; 
        camSubMsg.innerText = "Turn cube left to see Left (Orange)"; 
    }
    else if(scanIndex === 5) { 
        camMsg.innerText = "6. Rotate UP -> Scan BOTTOM"; 
        camSubMsg.innerText = "From Left, Tilt cube UP to see Bottom (Yellow)"; 
    }
}


function processCameraFrame() {
    if(!isCameraActive) return;

    if(videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        const gridRect = gridEl.getBoundingClientRect();
        const videoRect = videoEl.getBoundingClientRect();
        const videoRatio = videoEl.videoWidth / videoEl.videoHeight;
        const displayRatio = videoRect.width / videoRect.height;
        let renderW, renderH, renderX, renderY;
        
        if (displayRatio > videoRatio) {
            renderW = videoRect.width;
            renderH = videoRect.width / videoRatio;
            renderX = 0;
            renderY = (videoRect.height - renderH) / 2;
        } else {
            renderW = videoRect.height * videoRatio;
            renderH = videoRect.height;
            renderX = (videoRect.width - renderW) / 2;
            renderY = 0;
        }

        const relGridX = (gridRect.left - videoRect.left) - renderX;
        const relGridY = (gridRect.top - videoRect.top) - renderY;
        const scale = videoEl.videoWidth / renderW;
        const srcX = relGridX * scale;
        const srcY = relGridY * scale;
        const srcW = gridRect.width * scale;
        const srcH = gridRect.height * scale;

        canvasEl.width = 300;
        canvasEl.height = 300;
        const ctx2 = canvasEl.getContext("2d");
        ctx2.drawImage(videoEl, srcX, srcY, srcW, srcH, 0, 0, 300, 300);
        
        const dots = document.getElementsByClassName("cam-dot");
        const cellW = 300 / 3;
        const cellH = 300 / 3;
        
        for(let row=0; row<3; row++) {
            for(let col=0; col<3; col++) {
                const x = col * cellW + cellW/2;
                const y = row * cellH + cellH/2;
                const frame = ctx2.getImageData(x-5, y-5, 10, 10).data;
                let r=0, g=0, b=0;
                for(let i=0; i<frame.length; i+=4) {
                    r+=frame[i]; g+=frame[i+1]; b+=frame[i+2];
                }
                const count = frame.length / 4;
                r = Math.floor(r/count); g = Math.floor(g/count); b = Math.floor(b/count);

                const dot = dots[row*3 + col];
                if(!dot.dataset.manual) {
                    const match = getHsvColor(r, g, b); 
                    dot.style.backgroundColor = hexToString(colors[match]);
                    dot.dataset.color = match;
                }
            }
        }
    }
    requestAnimationFrame(processCameraFrame);
}

function getHsvColor(r, g, b) {
    const [h, s, v] = rgbToHsv(r, g, b);
    if (s < 0.25 || (s < 0.40 && v > 0.8 && h > 45 && h < 90)) return 'U';
    if (h > 160 && h < 270 && s > 0.3) return 'B';
    if (h >= 330 || h <= 15) return 'R';
    if (h > 15 && h <= 45) return 'L'; 
    if (h > 45 && h <= 85) return 'D'; 
    if (h > 85 && h <= 160) return 'F'; 
    return v > 0.8 ? 'U' : 'U'; 
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) h = 0; 
    else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s, v];
}

function hexToString(hex) {
    return "#" + hex.toString(16).padStart(6, '0');
}

function captureFace() {
    const dots = document.getElementsByClassName("cam-dot");
    let currentFaceColors = [];
    for(let i=0; i<9; i++) currentFaceColors.push(dots[i].dataset.color);

    const faceId = SCAN_ORDER[scanIndex].id; 
    for(let i=0; i<9; i++) {
        const prefix = faceId.replace("face", "s"); 
        const el = document.getElementById(`${prefix}-${i}`);
        if(el) el.style.backgroundColor = hexToString(colors[currentFaceColors[i]]);
    }

    scannedFacesData.push(currentFaceColors);
    for(let d of dots) d.dataset.manual = "";

    scanIndex++;
    if(scanIndex >= 6) {
        stopCameraMode();
        processScannedData();
    } else {
        updateCamInstruction();
    }
}

/* =========================================================
   PART 2: SMART DATA PROCESSOR (Auto-Orientation)
   ========================================================= */

// Standard Cube Topology (Who is where?)
// Format: [Top, Right, Bottom, Left] neighbors for each face
/* =========================================================
   STEP 2: SMART AUTO-ORIENTATION SOLVER
   ========================================================= */

// 1. The "Truth" of a Solved Cube (Neighbor Order: [Top, Right, Bottom, Left])
// This defines which face is where relative to the center, assuming the face is upright.
/* =========================================================
   STEP 2: CHAIN-LINK AUTO-ORIENTATION
   ========================================================= */

// 1. The Standard Neighbors of every color (Solved State)
// Order: [Top, Right, Bottom, Left]
const CUBE_TOPOLOGY = {
    U: ['B', 'R', 'F', 'L'], 
    F: ['U', 'R', 'D', 'L'], 
    R: ['U', 'B', 'D', 'F'], 
    B: ['U', 'L', 'D', 'R'], 
    L: ['U', 'F', 'D', 'B'], 
    D: ['F', 'R', 'B', 'L']  
};

function processScannedData() {
    const centers = scannedFacesData.map(f => f[4]);
    
    // Safety check
    if(new Set(centers).size !== 6) {
        alert("Scan Error: Duplicate centers. Please Scan Again.");
        return;
    }

    const processedData = scannedFacesData.map((faceColors, scanIdx) => {
        const myCenter = faceColors[4];
        let refNeighborColor, refNeighborPosOnScreen;

        // --- THE CHAIN LINK LOGIC ---
        // We define ONE fixed anchor point for every scan based on the user's movement.
        
        if (scanIdx === 0) { 
            // Scan 0 (Top): The User will next scan Face 1 (Front).
            // Physically, Face 1 is at the BOTTOM edge of Face 0.
            refNeighborColor = centers[1];
            refNeighborPosOnScreen = 2; // 0=Top, 1=Right, 2=Bottom, 3=Left
        } 
        else if (scanIdx === 1) {
            // Scan 1 (Front): The User just came from Face 0 (Top).
            // Physically, Face 0 is at the TOP edge of Face 1.
            refNeighborColor = centers[0];
            refNeighborPosOnScreen = 0; // Top
        }
        else if (scanIdx >= 2 && scanIdx <= 4) {
            // Scan 2, 3, 4 (Sides): User rotated RIGHT to get here.
            // So the PREVIOUS face is on the LEFT edge.
            refNeighborColor = centers[scanIdx - 1];
            refNeighborPosOnScreen = 3; // Left
        }
        else if (scanIdx === 5) {
            // Scan 5 (Bottom): User tilted UP from Face 4 (Left).
            // Physically, Face 4 is at the TOP edge of Face 5.
            refNeighborColor = centers[4];
            refNeighborPosOnScreen = 0; // Top
        }

        // --- CALCULATE ROTATION ---
        // 1. Find where the Standard Cube says this neighbor SHOULD be.
        const standardNeighbors = CUBE_TOPOLOGY[myCenter];
        const standardPos = standardNeighbors.indexOf(refNeighborColor);

        // 2. Rotate grid so Screen Position matches Standard Position
        // Formula: (ScreenPos - StandardPos + 4) % 4
        // Example: Neighbor is at Screen Top (0). Should be at Right (1).
        // Rotation = (0 - 1 + 4) % 4 = 3 (Rotate 270 deg / 90 deg CCW)
        
        // Wait! If I have Neighbor at Screen Top (0), and it belongs at Right (1).
        // I need to rotate my grid 90 degrees CLOCKWISE so that the "Top" pixels move to the "Right".
        // Let's trace: 
        // [N, x, x] (N at Top) -> Rotate 90 -> [x, x, N] (N at Right)
        // So Rotation = (Target - Source + 4) % 4
        
        const rotationNeeded = (standardPos - refNeighborPosOnScreen + 4) % 4;

        return rotateFaceArray(faceColors, rotationNeeded);
    });

    // Paint the Cube
    const centerMap = {};
    processedData.forEach((data) => centerMap[data[4]] = data);

    ['U', 'R', 'F', 'D', 'L', 'B'].forEach(faceKey => {
        const faceData = centerMap[faceKey];
        if(!faceData) return;
        
        let targetCubes = getCubesForFace(faceKey);
        targetCubes = sortCubesForGrid(targetCubes, faceKey);
        
        for(let i=0; i<9; i++) {
            const c = targetCubes[i];
            if(!c.userData.isCenter) {
                const hex = colors[faceData[i]];
                const norm = getFaceNormal(faceKey);
                const matIdx = getVisibleFaceMatIndex(c, norm);
                if(matIdx !== -1) {
                    c.material[matIdx].color.setHex(hex);
                    c.material[matIdx].needsUpdate = true;
                }
            }
        }
    });

    statusEl.innerText = "Scan Mapped! Solving...";
    runLogicalAutofill(false); 
    updatePaletteCounts();
    solveCube();
}

// Helper: Rotate array 90 degrees Clockwise
function rotateFaceArray(arr, times) {
    let res = [...arr];
    for(let t=0; t<times; t++) {
        const temp = [...res];
        res[0]=temp[6]; res[1]=temp[3]; res[2]=temp[0];
        res[3]=temp[7]; res[4]=temp[4]; res[5]=temp[1];
        res[6]=temp[8]; res[7]=temp[5]; res[8]=temp[2];
    }
    return res;
}

// Helper: Rotate array 90 degrees Clockwise 'times' times
function rotateFaceArray(arr, times) {
    let res = [...arr];
    for(let t=0; t<times; t++) {
        const temp = [...res];
        // 0 1 2    6 3 0
        // 3 4 5 -> 7 4 1
        // 6 7 8    8 5 2
        res[0]=temp[6]; res[1]=temp[3]; res[2]=temp[0];
        res[3]=temp[7]; res[4]=temp[4]; res[5]=temp[1];
        res[6]=temp[8]; res[7]=temp[5]; res[8]=temp[2];
    }
    return res;
}


function getFaceNormal(face) {
    if(face === 'U') return new THREE.Vector3(0,1,0);
    if(face === 'D') return new THREE.Vector3(0,-1,0);
    if(face === 'R') return new THREE.Vector3(1,0,0);
    if(face === 'L') return new THREE.Vector3(-1,0,0);
    if(face === 'F') return new THREE.Vector3(0,0,1);
    if(face === 'B') return new THREE.Vector3(0,0,-1);
}

function getCubesForFace(face) {
    const list = [];
    cubes.forEach(c => {
        const x = Math.round(c.position.x);
        const y = Math.round(c.position.y);
        const z = Math.round(c.position.z);
        if(face === 'U' && y === 1) list.push(c);
        if(face === 'D' && y === -1) list.push(c);
        if(face === 'R' && x === 1) list.push(c);
        if(face === 'L' && x === -1) list.push(c);
        if(face === 'F' && z === 1) list.push(c);
        if(face === 'B' && z === -1) list.push(c);
    });
    return list;
}

// --- FIX: EXACT ORIENTATION MAPPING ---
// This ensures colors land on the 3D cube EXACTLY as they appear in the camera grid
// Ensure the 3D mapping knows this specific 'Front -> Top' orientation for accurate colors
// --- FIX: EXACT ORIENTATION MAPPING (INVERTED 180°) ---
/* =========================================================
   FIX: STANDARD GEOMETRIC MAPPING (1:1 with Camera)
   =========================================================
   This maps the camera grid (Top-Left -> Bottom-Right) 
   directly to the physical Top-Left -> Bottom-Right of each face.
   
   Assumption: When scanning a face, you hold the cube such that 
   that face is "Upright" (e.g., White is effectively on Top).
*/

// PART 1: STANDARD MAPPING (Do not change this again)
// This maps the camera grid 1:1 to the cube face.
// --- STEP 1: STANDARD GEOMETRIC MAPPING (1:1 Physics) ---
// STEP 1: STANDARD MAPPING (Physics Engine)
function sortCubesForGrid(list, face) {
    return list.sort((a,b) => {
        const ax = Math.round(a.position.x), ay = Math.round(a.position.y), az = Math.round(a.position.z);
        const bx = Math.round(b.position.x), by = Math.round(b.position.y), bz = Math.round(b.position.z);

        // U (Top): Back-Row First (Z-Ascending), then Left-to-Right (X-Ascending)
        if(face === 'U') return (az - bz) || (ax - bx);
        // F (Front): Top-Row First (Y-Descending), then Left-to-Right (X-Ascending)
        if(face === 'F') return (by - ay) || (ax - bx);
        // R (Right): Top-Row First (Y-Descending), then Front-to-Back (Z-Descending)
        // Note: On Right face, Z-Descending moves from Front edge to Back edge
        if(face === 'R') return (by - ay) || (bz - az);
        // B (Back): Top-Row First (Y-Descending), then Right-to-Left (X-Descending)
        // Note: On Back face, X-Descending moves from Right edge to Left edge
        if(face === 'B') return (by - ay) || (bx - ax);
        // L (Left): Top-Row First (Y-Descending), then Back-to-Front (Z-Ascending)
        // Note: On Left face, Z-Ascending moves from Back edge to Front edge
        if(face === 'L') return (by - ay) || (az - bz);
        // D (Bottom): Front-Row First (Z-Descending), then Left-to-Right (X-Ascending)
        if(face === 'D') return (bz - az) || (ax - bx);
    });
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
    p.faces.forEach(f => {
        if (f.color === null && missing.length > 0) {
            const fill = missing.shift(); 
            f.mat.color.setHex(colors[fill]);
            f.mat.needsUpdate = true;
            filledSomething = true;
            if(!isSimulation) {
                autofillCount++;
                statsDiv.innerText = "Autofilled: " + autofillCount;
            }
        }
    });
    return filledSomething;
}

function calculatePredictiveHint(boardPieces) {
    hintBox.visible = false;
}

function handlePaint(clientX, clientY) {
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
    const vec = logicalAxes[face].clone().applyQuaternion(pivotGroup.quaternion); 
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

function rotateFace(move, reverse=false, onComplete=null) {
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
    const targetAngle = (Math.PI/2) * dir, start = Date.now();
    function step(){
        const now = Date.now();
        let p = (now - start) / PLAY_SPEED;
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
    statusEl.innerText = "Scrambling...";
    const moves = Array.from({length: 20}, () => SCRAMBLE_MOVES[Math.floor(Math.random()*SCRAMBLE_MOVES.length)]);
    let i = 0;
    function nextMove() { if(i < moves.length) rotateFace(moves[i++], false, nextMove); else statusEl.innerText = "Ready to Solve"; }
    nextMove();
}

function solveCube() {
    if (!engineReady) return alert("Engine loading...");
    snapToGrid();
    const cubeStr = getCubeStateString();
    if(cubeStr.includes("?")) { alert("Some faces are not painted!"); return; }
    const counts = countColors(cubeStr);
    if (Object.values(counts).some(v => v !== 9)) { alert(`Invalid Colors! Each color must appear exactly 9 times.`); return; }
    statusEl.innerText = "Computing solution...";
    statusEl.style.color = "cyan";
    solverWorker.postMessage({ type:"solve", cube: cubeStr });
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
function onInputMove(e) {
    if (!isMouseDown) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = cx - lastMouse.x, dy = cy - lastMouse.y;
    if (Math.abs(cx - startMouse.x) > 5 || Math.abs(cy - startMouse.y) > 5) isDragging = true;
    if (isDragging) { pivotGroup.rotation.y += dx * 0.006; pivotGroup.rotation.x += dy * 0.006; if(solutionMoves.length > 0) { updateDisplayMoves(); updateStepStatus(); } }
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
    renderer.render(scene, camera);
}
