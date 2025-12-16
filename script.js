/* =============================================================================
   RUBIK'S CUBE SOLVER – MASTER EDITION (LIVE GUIDE & FULL LOGIC)
   Features: 
   1. Split-Screen (Cam Top / Live 3D Bottom)
   2. "Ghost" Cube that fills continuously
   3. Slow-Motion Animation Guide (2.0s)
   4. HSL Color Engine (High Accuracy)
   5. Recursive Logic Engine (The "Brain")
   ============================================================================= */

/* =============================================================================
   SECTION 1: CONFIGURATION & CONSTANTS
   ============================================================================= */

const colors = {
    U: 0xffffff, // White
    R: 0xb90000, // Red
    F: 0x00ff00, // Green (Bright Lime)
    D: 0xffd500, // Yellow
    L: 0xff4500, // Orange (Red-Orange)
    B: 0x0051ba, // Blue
    Core: 0x202020, // Dark Grey (Internal/Unfilled)
    Ghost: 0x404040 // Lighter Grey for "Unscanned" stickers
};

const colorKeys = ['U', 'R', 'F', 'D', 'L', 'B'];

// HSL RANGES (Strict Logic for White/Orange separation)
const hslRules = {
    white:  { sMax: 20, lMin: 35 }, // Low saturation = White/Grey
    orange: { hMin: 11,  hMax: 43, sMin: 55 }, 
    yellow: { hMin: 44,  hMax: 75 }, 
    green:  { hMin: 76,  hMax: 155 },
    blue:   { hMin: 156, hMax: 260 },
    red1:   { hMin: 330, hMax: 360 },
    red2:   { hMin: 0,   hMax: 10 }
};

// DATA: All valid piece definitions for the Logic Engine
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
const PLAY_SPEED = 400;     // Animation speed for solving
const ANIMATION_SPEED = 2000; // 2.0 Seconds (SLOW ROTATION GUIDE)

/* =============================================================================
   SECTION 2: GLOBAL VARIABLES
   ============================================================================= */

// 3D Scene Components
let scene, camera, renderer;
let raycaster, mouse;
let cubes = [], pivotGroup; 
let hintBox; 

// State Flags
let isAnimating = false;
let paintColor = "U";
let isMouseDown = false;
let isDragging = false;

// Input Tracking
let startMouse = { x: 0, y: 0 };
let lastMouse = { x: 0, y: 0 };

// Solution State
let solutionMoves = []; 
let displayMoves = [];  
let moveIndex = 0;
let playInterval = null;
let autofillCount = 0; 

// Camera / Scanner State
let videoStream = null;
let isCameraActive = false;
let scanIndex = 0; 
let scannedFacesData = []; 

// Camera Rotation Sequence (The Visual Guide)
// This dictates how the 3D cube rotates after each capture
const scanSequence = [
    { face: 'F', action: "Start: Scan the GREEN Center Face", rot: {x:0, y:0} },
    { face: 'R', action: "Slowly Rotate Cube LEFT -> Show RED", rot: {x:0, y:-Math.PI/2} },
    { face: 'B', action: "Slowly Rotate Cube LEFT -> Show BLUE", rot: {x:0, y:-Math.PI} },
    { face: 'L', action: "Slowly Rotate Cube LEFT -> Show ORANGE", rot: {x:0, y:-Math.PI*1.5} },
    { face: 'U', action: "Tip Cube DOWN -> Show WHITE", rot: {x:Math.PI/2, y:0} }, 
    { face: 'D', action: "Tip Cube All The Way UP -> Show YELLOW", rot: {x:-Math.PI/2, y:0} } 
];

/* =============================================================================
   SECTION 3: UI GENERATION (Split Screen)
   ============================================================================= */

const styleCSS = document.createElement("style");
styleCSS.innerHTML = `
    #scanner-ui {
        position: absolute; top: 0; left: 0; width: 100%; height: 50%;
        background: #111; z-index: 50; display: none;
        flex-direction: column; align-items: center; justify-content: center;
        border-bottom: 4px solid #00ff00;
        box-shadow: 0 4px 20px rgba(0,0,0,0.8);
    }
    
    /* 3D Canvas Layout */
    #canvas-container {
        width: 100vw; height: 100vh;
        transition: height 0.6s cubic-bezier(0.25, 1, 0.5, 1), top 0.6s cubic-bezier(0.25, 1, 0.5, 1);
        position: absolute; top: 0; left: 0;
    }
    .cam-active #canvas-container {
        height: 50% !important;
        top: 50%; /* Moves to bottom half */
    }

    .cam-dot {
        width: 40px; height: 40px; border-radius: 8px;
        border: 2px solid rgba(255,255,255,0.9); 
        box-shadow: 0 2px 10px rgba(0,0,0,0.8);
        cursor: pointer; transition: transform 0.1s;
    }
    .cam-dot:active { transform: scale(0.9); }

    #guide-text {
        position: absolute; bottom: 15px; width: 100%; text-align: center;
        color: #00ff00; font-size: 22px; font-weight: bold; 
        text-shadow: 0 2px 4px #000; letter-spacing: 1px;
        pointer-events: none; z-index: 60;
        background: rgba(0,0,0,0.6); padding: 10px 0;
    }
    
    #cam-msg {
        position: absolute; top: 15px; left: 15px; 
        color: #fff; font-size: 14px;
        background: rgba(0,0,0,0.6); padding: 6px 12px; border-radius: 20px;
    }
`;
document.head.appendChild(styleCSS);

const scannerUI = document.createElement("div");
scannerUI.id = "scanner-ui";
scannerUI.innerHTML = `
    <div style="position:relative; width:100%; height:100%; overflow:hidden; display:flex; justify-content:center; background:#000;">
        <video id="cam-video" autoplay playsinline style="height:100%; width:auto; opacity:0.8;"></video>
        <canvas id="cam-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; display:none;"></canvas>
        
        <div id="grid-overlay" style="
            position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); 
            width:280px; height:280px; 
            display:grid; grid-template-columns:1fr 1fr 1fr; grid-template-rows:1fr 1fr 1fr; 
            border: 2px solid rgba(255,255,255,0.2); border-radius: 12px;">
        </div>
    </div>

    <div style="position:absolute; bottom:20px; right:20px; display:flex; gap:10px;">
        <button id="btn-capture" class="tool-btn" style="background:#00ff00; color:#000; padding:15px 40px; font-weight:bold; font-size:18px; border-radius:50px; box-shadow:0 4px 15px rgba(0,255,0,0.4); border:none;">
            CAPTURE
        </button>
    </div>

    <button id="btn-close" style="position:absolute; top:15px; right:15px; background:#ff3300; color:white; border:none; padding:8px 15px; border-radius:6px; font-weight:bold; cursor:pointer;">
        EXIT
    </button>

    <div id="cam-msg">Tap dots to fix manually</div>
    <div id="guide-text">Start: Scan Face 1</div>
`;
document.body.appendChild(scannerUI);

const videoEl = document.getElementById("cam-video");
const canvasEl = document.getElementById("cam-canvas");
const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
const gridEl = document.getElementById("grid-overlay");
const guideText = document.getElementById("guide-text");

const toolRow = document.getElementById("tool-row");
if(toolRow) {
    const camBtn = document.createElement("button");
    camBtn.innerText = "📷 START SCAN";
    camBtn.className = "tool-btn";
    camBtn.style.background = "#0051ba";
    camBtn.style.marginLeft = "10px";
    camBtn.onclick = startCameraMode;
    toolRow.appendChild(camBtn);
}

for(let i=0; i<9; i++) {
    let cell = document.createElement("div");
    cell.style.display="flex"; cell.style.alignItems="center"; cell.style.justifyContent="center";
    
    let dot = document.createElement("div");
    dot.className = "cam-dot";
    
    dot.onclick = (e) => {
        e.stopPropagation();
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

document.getElementById("btn-capture").onclick = captureFace;
document.getElementById("btn-close").onclick = stopCameraMode;

/* =============================================================================
   SECTION 4: WORKER SETUP
   ============================================================================= */
const statusEl = document.getElementById("status");
const solutionTextEl = document.getElementById("solutionText");
const statsDiv = document.createElement("div"); 

Object.assign(statsDiv.style, {
    position: 'absolute', bottom: '20px', left: '20px',
    color: '#00ff88', fontFamily: 'Arial', fontSize: '18px',
    fontWeight: 'bold', pointerEvents: 'none', textShadow: '0 0 5px black'
});
statsDiv.innerText = "Autofilled: 0";
document.body.appendChild(statsDiv);

const solverWorker = new Worker("worker.js?v=" + Date.now());
let engineReady = false;

solverWorker.onmessage = (e) => {
    const d = e.data;
    if (d.type === "ready") {
        engineReady = true;
        statusEl.innerText = "Ready!";
        statusEl.style.color = "#00ff00";
    }
    if (d.type === "solution") {
        if (!d.solution || d.solution.startsWith("Error")) {
            statusEl.innerText = "Unsolvable Pattern!";
            statusEl.style.color = "red";
            return;
        }
        
        let rawMoves = d.solution.trim().split(/\s+/).filter(m => m.length > 0);
        solutionMoves = [];
        rawMoves.forEach(m => {
            if (m.includes("2")) {
                let base = m.replace("2", ""); 
                solutionMoves.push(base); 
                solutionMoves.push(base); 
            } else {
                solutionMoves.push(m);
            }
        });
        
        moveIndex = 0;
        document.getElementById("action-controls").style.display = "none";
        document.getElementById("playback-controls").style.display = "flex";
        updateStepStatus();
        if(hintBox) hintBox.visible = false;
        
        statusEl.innerText = "Solution Ready!";
    }
    if (d.type === "error") {
        alert("Solver Error: " + d.message);
    }
};

/* =============================================================================
   SECTION 5: 3D SCENE INITIALIZATION
   ============================================================================= */
init();
animate();

function init() {
    const container = document.getElementById("canvas-container");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 18); 
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

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
    
    // Initial Orientation (Isometric)
    pivotGroup.rotation.x = 0.5;
    pivotGroup.rotation.y = -0.6;

    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    });
    
    document.addEventListener("mousedown", onInputStart);
    document.addEventListener("mousemove", onInputMove);
    document.addEventListener("mouseup", onInputEnd);
    document.addEventListener("touchstart", onInputStart, { passive: false });
    document.addEventListener("touchmove", onInputMove, { passive: false });
    document.addEventListener("touchend", onInputEnd);
}

function createCube() {
    // RESET: Clear scene
    while(pivotGroup.children.length > 0) {
        if(pivotGroup.children[0] !== hintBox) pivotGroup.remove(pivotGroup.children[0]);
        else pivotGroup.children.shift(); 
    }
    pivotGroup.add(hintBox);

    cubes = [];
    const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);

    for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
            for (let z = -1; z <= 1; z++) {
                
                const isCenter = (Math.abs(x)+Math.abs(y)+Math.abs(z))===1;
                
                // UNFILLED LOGIC:
                // If it's a Center, paint it properly (so user knows orientation).
                // If it's an Edge/Corner, paint it GHOST GREY initially.
                
                const mats = [
                    new THREE.MeshPhongMaterial({ color: (isCenter && x==1) ? colors.R : colors.Ghost }),
                    new THREE.MeshPhongMaterial({ color: (isCenter && x==-1)? colors.L : colors.Ghost }),
                    new THREE.MeshPhongMaterial({ color: (isCenter && y==1) ? colors.U : colors.Ghost }),
                    new THREE.MeshPhongMaterial({ color: (isCenter && y==-1)? colors.D : colors.Ghost }),
                    new THREE.MeshPhongMaterial({ color: (isCenter && z==1) ? colors.F : colors.Ghost }),
                    new THREE.MeshPhongMaterial({ color: (isCenter && z==-1)? colors.B : colors.Ghost })
                ];
                
                const cube = new THREE.Mesh(geo, mats);
                cube.position.set(x, y, z);
                
                // User Data 
                cube.userData = { 
                    ix: x, iy: y, iz: z, 
                    isCenter: isCenter
                };
                
                pivotGroup.add(cube);
                cubes.push(cube);
            }
}

/* =============================================================================
   SECTION 6: CAMERA MODE & LOGIC
   ============================================================================= */
async function startCameraMode() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        videoEl.srcObject = stream;
        videoStream = stream;
        
        // 1. Activate Split Screen
        document.body.classList.add("cam-active");
        scannerUI.style.display = "flex";
        
        // 2. Trigger Layout Refresh for 3D Canvas
        setTimeout(() => {
            const cont = document.getElementById("canvas-container");
            renderer.setSize(cont.clientWidth, cont.clientHeight);
            camera.aspect = cont.clientWidth / cont.clientHeight;
            camera.updateProjectionMatrix();
        }, 100);

        // 3. Reset State
        isCameraActive = true;
        scanIndex = 0;
        scannedFacesData = [];
        
        // 4. Reset 3D Cube to "Front" View for the guide
        gsapRotateTo(0, 0); 
        guideText.innerText = scanSequence[0].action;
        
        // 5. Reset Colors to Ghost (Except Centers)
        createCube(); 
        
        // 6. Start Loop
        requestAnimationFrame(processCameraFrame);

    } catch(e) {
        alert("Camera Error: " + e.message + "\nCheck permissions.");
    }
}

function stopCameraMode() {
    isCameraActive = false;
    document.body.classList.remove("cam-active");
    scannerUI.style.display = "none";
    
    if(videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
    }
    
    // Restore Canvas Size
    setTimeout(() => {
        const cont = document.getElementById("canvas-container");
        renderer.setSize(cont.clientWidth, cont.clientHeight);
        camera.aspect = cont.clientWidth / cont.clientHeight;
        camera.updateProjectionMatrix();
    }, 100);
}

function processCameraFrame() {
    if(!isCameraActive) return;

    if(videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        
        const dots = document.getElementsByClassName("cam-dot");
        
        // Grid Calculation (Center 60%)
        const size = Math.min(canvasEl.width, canvasEl.height) * 0.6;
        const startX = (canvasEl.width - size)/2;
        const startY = (canvasEl.height - size)/2;
        const cell = size/3;
        
        let currentFrameColors = [];

        for(let row=0; row<3; row++) {
            for(let col=0; col<3; col++) {
                const cx = startX + col*cell + cell/2;
                const cy = startY + row*cell + cell/2;
                
                // Sample 5x5
                const p = ctx.getImageData(cx-2, cy-2, 5, 5).data;
                let r=0,g=0,b=0;
                for(let k=0; k<p.length; k+=4){ r+=p[k]; g+=p[k+1]; b+=p[k+2]; }
                const count = p.length/4;
                r/=count; g/=count; b/=count;
                
                const dot = dots[row*3+col];
                let colorCode = 'U';

                if(dot.dataset.manual) {
                    colorCode = dot.dataset.color;
                } else {
                    colorCode = getHSLColor(r, g, b);
                    dot.style.backgroundColor = hexToString(colors[colorCode]);
                    dot.dataset.color = colorCode;
                }
                currentFrameColors.push(colorCode);
            }
        }
        
        // LIVE 3D MAPPING: Apply these colors to the virtual cube instantly
        // Only if not animating (to allow the slow rotation to be seen cleanly)
        if(!isAnimating) {
            applyLiveColorsTo3DCube(currentFrameColors);
        }
    }
    requestAnimationFrame(processCameraFrame);
}

// --- COLOR DETECTION (HSL) ---
function getHSLColor(r, g, b) {
    // RGB to HSL conversion
    r/=255; g/=255; b/=255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max+min)/2;

    if(max === min) h = s = 0;
    else {
        const d = max-min;
        s = l > 0.5 ? d/(2-max-min) : d/(max+min);
        switch(max){
            case r: h = (g-b)/d + (g<b?6:0); break;
            case g: h = (b-r)/d + 2; break;
            case b: h = (r-g)/d + 4; break;
        }
        h /= 6;
    }
    h *= 360; s *= 100; l *= 100;

    // 1. STRICT WHITE CHECK
    if(s < hslRules.white.sMax) return 'U';

    // 2. CHECK HUES
    if(h >= hslRules.orange.hMin && h <= hslRules.orange.hMax && s > hslRules.orange.sMin) return 'L';
    if(h >= hslRules.yellow.hMin && h <= hslRules.yellow.hMax) return 'D';
    if(h >= hslRules.green.hMin && h <= hslRules.green.hMax) return 'F';
    if(h >= hslRules.blue.hMin && h <= hslRules.blue.hMax) return 'B';
    
    // Red wraps around
    if(h >= hslRules.red1.hMin || h <= hslRules.red2.hMax) return 'R';

    return 'R'; // Fallback
}

function hexToString(hex) {
    return "#" + hex.toString(16).padStart(6, '0');
}

// --- LIVE MAPPING TO 3D CUBE ---
function applyLiveColorsTo3DCube(colorsArr) {
    // We paint the face currently pointing at Z+
    const camDir = new THREE.Vector3(0,0,1);
    let visibleFacelets = [];
    
    cubes.forEach(c => {
        c.material.forEach((mat, matIdx) => {
            let normal = getLocalNormal(matIdx);
            normal.applyQuaternion(c.quaternion); 
            normal.applyQuaternion(pivotGroup.quaternion); // Account for Group Animation
            
            if(normal.dot(camDir) > 0.9) {
                let wp = c.position.clone();
                wp.applyQuaternion(pivotGroup.quaternion);
                visibleFacelets.push({ mesh:c, matIdx:matIdx, x:wp.x, y:wp.y });
            }
        });
    });
    
    // Sort Grid: Top to Bottom, Left to Right
    visibleFacelets.sort((a,b) => (b.y - a.y) || (a.x - b.x));
    
    if(visibleFacelets.length === 9) {
        visibleFacelets.forEach((v, i) => {
            if(!v.mesh.userData.isCenter) { 
                v.mesh.material[v.matIdx].color.setHex(colors[colorsArr[i]]);
                v.mesh.material[v.matIdx].needsUpdate = true;
            }
        });
    }
}

function getLocalNormal(matIdx) {
    if(matIdx===0) return new THREE.Vector3(1,0,0);  
    if(matIdx===1) return new THREE.Vector3(-1,0,0); 
    if(matIdx===2) return new THREE.Vector3(0,1,0);  
    if(matIdx===3) return new THREE.Vector3(0,-1,0); 
    if(matIdx===4) return new THREE.Vector3(0,0,1);  
    if(matIdx===5) return new THREE.Vector3(0,0,-1); 
    return new THREE.Vector3(0,0,1);
}

// --- CAPTURE & ANIMATE (THE SLOW ROTATION) ---
function captureFace() {
    if(isAnimating) return; // Prevent double click

    const dots = document.getElementsByClassName("cam-dot");
    let faceColors = [];
    for(let d of dots) faceColors.push(d.dataset.color);
    scannedFacesData.push(faceColors);
    
    // Lock manual dots? No, reset for next face
    for(let d of dots) d.dataset.manual = "";

    scanIndex++;
    if(scanIndex < 6) {
        const step = scanSequence[scanIndex];
        guideText.innerText = step.action;
        
        // Trigger Slow Animation
        gsapRotateTo(step.rot.x, step.rot.y);
    } else {
        stopCameraMode();
        solveFromScan();
    }
}

// Smooth rotation helper
function gsapRotateTo(tx, ty) {
    isAnimating = true;
    const sx = pivotGroup.rotation.x;
    const sy = pivotGroup.rotation.y;
    const st = Date.now();
    
    function loop() {
        let p = (Date.now()-st)/ANIMATION_SPEED;
        if(p<1) {
            // Smooth EaseInOut
            let e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            pivotGroup.rotation.x = sx + (tx-sx)*e;
            pivotGroup.rotation.y = sy + (ty-sy)*e;
            requestAnimationFrame(loop);
        } else {
            pivotGroup.rotation.x = tx;
            pivotGroup.rotation.y = ty;
            isAnimating = false; // Unlock
        }
    }
    loop();
}

/* =============================================================================
   SECTION 7: SOLVER MAPPING LOGIC
   ============================================================================= */
function solveFromScan() {
    // Map based on Centers
    const faceMap = {}; 
    scannedFacesData.forEach(faceData => {
        const center = faceData[4];
        faceMap[center] = faceData;
    });
    
    // Validation
    if(Object.keys(faceMap).length !== 6) {
        alert("Scan Error: Duplicate centers detected! Please rescan.");
        return;
    }
    
    // Apply to Logical Cubes (so Hints work)
    applyScanToLogicalCubes(faceMap);
    
    // Generate String for Min2Phase
    let cubeStr = "";
    ['U','R','F','D','L','B'].forEach(face => {
        cubeStr += faceMap[face].join("");
    });
    
    statusEl.innerText = "Solving...";
    solverWorker.postMessage({ type: "solve", cube: cubeStr });
}

function applyScanToLogicalCubes(faceMap) {
    ['U','R','F','D','L','B'].forEach(key => {
        let targetCubes = getCubesForFace(key);
        targetCubes = sortCubesForGrid(targetCubes, key);
        let colorsArr = faceMap[key];
        
        for(let i=0; i<9; i++){
            let c = targetCubes[i];
            if(!c.userData.isCenter) {
                let norm = getFaceNormal(key);
                let matIdx = getVisibleFaceMatIndex(c, norm);
                if(matIdx!==-1) {
                    c.material[matIdx].color.setHex(colors[colorsArr[i]]);
                    c.material[matIdx].needsUpdate = true;
                }
            }
        }
    });
    runLogicalAutofill(false);
    updatePaletteCounts();
}

/* =============================================================================
   SECTION 8: RECURSIVE LOGIC ENGINE (THE BRAIN)
   ============================================================================= */
function runLogicalAutofill(simMode) {
    let changed = true;
    let iter = 0;
    let filled = 0;
    
    while(changed && iter<20) {
        changed = false;
        iter++;
        
        // 1. Analyze
        let pieces = [];
        cubes.forEach(c => {
            if(c.userData.isCenter) return;
            const exposed = [];
            const x=Math.round(c.position.x), y=Math.round(c.position.y), z=Math.round(c.position.z);
            
            const check = (wx,wy,wz,fn) => {
                if((wx!==0 && x===wx)||(wy!==0 && y===wy)||(wz!==0 && z===wz)) {
                    let mIdx = getVisibleFaceMatIndex(c, new THREE.Vector3(wx,wy,wz));
                    if(mIdx !== -1) {
                        let m = c.material[mIdx];
                        // If color is Ghost, it counts as null (unknown)
                        let hex = m.color.getHex();
                        let key = (hex === colors.Ghost) ? null : getColorKey(hex);
                        exposed.push({ mat:m, color: key });
                    }
                }
            };
            check(0,1,0,"U"); check(0,-1,0,"D");
            check(1,0,0,"R"); check(-1,0,0,"L");
            check(0,0,1,"F"); check(0,0,-1,"B");
            
            if(exposed.length>0) {
                let painted = exposed.map(e=>e.color).filter(c=>c!==null);
                pieces.push({ obj:c, type: exposed.length===3?'corner':'edge', exposed, painted, complete: painted.length===exposed.length });
            }
        });

        // 2. Inventory
        let corn = [...ALL_CORNERS], edge = [...ALL_EDGES];
        pieces.forEach(p => {
            if(p.complete) {
                let s = new Set(p.painted);
                if(p.type==='corner') {
                    let i = corn.findIndex(c => c.every(k=>s.has(k)));
                    if(i!==-1) corn.splice(i,1);
                } else {
                    let i = edge.findIndex(e => e.every(k=>s.has(k)));
                    if(i!==-1) edge.splice(i,1);
                }
            }
        });

        // 3. Deduction
        pieces.forEach(p => {
            if(p.complete || p.painted.length===0) return;
            let cands = [];
            if(p.type==='corner') cands = corn.filter(c => p.painted.every(k=>c.includes(k)));
            else cands = edge.filter(e => p.painted.every(k=>e.includes(k)));
            
            p.candidates = cands; 

            if(cands.length===1) {
                if(fillP(p, cands[0], simMode)) { changed=true; filled++; }
            }
        });
        
        // 4. Reverse Deduction (Implicit in elimination above, but we can add strict inverse loop here if needed)
    }
    
    if(!simMode) calculatePredictiveHint(cubes); 
    
    return filled;
}

function fillP(p, cand, sim) {
    let hit = false;
    let needed = cand.filter(c => !p.painted.includes(c));
    p.exposed.forEach(e => {
        if(e.color===null && needed.length>0) {
            let fill = needed.shift();
            e.mat.color.setHex(colors[fill]);
            e.mat.needsUpdate = true;
            hit = true;
            if(!sim) { 
                autofillCount++; 
                statsDiv.innerText = "Autofilled: "+autofillCount; 
            }
        }
    });
    return hit;
}

function calculatePredictiveHint(pieces) {
    // Placeholder for hint visualization update
    // Logic: Identify piece with lowest entropy (fewest candidates)
}

/* =============================================================================
   SECTION 9: HELPER FUNCTIONS (MATH & UTILS)
   ============================================================================= */
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

function sortCubesForGrid(list, face) {
    return list.sort((a,b) => {
        const ax=Math.round(a.position.x), ay=Math.round(a.position.y), az=Math.round(a.position.z);
        const bx=Math.round(b.position.x), by=Math.round(b.position.y), bz=Math.round(b.position.z);
        
        if(face === 'F') return (by - ay) || (ax - bx);
        if(face === 'B') return (by - ay) || (bx - ax);
        if(face === 'R') return (by - ay) || (bz - az);
        if(face === 'L') return (by - ay) || (az - bz);
        if(face === 'U') return (az - bz) || (ax - bx);
        if(face === 'D') return (bz - az) || (ax - bx);
    });
}

function getColorKey(hex) {
    for (const k in colors) {
        if (k === "Core" || k === "Ghost") continue;
        if (colors[k] === hex) return k;
    }
    return null; 
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

function snapToGrid() {
    cubes.forEach(c => {
        c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z));
        let e = new THREE.Euler().setFromQuaternion(c.quaternion);
        e.x = Math.round(e.x/(Math.PI/2))*(Math.PI/2);
        e.y = Math.round(e.y/(Math.PI/2))*(Math.PI/2);
        e.z = Math.round(e.z/(Math.PI/2))*(Math.PI/2);
        c.quaternion.setFromEuler(e);
        c.updateMatrix();
    });
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
                // Check if Ghost
                if(hex === colors.Ghost) state += "?";
                else {
                    const char = getColorKey(hex);
                    state += char ? char : "?";
                }
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
    if (!isAnimating && moveIndex < solutionMoves.length) {
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
}

function prevMove() {
    if (!isAnimating && moveIndex > 0) {
        moveIndex--;
        updateDisplayMoves();
        updateStepStatus();
        rotateFace(solutionMoves[moveIndex], true);
    }
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

// Scramble Logic
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

function animate() {
    requestAnimationFrame(animate);
    if (hintBox && hintBox.visible) {
        const time = Date.now() * 0.005; 
        const scale = 1.05 + Math.sin(time * 2) * 0.05; 
        hintBox.scale.set(scale, scale, scale);
    }
    renderer.render(scene, camera);
}

function rotateFace(move, rev, cb) {
    if(isAnimating && !cb) return;
    isAnimating=true;
    let face = move[0], prime = move.includes("'");
    if(rev) prime=!prime;
    let dir = prime?1:-1;
    let axis='y', group=[];
    
    cubes.forEach(c => {
        let {ix,iy,iz} = c.userData;
        if(face=='U' && iy==1) { axis='y'; group.push(c); }
        if(face=='D' && iy==-1){ axis='y'; dir*=-1; group.push(c); }
        if(face=='R' && ix==1) { axis='x'; group.push(c); }
        if(face=='L' && ix==-1){ axis='x'; dir*=-1; group.push(c); }
        if(face=='F' && iz==1) { axis='z'; group.push(c); }
        if(face=='B' && iz==-1){ axis='z'; dir*=-1; group.push(c); }
    });
    
    let piv = new THREE.Object3D();
    pivotGroup.add(piv);
    group.forEach(c => piv.attach(c));
    
    let tgt = Math.PI/2 * dir;
    let st = Date.now();
    function loop() {
        let p = (Date.now()-st)/PLAY_SPEED;
        if(p>1) p=1;
        piv.rotation[axis] = tgt * (p*(2-p));
        if(p<1) requestAnimationFrame(loop);
        else {
            piv.updateMatrixWorld();
            group.forEach(c => pivotGroup.attach(c));
            pivotGroup.remove(piv);
            snapToGrid();
            isAnimating=false;
            if(cb) cb();
        }
    }
    loop();
}
