/* =============================================================================
   RUBIK'S CUBE SOLVER – PERFECT UX EDITION
   Features: 
   1. Landing = Solved Cube. Scanning = Ghost Cube.
   2. "Any Start" Logic (Centers are hidden until scanned).
   3. Split-Screen with resizing fixes.
   4. Slow-Motion Visual Guide.
   ============================================================================= */

/* =============================================================================
   SECTION 1: CONFIGURATION
   ============================================================================= */

const colors = {
    U: 0xffffff, // White
    R: 0xb90000, // Red
    F: 0x00ff00, // Green
    D: 0xffd500, // Yellow
    L: 0xff4500, // Orange
    B: 0x0051ba, // Blue
    Core: 0x202020, 
    Ghost: 0x555555 // Grey for unfilled faces
};

const colorKeys = ['U', 'R', 'F', 'D', 'L', 'B'];

// HSL Rules (Strict White/Orange separation)
const hslRules = {
    white:  { sMax: 20, lMin: 35 }, 
    orange: { hMin: 11,  hMax: 43, sMin: 55 }, 
    yellow: { hMin: 44,  hMax: 75 }, 
    green:  { hMin: 76,  hMax: 155 },
    blue:   { hMin: 156, hMax: 260 },
    red1:   { hMin: 330, hMax: 360 },
    red2:   { hMin: 0,   hMax: 10 }
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
const ANIMATION_SPEED = 2000; // 2 seconds slow rotation

/* =============================================================================
   SECTION 2: GLOBAL STATE
   ============================================================================= */

let scene, camera, renderer;
let cubes = [], pivotGroup; 
let hintBox; 

let isAnimating = false;
let paintColor = "U";

let solutionMoves = []; 
let moveIndex = 0;
let playInterval = null;
let autofillCount = 0; 

// Camera State
let videoStream = null;
let isCameraActive = false;
let scanIndex = 0; 
let scannedFacesData = []; 

// Rotation Guide Sequence
// We use relative rotations. 
const scanSequence = [
    { action: "Start: Scan Face 1", rot: {x:0.5, y:-0.6} }, // Isometric start
    { action: "Rotate Cube LEFT", rot: {x:0.5, y:-0.6 - (Math.PI/2)} }, 
    { action: "Rotate Cube LEFT", rot: {x:0.5, y:-0.6 - (Math.PI)} },    
    { action: "Rotate Cube LEFT", rot: {x:0.5, y:-0.6 - (Math.PI*1.5)} },
    { action: "Rotate Cube DOWN (Top)", rot: {x:0.5 + (Math.PI/2), y:-0.6} }, 
    { action: "Rotate Cube UP (Bottom)", rot: {x:0.5 - (Math.PI/2), y:-0.6} } 
];

/* =============================================================================
   SECTION 3: UI INJECTION
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
    
    /* When Camera is Active, 3D Canvas moves to bottom half */
    #canvas-container {
        width: 100vw; height: 100vh;
        transition: height 0.5s, top 0.5s;
        position: absolute; top: 0; left: 0;
    }
    .cam-active #canvas-container {
        height: 50% !important;
        top: 50% !important;
    }

    .cam-dot {
        width: 40px; height: 40px; border-radius: 8px;
        border: 2px solid rgba(255,255,255,0.9); 
        box-shadow: 0 2px 10px rgba(0,0,0,0.8);
        cursor: pointer; transition: transform 0.1s;
    }
    .cam-dot:active { transform: scale(0.9); }

    #guide-text {
        position: absolute; bottom: 10px; width: 100%; text-align: center;
        color: #00ff00; font-size: 20px; font-weight: bold; 
        text-shadow: 0 2px 4px #000;
        pointer-events: none; z-index: 60;
        background: rgba(0,0,0,0.7); padding: 8px 0;
    }
    
    #cam-msg {
        position: absolute; top: 10px; left: 10px; 
        color: #fff; font-size: 14px;
        background: rgba(0,0,0,0.6); padding: 6px 12px; border-radius: 20px;
    }
`;
document.head.appendChild(styleCSS);

const scannerUI = document.createElement("div");
scannerUI.id = "scanner-ui";
scannerUI.innerHTML = `
    <div style="position:relative; width:100%; height:100%; overflow:hidden; display:flex; justify-content:center; background:#000;">
        <video id="cam-video" autoplay playsinline style="height:100%; width:auto; opacity:0.9;"></video>
        <canvas id="cam-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; display:none;"></canvas>
        <div id="grid-overlay" style="
            position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); 
            width:260px; height:260px; 
            display:grid; grid-template-columns:1fr 1fr 1fr; grid-template-rows:1fr 1fr 1fr; 
            border: 2px solid rgba(255,255,255,0.2); border-radius: 12px;">
        </div>
    </div>
    <div style="position:absolute; bottom:15px; right:15px; display:flex; gap:10px;">
        <button id="btn-capture" class="tool-btn" style="background:#00ff00; color:#000; padding:15px 40px; font-weight:bold; font-size:18px; border-radius:50px; border:none;">CAPTURE</button>
    </div>
    <button id="btn-close" style="position:absolute; top:15px; right:15px; background:#ff3300; color:white; border:none; padding:8px 15px; border-radius:6px; font-weight:bold; cursor:pointer;">EXIT</button>
    <div id="cam-msg">Tap dots to fix</div>
    <div id="guide-text">Scan Face 1</div>
`;
document.body.appendChild(scannerUI);

const videoEl = document.getElementById("cam-video");
const canvasEl = document.getElementById("cam-canvas");
const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
const gridEl = document.getElementById("grid-overlay");
const guideText = document.getElementById("guide-text");

// Tool Row Injection
const toolRow = document.getElementById("tool-row");
if(toolRow) {
    const camBtn = document.createElement("button");
    camBtn.innerText = "📷 SCAN CUBE";
    camBtn.className = "tool-btn";
    camBtn.style.background = "#0051ba";
    camBtn.style.marginLeft = "10px";
    camBtn.onclick = startCameraMode;
    toolRow.appendChild(camBtn);
}

// Generate Grid Dots
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
                let base = m.replace("2", ""); solutionMoves.push(base); solutionMoves.push(base); 
            } else solutionMoves.push(m);
        });
        moveIndex = 0;
        document.getElementById("action-controls").style.display = "none";
        document.getElementById("playback-controls").style.display = "flex";
        updateStepStatus();
        if(hintBox) hintBox.visible = false;
        statusEl.innerText = "Solution Ready!";
    }
};

/* =============================================================================
   SECTION 5: 3D SCENE
   ============================================================================= */
init();
animate();

function init() {
    const container = document.getElementById("canvas-container");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.1, 100);
    // Adjusted Camera Z for better fit in split screen
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

    // LANDING: Create SOLVED Cube
    createCube(true);
    
    // Initial Orientation (Isometric)
    pivotGroup.rotation.x = 0.5;
    pivotGroup.rotation.y = -0.6;

    window.addEventListener('resize', onWindowResize);
    
    document.addEventListener("mousedown", onInputStart);
    document.addEventListener("mousemove", onInputMove);
    document.addEventListener("mouseup", onInputEnd);
    document.addEventListener("touchstart", onInputStart, { passive: false });
    document.addEventListener("touchmove", onInputMove, { passive: false });
    document.addEventListener("touchend", onInputEnd);
}

function onWindowResize() {
    const container = document.getElementById("canvas-container");
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

function createCube(isSolved = true) {
    // Clear existing
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
        
        // Define Materials
        // If isSolved = true, use standard colors.
        // If isSolved = false, use GHOST color for ALL faces (even centers).
        
        const defaultColor = isSolved ? null : colors.Ghost;

        const mats = [
            new THREE.MeshPhongMaterial({ color: defaultColor || (x==1?colors.R:colors.Core) }),
            new THREE.MeshPhongMaterial({ color: defaultColor || (x==-1?colors.L:colors.Core) }),
            new THREE.MeshPhongMaterial({ color: defaultColor || (y==1?colors.U:colors.Core) }),
            new THREE.MeshPhongMaterial({ color: defaultColor || (y==-1?colors.D:colors.Core) }),
            new THREE.MeshPhongMaterial({ color: defaultColor || (z==1?colors.F:colors.Core) }),
            new THREE.MeshPhongMaterial({ color: defaultColor || (z==-1?colors.B:colors.Core) })
        ];
        
        const cube = new THREE.Mesh(geo, mats);
        cube.position.set(x, y, z);
        cube.userData = { ix: x, iy: y, iz: z, isCenter: (Math.abs(x)+Math.abs(y)+Math.abs(z))===1 };
        
        pivotGroup.add(cube);
        cubes.push(cube);
    }
}

/* =============================================================================
   SECTION 6: CAMERA LOGIC (GHOST & GUIDE)
   ============================================================================= */
async function startCameraMode() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        videoEl.srcObject = stream;
        videoStream = stream;
        
        // 1. Activate Split Screen & Resize
        document.body.classList.add("cam-active");
        scannerUI.style.display = "flex";
        
        // Force resize update after CSS transition (approx 100ms)
        setTimeout(onWindowResize, 100);

        // 2. Reset State
        isCameraActive = true;
        scanIndex = 0;
        scannedFacesData = [];
        
        // 3. Reset Cube to GHOST MODE (All Grey)
        createCube(false);
        
        // 4. Set Initial Guide Rotation (Isometric 3-Face View)
        gsapRotateTo(0.5, -0.6); 
        guideText.innerText = scanSequence[0].action;
        
        requestAnimationFrame(processCameraFrame);

    } catch(e) {
        alert("Camera Error: " + e.message);
    }
}

function stopCameraMode() {
    isCameraActive = false;
    document.body.classList.remove("cam-active");
    scannerUI.style.display = "none";
    if(videoStream) videoStream.getTracks().forEach(t => t.stop());
    setTimeout(onWindowResize, 100);
}

function processCameraFrame() {
    if(!isCameraActive) return;

    if(videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        
        const dots = document.getElementsByClassName("cam-dot");
        const size = Math.min(canvasEl.width, canvasEl.height) * 0.6;
        const startX = (canvasEl.width - size)/2;
        const startY = (canvasEl.height - size)/2;
        const cell = size/3;
        
        let currentFrameColors = [];

        for(let row=0; row<3; row++) {
            for(let col=0; col<3; col++) {
                const cx = startX + col*cell + cell/2;
                const cy = startY + row*cell + cell/2;
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
        
        // LIVE 3D MAPPING: Only if NOT animating the guide rotation
        if(!isAnimating) {
            applyLiveColorsTo3DCube(currentFrameColors);
        }
    }
    requestAnimationFrame(processCameraFrame);
}

// --- COLOR DETECTION ---
function getHSLColor(r, g, b) {
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

    if(s < hslRules.white.sMax) return 'U';
    if(h >= hslRules.orange.hMin && h <= hslRules.orange.hMax && s > hslRules.orange.sMin) return 'L';
    if(h >= hslRules.yellow.hMin && h <= hslRules.yellow.hMax) return 'D';
    if(h >= hslRules.green.hMin && h <= hslRules.green.hMax) return 'F';
    if(h >= hslRules.blue.hMin && h <= hslRules.blue.hMax) return 'B';
    if(h >= hslRules.red1.hMin || h <= hslRules.red2.hMax) return 'R';
    return 'R'; 
}

function hexToString(hex) {
    return "#" + hex.toString(16).padStart(6, '0');
}

// --- LIVE MAPPING ---
function applyLiveColorsTo3DCube(colorsArr) {
    // Determine which 9 facelets are pointing at the camera (Screen Z)
    // IMPORTANT: Since we are in Isometric view, the "Face" might be angled.
    // However, the user is looking at the camera feed.
    // We assume the face the user is holding is the one we want to paint on the virtual cube's "Front-ish" side.
    
    // Simplification: We blindly paint the face that corresponds to the CURRENT SCAN INDEX logic.
    // BUT since we allowed "Any Start", we don't know logical face.
    // Visual approach: Find facelets with Normal matching the Camera Vector most closely.
    
    // Since pivotGroup is rotated, we un-rotate the Camera Vector (0,0,1) into Local Space?
    // Or rotate Local Normals into World Space.
    
    // In our scan sequence, we rotate the cube so the target face is roughly facing Z.
    // Exception: U and D might be angled.
    // Let's use a wide threshold for dot product.
    
    const camDir = new THREE.Vector3(0,0,1);
    let visibleFacelets = [];
    
    cubes.forEach(c => {
        c.material.forEach((mat, matIdx) => {
            let normal = getLocalNormal(matIdx);
            normal.applyQuaternion(c.quaternion); 
            normal.applyQuaternion(pivotGroup.quaternion);
            
            if(normal.dot(camDir) > 0.6) { // 0.6 threshold allows for isometric tilt
                let wp = c.position.clone();
                wp.applyQuaternion(pivotGroup.quaternion);
                visibleFacelets.push({ mesh:c, matIdx:matIdx, x:wp.x, y:wp.y });
            }
        });
    });
    
    // Sort Top-Left to Bottom-Right visually
    visibleFacelets.sort((a,b) => (b.y - a.y) || (a.x - b.x));
    
    // Paint if we found 9 candidates
    if(visibleFacelets.length === 9) {
        visibleFacelets.forEach((v, i) => {
            // Paint EVERYTHING (including Centers) to 'U', 'R', etc.
            // This replaces the 'Ghost' color live.
            v.mesh.material[v.matIdx].color.setHex(colors[colorsArr[i]]);
            v.mesh.material[v.matIdx].needsUpdate = true;
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

// --- CAPTURE & SLOW GUIDE ---
function captureFace() {
    if(isAnimating) return; 

    const dots = document.getElementsByClassName("cam-dot");
    let faceColors = [];
    for(let d of dots) faceColors.push(d.dataset.color);
    scannedFacesData.push(faceColors);
    
    for(let d of dots) d.dataset.manual = "";

    scanIndex++;
    if(scanIndex < 6) {
        const step = scanSequence[scanIndex];
        guideText.innerText = step.action;
        gsapRotateTo(step.rot.x, step.rot.y);
    } else {
        stopCameraMode();
        solveFromScan();
    }
}

function gsapRotateTo(tx, ty) {
    isAnimating = true;
    const sx = pivotGroup.rotation.x;
    const sy = pivotGroup.rotation.y;
    const st = Date.now();
    
    function loop() {
        let p = (Date.now()-st)/ANIMATION_SPEED;
        if(p<1) {
            let e = (p < 0.5) ? 2*p*p : -1+(4-2*p)*p; // EaseInOut
            pivotGroup.rotation.x = sx + (tx-sx)*e;
            pivotGroup.rotation.y = sy + (ty-sy)*e;
            requestAnimationFrame(loop);
        } else {
            pivotGroup.rotation.x = tx;
            pivotGroup.rotation.y = ty;
            isAnimating = false;
        }
    }
    loop();
}

/* =============================================================================
   SECTION 7: MAPPING & SOLVER
   ============================================================================= */
function solveFromScan() {
    const faceMap = {}; 
    scannedFacesData.forEach(faceData => {
        const center = faceData[4];
        faceMap[center] = faceData;
    });
    
    if(Object.keys(faceMap).length !== 6) {
        alert("Scan Error: Duplicate centers detected! Please rescan.");
        // Reset to Ghost mode so they can try again
        createCube(false);
        return;
    }
    
    applyScanToLogicalCubes(faceMap);
    
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
            } else {
                // Also paint centers now to ensure full colored cube
                let norm = getFaceNormal(key);
                let matIdx = getVisibleFaceMatIndex(c, norm);
                if(matIdx!==-1) c.material[matIdx].color.setHex(colors[colorsArr[i]]);
            }
        }
    });
    runLogicalAutofill(false);
    updatePaletteCounts();
}

/* =============================================================================
   SECTION 8: LOGIC ENGINE & HELPERS (Restored)
   ============================================================================= */
function runLogicalAutofill(simMode) {
    let changed = true;
    let iter = 0;
    let filled = 0;
    
    while(changed && iter<20) {
        changed = false;
        iter++;
        
        let pieces = [];
        cubes.forEach(c => {
            if(c.userData.isCenter) return;
            const exposed = [];
            const x=Math.round(c.position.x), y=Math.round(c.position.y), z=Math.round(c.position.z);
            const check = (wx,wy,wz,fn) => {
                if((wx!==0 && x===wx)||(wy!==0 && y===wy)||(wz!==0 && z===wz)) {
                    let mIdx = getVisibleFaceMatIndex(c, new THREE.Vector3(wx,wy,wz));
                    if(mIdx!==-1) {
                        let m = c.material[mIdx];
                        let hex = m.color.getHex();
                        // Treat Ghost as Null
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
            if(!sim) { autofillCount++; statsDiv.innerText = "Autofilled: "+autofillCount; }
        }
    });
    return hit;
}

function calculatePredictiveHint() {} // Placeholder for advanced hint optimization

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
        rotateFace(solutionMoves[moveIndex], false, () => {
            moveIndex++;
            updateStepStatus();
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

// Scramble Logic - Resets to Solved First
function scrambleCube() {
    if (isAnimating) return;
    // Fix: Force Cube to Solved State before Scrambling
    createCube(true); 
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
