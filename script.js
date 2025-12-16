/* =========================================================
   RUBIK'S CUBE SOLVER – ULTIMATE EDITION (CAMERA + AI)
   ========================================================= */

/* =======================
   CONFIG & CONSTANTS
======================= */
const colors = {
    U: 0xffffff, // White
    R: 0xb90000, // Red
    F: 0x00ff00, // Green (Bright Lime)
    D: 0xffd500, // Yellow
    L: 0xff3300, // Orange (Red-Orange)
    B: 0x0051ba, // Blue
    Core: 0x202020 // Dark Grey (Internal)
};

// Map standardized colors to RGB vectors for Camera matching
const paletteRGB = {
    U: { r:255, g:255, b:255 },
    R: { r:185, g:0,   b:0   },
    F: { r:0,   g:255, b:0   },
    D: { r:255, g:213, b:0   },
    L: { r:255, g:51,  b:0   },
    B: { r:0,   g:81,  b:186 }
};

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
let scanFaceOrder = ['F', 'R', 'B', 'L', 'U', 'D']; // Standard rotation flow
let scanIndex = 0;
let isMirrored = false; // Laptop vs Mobile

/* =======================
   UI ELEMENTS (Dynamic Injection)
======================= */
const statusEl = document.getElementById("status");
const solutionTextEl = document.getElementById("solutionText");

// Autofill Stats
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

// Camera Overlay Container
const camOverlay = document.createElement("div");
camOverlay.id = "cam-overlay";
Object.assign(camOverlay.style, {
    position: 'absolute', top:0, left:0, width:'100%', height:'100%',
    background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'none',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
});
camOverlay.innerHTML = `
    <h2 id="cam-instruction" style="color:white; margin-bottom:10px;">Scan FRONT Face</h2>
    <div style="position:relative; width:300px; height:300px; border:2px solid #fff;">
        <video id="cam-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover;"></video>
        <canvas id="cam-canvas" width="300" height="300" style="position:absolute; top:0; left:0;"></canvas>
        <div id="grid-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; display:grid; grid-template-columns:1fr 1fr 1fr; grid-template-rows:1fr 1fr 1fr;">
            </div>
    </div>
    <div style="margin-top:15px; display:flex; gap:10px;">
        <button id="btn-mirror" class="tool-btn" style="padding:10px;">Flip Mirror</button>
        <button id="btn-capture" class="tool-btn" style="background:#00ff00; color:#000; padding:10px 20px; font-weight:bold;">CAPTURE</button>
        <button id="btn-close-cam" class="tool-btn" style="background:#ff3300; padding:10px;">X</button>
    </div>
    <div id="cam-warning" style="color:orange; margin-top:5px; font-size:12px; height:15px;"></div>
`;
document.body.appendChild(camOverlay);

const videoEl = document.getElementById("cam-video");
const canvasEl = document.getElementById("cam-canvas");
const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
const gridEl = document.getElementById("grid-overlay");
const camInstruction = document.getElementById("cam-instruction");
const camWarning = document.getElementById("cam-warning");

// Fill Grid
for(let i=0; i<9; i++) {
    let cell = document.createElement("div");
    cell.style.border = "1px solid rgba(255,255,255,0.3)";
    cell.style.display = "flex";
    cell.style.alignItems = "center";
    cell.style.justifyContent = "center";
    
    let dot = document.createElement("div");
    dot.className = "cam-dot";
    dot.style.width = "20px";
    dot.style.height = "20px";
    dot.style.borderRadius = "50%";
    dot.style.background = "transparent";
    dot.style.border = "2px solid white";
    dot.style.boxShadow = "0 0 4px black";
    
    cell.appendChild(dot);
    gridEl.appendChild(cell);
}

// Camera Events
document.getElementById("btn-mirror").onclick = () => {
    isMirrored = !isMirrored;
    videoEl.style.transform = isMirrored ? "scaleX(-1)" : "none";
};
document.getElementById("btn-close-cam").onclick = stopCameraMode;
document.getElementById("btn-capture").onclick = captureFace;


/* =======================
   WORKER SETUP
======================= */
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

/* =======================
   INIT SCENE
======================= */
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

    // Hint Box
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

/* =======================
   CAMERA MODULE
======================= */
async function startCameraMode() {
    if(isAnimating) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: {ideal: 640}, height: {ideal: 640} } 
        });
        videoEl.srcObject = stream;
        videoStream = stream;
        camOverlay.style.display = 'flex';
        isCameraActive = true;
        scanIndex = 0;
        
        // Default to mirrored for laptops (assumed if no facingMode specific support found, but safer to start false)
        isMirrored = false; 
        videoEl.style.transform = "none";
        
        updateCamInstruction();
        requestAnimationFrame(processCameraFrame);
    } catch(e) {
        alert("Camera access denied or unavailable. " + e.message);
    }
}

function stopCameraMode() {
    isCameraActive = false;
    camOverlay.style.display = 'none';
    if(videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    // Run autofill once after scanning
    runLogicalAutofill(false);
    updatePaletteCounts();
}

function updateCamInstruction() {
    const face = scanFaceOrder[scanIndex];
    let text = "";
    if(face === 'F') text = "Scan FRONT (Green Center)";
    if(face === 'R') text = "Rotate RIGHT (Red Center)";
    if(face === 'B') text = "Rotate RIGHT (Blue Center)";
    if(face === 'L') text = "Rotate RIGHT (Orange Center)";
    if(face === 'U') text = "Rotate UP (White Center)";
    if(face === 'D') text = "Rotate DOWN (Yellow Center)";
    camInstruction.innerText = text;
}

function processCameraFrame() {
    if(!isCameraActive) return;

    if(videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        ctx.drawImage(videoEl, 0, 0, 300, 300);
        
        // Analyze 9 grid points
        const dots = document.getElementsByClassName("cam-dot");
        const cellW = 300 / 3;
        const cellH = 300 / 3;
        
        let validColors = 0;

        for(let row=0; row<3; row++) {
            for(let col=0; col<3; col++) {
                // Center of the cell
                const x = col * cellW + cellW/2;
                const y = row * cellH + cellH/2;
                
                // Average 10x10 area
                const frame = ctx.getImageData(x-5, y-5, 10, 10).data;
                let r=0, g=0, b=0;
                for(let i=0; i<frame.length; i+=4) {
                    r+=frame[i]; g+=frame[i+1]; b+=frame[i+2];
                }
                const count = frame.length / 4;
                r = Math.floor(r/count);
                g = Math.floor(g/count);
                b = Math.floor(b/count);

                // Detect Haziness (Low Contrast)
                const maxC = Math.max(r,g,b);
                const minC = Math.min(r,g,b);
                if(maxC - minC < 20) {
                    camWarning.innerText = "⚠️ Image too hazy/dark. Improve lighting.";
                } else {
                    camWarning.innerText = "";
                }

                // Match to Palette
                const match = getClosestColor(r, g, b);
                
                // Update Overlay Dot
                const dotIndex = row*3 + col;
                const visualIndex = isMirrored ? (row*3 + (2-col)) : dotIndex; // Flip visual logic
                
                dots[visualIndex].style.backgroundColor = hexToString(colors[match]);
                dots[visualIndex].dataset.color = match;
            }
        }
    }
    requestAnimationFrame(processCameraFrame);
}

function getClosestColor(r, g, b) {
    let minDist = Infinity;
    let closest = 'U';
    
    for(const [key, val] of Object.entries(paletteRGB)) {
        // Euclidean distance
        const dist = Math.sqrt(
            Math.pow(val.r - r, 2) +
            Math.pow(val.g - g, 2) +
            Math.pow(val.b - b, 2)
        );
        if(dist < minDist) {
            minDist = dist;
            closest = key;
        }
    }
    return closest;
}

function hexToString(hex) {
    return "#" + hex.toString(16).padStart(6, '0');
}

function captureFace() {
    const dots = document.getElementsByClassName("cam-dot");
    const faceChar = scanFaceOrder[scanIndex];
    
    // Map 2D grid to 3D cube state
    // 0 1 2
    // 3 4 5
    // 6 7 8
    
    // Determine rotation logic based on current scanIndex to map to 3D view
    // Note: We are just blindly painting the face 'faceChar' with the scanned colors
    // We need to know which 3D cubes correspond to this face.
    
    // Get target cubes for this face
    let targetCubes = getCubesForFace(faceChar);
    
    // Sort targetCubes to match Top-Left to Bottom-Right order
    targetCubes = sortCubesForGrid(targetCubes, faceChar);

    // Apply colors
    for(let i=0; i<9; i++) {
        // 4 is Center, skip center to keep orientation valid? 
        // No, standard centers are fixed. But user might hold cube wrong.
        // Let's assume standard orientation and only paint non-centers.
        const c = targetCubes[i];
        if(!c.userData.isCenter) {
            const detectedColor = dots[i].dataset.color;
            // Find face material index
            const norm = getFaceNormal(faceChar);
            const matIdx = getVisibleFaceMatIndex(c, norm);
            if(matIdx !== -1) {
                c.material[matIdx].color.setHex(colors[detectedColor]);
                c.material[matIdx].needsUpdate = true;
            }
        }
    }
    
    scanIndex++;
    if(scanIndex >= scanFaceOrder.length) {
        stopCameraMode();
        statusEl.innerText = "Scan Complete! Solving...";
        solveCube();
    } else {
        updateCamInstruction();
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

// Sorts 9 cubes into Top-Left -> Bottom-Right order visual for that face
function sortCubesForGrid(list, face) {
    return list.sort((a,b) => {
        const ax = Math.round(a.position.x); const ay = Math.round(a.position.y); const az = Math.round(a.position.z);
        const bx = Math.round(b.position.x); const by = Math.round(b.position.y); const bz = Math.round(b.position.z);
        
        // Logic: Sort by Y (Top to Bottom), then by X/Z (Left to Right)
        if(face === 'F') return (by - ay) || (ax - bx); // Y desc, X asc
        if(face === 'B') return (by - ay) || (bx - ax); // Y desc, X desc
        if(face === 'R') return (by - ay) || (bz - az); // Y desc, Z desc
        if(face === 'L') return (by - ay) || (az - bz); // Y desc, Z asc
        if(face === 'U') return (az - bz) || (ax - bx); // Z asc, X asc
        if(face === 'D') return (bz - az) || (ax - bx); // Z desc, X asc
    });
}


/* =======================
   HELPERS & LOGIC
======================= */
function getColorKey(hex) {
    for (const k in colors) {
        if (k === "Core") continue;
        if (colors[k] === hex) return k;
    }
    return null; 
}

function snapToGrid() {
    cubes.forEach(c => {
        c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z));
        const euler = new THREE.Euler().setFromQuaternion(c.quaternion);
        euler.x = Math.round(euler.x / (Math.PI/2)) * (Math.PI/2);
        euler.y = Math.round(euler.y / (Math.PI/2)) * (Math.PI/2);
        euler.z = Math.round(euler.z / (Math.PI/2)) * (Math.PI/2);
        c.quaternion.setFromEuler(euler);
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

/* =======================
   STATE MANAGEMENT
======================= */
function saveBoardState() {
    return cubes.map(c => c.material.map(m => m.color.getHex()));
}

function restoreBoardState(saved) {
    cubes.forEach((c, i) => {
        c.material.forEach((m, j) => {
            const hex = saved[i][j];
            m.color.setHex(hex);
            m.needsUpdate = true; 
        });
    });
}

/* =======================
   RECURSIVE LOGICAL FILL
======================= */
function runLogicalAutofill(simulationMode = false) {
    let loopChanges = true;
    let iteration = 0;
    let filledInThisRun = 0;
    
    while (loopChanges && iteration < 20) {
        loopChanges = false;
        iteration++;

        let currentCounts = { U:0, R:0, F:0, D:0, L:0, B:0 };
        if (!simulationMode) {
            const state = getCubeStateString();
            currentCounts = countColors(state);
        }

        const getExposedFaces = (c) => {
            const x = Math.round(c.position.x);
            const y = Math.round(c.position.y);
            const z = Math.round(c.position.z);
            const exposed = [];
            const check = (wx, wy, wz, faceName) => {
                if ((wx!==0 && x===wx) || (wy!==0 && y===wy) || (wz!==0 && z===wz)) {
                    const norm = new THREE.Vector3(wx, wy, wz);
                    const matIdx = getVisibleFaceMatIndex(c, norm);
                    if (matIdx !== -1) {
                        const mat = c.material[matIdx];
                        const k = getColorKey(mat.color.getHex());
                        exposed.push({ dir: faceName, mat: mat, color: k, matIndex: matIdx });
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

function generateBoardAnalysis() {
    let availableCorners = [...ALL_CORNERS];
    let availableEdges = [...ALL_EDGES];
    let boardAnalysis = [];

    cubes.forEach(c => {
        if(c.userData.isCenter) return;
        const exposed = [];
        const x = Math.round(c.position.x);
        const y = Math.round(c.position.y);
        const z = Math.round(c.position.z);
        
        const check = (wx, wy, wz, faceName) => {
            if ((wx!==0 && x===wx) || (wy!==0 && y===wy) || (wz!==0 && z===wz)) {
                const norm = new THREE.Vector3(wx, wy, wz);
                const matIdx = getVisibleFaceMatIndex(c, norm);
                if (matIdx !== -1) {
                    const mat = c.material[matIdx];
                    const k = getColorKey(mat.color.getHex());
                    exposed.push({ dir: faceName, mat: mat, color: k });
                }
            }
        };
        check(0,1,0,"U"); check(0,-1,0,"D");
        check(1,0,0,"R"); check(-1,0,0,"L");
        check(0,0,1,"F"); check(0,0,-1,"B");
        
        if(exposed.length > 0) {
            const paintedColors = exposed.map(f => f.color).filter(c => c !== null);
            boardAnalysis.push({
                obj: c, type: exposed.length === 3 ? 'corner' : 'edge',
                faces: exposed, painted: paintedColors,
                isComplete: paintedColors.length === exposed.length
            });
        }
    });

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
        if (!p.isComplete && p.painted.length > 0) {
            if (p.type === 'corner') p.possibleCandidates = availableCorners.filter(c => p.painted.every(paint => c.includes(paint)));
            else p.possibleCandidates = availableEdges.filter(e => p.painted.every(paint => e.includes(paint)));
        }
    });

    return boardAnalysis;
}

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
    let candidates = boardPieces.filter(p => 
        !p.isComplete && p.painted.length > 0 && p.possibleCandidates && p.possibleCandidates.length > 0
    );

    if (candidates.length === 0) {
        hintBox.visible = false;
        return;
    }

    let bestScore = 0;
    let bestPiece = null;
    const originalState = saveBoardState();

    candidates.forEach(piece => {
        const testCandidate = piece.possibleCandidates[0]; 
        let emptyFace = piece.faces.find(f => f.color === null);
        
        if (emptyFace && testCandidate) {
            const neededColors = testCandidate.filter(c => !piece.painted.includes(c));
            if(neededColors.length > 0) {
                const testColor = neededColors[0];
                try {
                    emptyFace.mat.color.setHex(colors[testColor]);
                    emptyFace.mat.needsUpdate = true;
                    
                    const reactionScore = runLogicalAutofill(true);
                    if (reactionScore > bestScore) {
                        bestScore = reactionScore;
                        bestPiece = piece;
                    }
                } finally {
                    restoreBoardState(originalState);
                }
            }
        }
    });

    if (bestPiece && bestScore > 0) {
        hintBox.position.copy(bestPiece.obj.position);
        hintBox.quaternion.copy(bestPiece.obj.quaternion);
        hintBox.visible = true;
    } else {
        hintBox.visible = false;
    }
}

/* =======================
   INTERACTION
======================= */
function handlePaint(clientX, clientY) {
    if (isAnimating) return;
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubes);

    if (intersects.length > 0) {
        const hit = intersects[0];
        const obj = hit.object;
        if (obj.userData.isCenter) {
             statusEl.innerText = "Centers are fixed!";
             return;
        }
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
        if(!c.userData.isCenter) {
             c.material.forEach(m => { m.color.setHex(colors.Core); m.needsUpdate = true; });
        }
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

/* =======================
   ROTATION & VISUAL MAPPING
======================= */
function getVisualMove(move) {
    const face = move[0];
    const suffix = move.substring(1);
    
    const logicalAxes = {
        U: new THREE.Vector3(0, 1, 0), D: new THREE.Vector3(0, -1, 0),
        R: new THREE.Vector3(1, 0, 0), L: new THREE.Vector3(-1, 0, 0),
        F: new THREE.Vector3(0, 0, 1), B: new THREE.Vector3(0, 0, -1)
    };

    const viewAxes = {
        U: new THREE.Vector3(0, 1, 0), D: new THREE.Vector3(0, -1, 0),
        R: new THREE.Vector3(1, 0, 0), L: new THREE.Vector3(-1, 0, 0),
        F: new THREE.Vector3(0, 0, 1), B: new THREE.Vector3(0, 0, -1)
    };

    const vec = logicalAxes[face].clone();
    vec.applyQuaternion(pivotGroup.quaternion); 

    let bestFace = face;
    let maxDot = -Infinity;

    for(const [k, v] of Object.entries(viewAxes)) {
        const dot = vec.dot(v);
        if(dot > maxDot) {
            maxDot = dot;
            bestFace = k;
        }
    }
    return bestFace + suffix;
}

function updateDisplayMoves() {
    displayMoves = solutionMoves.map(m => getVisualMove(m));
    if(displayMoves.length > 0) {
        solutionTextEl.innerText = "Visual: " + displayMoves.join(" ");
    }
}

function rotateFace(move, reverse=false, onComplete=null) {
    if (isAnimating && !onComplete) return;
    isAnimating = true;

    let face = move[0];
    let prime = move.includes("'");
    if (reverse) prime = !prime;
    let dir = prime ? 1 : -1;
    let axis = "y"; 
    let group = [];

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
    pivot.rotation.set(0,0,0);
    pivotGroup.add(pivot);
    group.forEach(c => pivot.attach(c));

    const targetAngle = (Math.PI/2) * dir;
    const start = Date.now();

    function step(){
        const now = Date.now();
        let p = (now - start) / PLAY_SPEED;
        if(p > 1) p = 1;
        const ease = p * (2 - p);
        pivot.rotation[axis] = targetAngle * ease;

        if(p < 1) {
            requestAnimationFrame(step);
        } else {
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
    function nextMove() {
        if (i >= moves.length) {
            statusEl.innerText = "Ready to Solve";
            return;
        }
        rotateFace(moves[i++], false, nextMove);
    }
    nextMove();
}

function solveCube() {
    if (!engineReady) return alert("Engine loading...");
    snapToGrid();
    const cubeStr = getCubeStateString();
    
    if(cubeStr.includes("?")) {
        alert("Some faces are not painted!");
        return;
    }
    const counts = countColors(cubeStr);
    const invalid = Object.entries(counts).filter(([_,v]) => v !== 9);
    if (invalid.length) {
        alert(`Invalid Colors! Each color must appear exactly 9 times.`);
        return;
    }

    statusEl.innerText = "Computing solution...";
    statusEl.style.color = "cyan";
    solverWorker.postMessage({ type:"solve", cube: cubeStr });
}

/* =======================
   STATE GEN
======================= */
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
                const char = getColorKey(hex);
                state += char ? char : "?";
            } else {
                state += "?";
            }
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
    const state = getCubeStateString();
    const counts = countColors(state);
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
    updateDisplayMoves(); 
    updateStepStatus();
    rotateFace(solutionMoves[moveIndex], false, () => {
        moveIndex++;
        if(playInterval && moveIndex < solutionMoves.length) {
            setTimeout(nextMove, MOVE_GAP);
        } else {
            if(moveIndex >= solutionMoves.length) {
                clearInterval(playInterval);
                playInterval = null;
                document.getElementById("playPauseBtn").innerText = "PLAY";
                statusEl.innerText = "Solved!";
            }
        }
    });
}

function prevMove() {
    if (isAnimating || moveIndex <= 0) return;
    moveIndex--;
    updateDisplayMoves();
    updateStepStatus();
    rotateFace(solutionMoves[moveIndex], true);
}

function togglePlay() {
    const btn = document.getElementById("playPauseBtn");
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        if(btn) btn.innerText = "PLAY";
    } else {
        if(!solutionMoves.length) return;
        if(moveIndex >= solutionMoves.length) moveIndex = 0;
        if(btn) btn.innerText = "PAUSE";
        nextMove();
        playInterval = 1; 
    }
}

function resetCube() {
    location.reload();
}

function onInputStart(e) {
    isMouseDown = true;
    isDragging = false;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    startMouse = { x: cx, y: cy };
    lastMouse = { x: cx, y: cy };
}

function onInputMove(e) {
    if (!isMouseDown) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = cx - lastMouse.x;
    const dy = cy - lastMouse.y;
    if (Math.abs(cx - startMouse.x) > 5 || Math.abs(cy - startMouse.y) > 5) isDragging = true;
    if (isDragging) {
        pivotGroup.rotation.y += dx * 0.006;
        pivotGroup.rotation.x += dy * 0.006;
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
        if(e.changedTouches && e.changedTouches.length > 0) {
            cx = e.changedTouches[0].clientX;
            cy = e.changedTouches[0].clientY;
        } else {
            cx = e.clientX;
            cy = e.clientY;
        }
        handlePaint(cx, cy);
    }
    isDragging = false;
}

function animate() {
    requestAnimationFrame(animate);
    if (hintBox && hintBox.visible) {
        const time = Date.now() * 0.005; 
        const scale = 1.05 + Math.sin(time * 2) * 0.05; 
        hintBox.scale.set(scale, scale, scale);
    }
    renderer.render(scene, camera);
}
