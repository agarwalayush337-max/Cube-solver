/* =========================================================
   RUBIK'S CUBE SOLVER – ULTIMATE EDITION (Vector + AutoFill)
   ========================================================= */

/* =======================
   CONFIG
======================= */
const colors = {
    U: 0xffffff, // White
    R: 0xb90000, // Red
    F: 0x009e60, // Green
    D: 0xffd500, // Yellow
    L: 0xff5800, // Orange
    B: 0x0051ba, // Blue
    Core: 0x202020 // Dark Grey (Internal/Empty)
};

const SCRAMBLE_MOVES = ["U","U'","R","R'","F","F'","D","D'","L","L'","B","B'"];
const PLAY_SPEED = 1000; // 1 Second per move (Playback)
const SCRAMBLE_SPEED = 100; // 100ms per move (Scramble)

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
let startMouse = { x: 0, y: 0 };
let lastMouse = { x: 0, y: 0 };

/* =======================
   WORKER SETUP
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
        statusEl.innerText = "Ready! Paint or Scramble.";
        statusEl.style.color = "#00ff00";
    }

    if (d.type === "solution") {
        if (!d.solution || d.solution.startsWith("Error")) {
            statusEl.innerText = "Unsolvable State! Check colors.";
            statusEl.style.color = "red";
            return;
        }

        if (d.solution.trim() === "") {
             statusEl.innerText = "Cube is already solved!";
             statusEl.style.color = "#00ff88";
             return;
        }

        // Clean solution string
        solutionMoves = d.solution.trim().split(/\s+/).filter(m => m.length > 0);
        moveIndex = 0;
        solutionTextEl.innerText = d.solution;
        
        // Swap UI Controls
        document.getElementById("action-controls").style.display = "none";
        document.getElementById("playback-controls").style.display = "flex";
        
        updateStepStatus();
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

    // Camera: Positioned further back (z=12) for better overview
    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(8, 7, 12); 
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById("canvas-container").appendChild(renderer.domElement);

    // Lighting
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

    createCube();

    // Initial view rotation
    pivotGroup.rotation.x = 0;
    pivotGroup.rotation.y = -0.5;

    // Events (Mouse & Touch)
    document.addEventListener("mousedown", onInputStart);
    document.addEventListener("mousemove", onInputMove);
    document.addEventListener("mouseup", onInputEnd);
    document.addEventListener("touchstart", onInputStart, { passive: false });
    document.addEventListener("touchmove", onInputMove, { passive: false });
    document.addEventListener("touchend", onInputEnd);

    updatePaletteCounts();
}

/* =======================
   CUBE GENERATION
======================= */
function createCube() {
    // Clear existing
    while(pivotGroup.children.length > 0){ 
        pivotGroup.remove(pivotGroup.children[0]); 
    }
    cubes = [];

    const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);

    for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
            for (let z = -1; z <= 1; z++) {
                
                // Materials: Right, Left, Top, Bottom, Front, Back
                const mats = [
                    new THREE.MeshPhongMaterial({ color: x === 1 ? colors.R : colors.Core }), // 0: Right
                    new THREE.MeshPhongMaterial({ color: x === -1 ? colors.L : colors.Core }), // 1: Left
                    new THREE.MeshPhongMaterial({ color: y === 1 ? colors.U : colors.Core }), // 2: Top
                    new THREE.MeshPhongMaterial({ color: y === -1 ? colors.D : colors.Core }), // 3: Bottom
                    new THREE.MeshPhongMaterial({ color: z === 1 ? colors.F : colors.Core }), // 4: Front
                    new THREE.MeshPhongMaterial({ color: z === -1 ? colors.B : colors.Core })  // 5: Back
                ];

                const cube = new THREE.Mesh(geo, mats);
                cube.position.set(x, y, z);
                
                // Track centers
                cube.userData = { 
                    ix: x, iy: y, iz: z, 
                    isCenter: (Math.abs(x) + Math.abs(y) + Math.abs(z)) === 1
                };

                pivotGroup.add(cube);
                cubes.push(cube);
            }
}

/* =======================
   GRID SNAPPING (CRITICAL FIX)
======================= */
function snapToGrid() {
    cubes.forEach(c => {
        // Round Position
        c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z));
        
        // Round Rotation
        const euler = new THREE.Euler().setFromQuaternion(c.quaternion);
        euler.x = Math.round(euler.x / (Math.PI/2)) * (Math.PI/2);
        euler.y = Math.round(euler.y / (Math.PI/2)) * (Math.PI/2);
        euler.z = Math.round(euler.z / (Math.PI/2)) * (Math.PI/2);
        c.quaternion.setFromEuler(euler);
        c.updateMatrix();

        // Update indices
        c.userData.ix = Math.round(c.position.x);
        c.userData.iy = Math.round(c.position.y);
        c.userData.iz = Math.round(c.position.z);
    });
}

/* =======================
   ROTATION ENGINE
======================= */
function rotateFace(move, reverse=false, onComplete=null) {
    if (isAnimating && !onComplete) return; // Block input if animating
    isAnimating = true;

    let face = move[0];
    let prime = move.includes("'");
    let twice = move.includes("2");
    if (reverse) prime = !prime;

    let dir = prime ? 1 : -1;
    let axis = "y"; 
    let group = [];

    // Select cubes based on logical position (userData)
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

    const targetAngle = (twice ? Math.PI : Math.PI/2) * dir;
    const speed = onComplete ? SCRAMBLE_SPEED : PLAY_SPEED; 
    const start = Date.now();

    function step(){
        const now = Date.now();
        let p = (now - start) / speed;
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
            
            snapToGrid(); // Force perfect alignment
            
            isAnimating = false;
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

/* =======================
   VECTOR COLOR LOGIC (THE "UNPAINTED" FIX)
======================= */
function getColorChar(hex) {
    for (const k in colors) {
        if (k === "Core") continue;
        if (colors[k] === hex) return k;
    }
    return "?";
}

function countColors(state) {
    const c = { U:0,R:0,F:0,D:0,L:0,B:0 };
    for (const ch of state) if (c[ch] !== undefined) c[ch]++;
    return c;
}

// Determines the visible color of a cube in a specific world direction
function getVisibleColor(cube, worldDir) {
    // Transform World Norm to Local Norm
    const localDir = worldDir.clone().applyQuaternion(cube.quaternion.clone().invert()).round();

    let matIndex = -1;
    if (localDir.x === 1) matIndex = 0; // Right
    if (localDir.x === -1) matIndex = 1; // Left
    if (localDir.y === 1) matIndex = 2; // Up
    if (localDir.y === -1) matIndex = 3; // Down
    if (localDir.z === 1) matIndex = 4; // Front
    if (localDir.z === -1) matIndex = 5; // Back

    if (matIndex === -1) return colors.Core; 
    return cube.material[matIndex].color.getHex();
}

function getCubeStateString() {
    let state = "";
    
    // Find cube by rounded world position
    const find = (x,y,z) => cubes.find(c => 
        Math.round(c.position.x)===x && 
        Math.round(c.position.y)===y && 
        Math.round(c.position.z)===z
    );

    // Kociemba Order Scan (U, R, F, D, L, B)
    const scanConfig = [
        // U Face (y=1) -> Normal(0,1,0)
        { norm: new THREE.Vector3(0,1,0), pts: [[-1,1,-1],[0,1,-1],[1,1,-1], [-1,1,0],[0,1,0],[1,1,0], [-1,1,1],[0,1,1],[1,1,1]] },
        // R Face (x=1) -> Normal(1,0,0)
        { norm: new THREE.Vector3(1,0,0), pts: [[1,1,1],[1,1,0],[1,1,-1], [1,0,1],[1,0,0],[1,0,-1], [1,-1,1],[1,-1,0],[1,-1,-1]] },
        // F Face (z=1) -> Normal(0,0,1)
        { norm: new THREE.Vector3(0,0,1), pts: [[-1,1,1],[0,1,1],[1,1,1], [-1,0,1],[0,0,1],[1,0,1], [-1,-1,1],[0,-1,1],[1,-1,1]] },
        // D Face (y=-1) -> Normal(0,-1,0)
        { norm: new THREE.Vector3(0,-1,0), pts: [[-1,-1,1],[0,-1,1],[1,-1,1], [-1,-1,0],[0,-1,0],[1,-1,0], [-1,-1,-1],[0,-1,-1],[1,-1,-1]] },
        // L Face (x=-1) -> Normal(-1,0,0)
        { norm: new THREE.Vector3(-1,0,0), pts: [[-1,1,-1],[-1,1,0],[-1,1,1], [-1,0,-1],[-1,0,0],[-1,0,1], [-1,-1,-1],[-1,-1,0],[-1,-1,1]] },
        // B Face (z=-1) -> Normal(0,0,-1)
        { norm: new THREE.Vector3(0,0,-1), pts: [[1,1,-1],[0,1,-1],[-1,1,-1], [1,0,-1],[0,0,-1],[-1,0,-1], [1,-1,-1],[0,-1,-1],[-1,-1,-1]] }
    ];

    scanConfig.forEach(face => {
        face.pts.forEach(pt => {
            const cube = find(pt[0], pt[1], pt[2]);
            if(cube) {
                const hex = getVisibleColor(cube, face.norm);
                state += getColorChar(hex);
            } else {
                state += "?";
            }
        });
    });
    return state;
}

/* =======================
   INTERACTION & AUTOFILL
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
             setTimeout(() => statusEl.innerText = "Ready...", 1000);
             return;
        }

        const matIndex = hit.face.materialIndex;
        const mat = obj.material[matIndex];
        
        mat.color.setHex(colors[paintColor]);
        mat.needsUpdate = true;
        
        smartAutoFill(); // Trigger autofill check
        updatePaletteCounts();
    }
}

function smartAutoFill() {
    const state = getCubeStateString();
    const counts = countColors(state);
    
    // 1. Identify missing colors
    let missingColors = [];
    for(let k in counts) {
        if(counts[k] < 9) {
            for(let i=0; i < (9 - counts[k]); i++) missingColors.push(k);
        }
    }
    
    // Only autofill if 6 or fewer stickers are missing
    if (missingColors.length === 0 || missingColors.length > 6) return;

    // 2. Find "Empty" materials that are facing outwards
    let emptyMats = [];
    
    // Helper to check a specific face on a specific cube
    const checkVisible = (pos, norm) => {
        // Find cube at pos
        const cube = cubes.find(c => 
            Math.round(c.position.x)===pos[0] && 
            Math.round(c.position.y)===pos[1] && 
            Math.round(c.position.z)===pos[2]
        );
        if(!cube) return;
        
        // Get the color currently showing
        const hex = getVisibleColor(cube, norm);
        if(hex === colors.Core) {
            // It's empty! We need to find the ACTUAL material object to paint it.
            // Convert world norm to local norm to find index
            const localDir = norm.clone().applyQuaternion(cube.quaternion.clone().invert()).round();
            let matIdx = -1;
            if (localDir.x === 1) matIdx = 0;
            if (localDir.x === -1) matIdx = 1;
            if (localDir.y === 1) matIdx = 2;
            if (localDir.y === -1) matIdx = 3;
            if (localDir.z === 1) matIdx = 4;
            if (localDir.z === -1) matIdx = 5;
            
            if(matIdx !== -1) emptyMats.push(cube.material[matIdx]);
        }
    };

    // Scan all faces like we do for state string
    const faces = [
        { norm: new THREE.Vector3(0,1,0), pts: [[-1,1,-1],[0,1,-1],[1,1,-1], [-1,1,0],[0,1,0],[1,1,0], [-1,1,1],[0,1,1],[1,1,1]] },
        { norm: new THREE.Vector3(1,0,0), pts: [[1,1,1],[1,1,0],[1,1,-1], [1,0,1],[1,0,0],[1,0,-1], [1,-1,1],[1,-1,0],[1,-1,-1]] },
        { norm: new THREE.Vector3(0,0,1), pts: [[-1,1,1],[0,1,1],[1,1,1], [-1,0,1],[0,0,1],[1,0,1], [-1,-1,1],[0,-1,1],[1,-1,1]] },
        { norm: new THREE.Vector3(0,-1,0), pts: [[-1,-1,1],[0,-1,1],[1,-1,1], [-1,-1,0],[0,-1,0],[1,-1,0], [-1,-1,-1],[0,-1,-1],[1,-1,-1]] },
        { norm: new THREE.Vector3(-1,0,0), pts: [[-1,1,-1],[-1,1,0],[-1,1,1], [-1,0,-1],[-1,0,0],[-1,0,1], [-1,-1,-1],[-1,-1,0],[-1,-1,1]] },
        { norm: new THREE.Vector3(0,0,-1), pts: [[1,1,-1],[0,1,-1],[-1,1,-1], [1,0,-1],[0,0,-1],[-1,0,-1], [1,-1,-1],[0,-1,-1],[-1,-1,-1]] }
    ];

    faces.forEach(f => f.pts.forEach(p => checkVisible(p, f.norm)));

    // 3. Fill if match
    if (emptyMats.length === missingColors.length) {
        statusEl.innerText = "Auto-filling remaining...";
        emptyMats.forEach((mat, i) => {
            mat.color.setHex(colors[missingColors[i]]);
            mat.needsUpdate = true;
        });
        updatePaletteCounts();
    }
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

function clearCube() {
    if(isAnimating) return;
    if(!confirm("Clear all colors?")) return;
    
    createCube();
    pivotGroup.rotation.set(0, -0.5, 0);
    
    statusEl.innerText = "Cube Cleared";
    solutionTextEl.innerText = "";
    document.getElementById("action-controls").style.display = "flex";
    document.getElementById("playback-controls").style.display = "none";
    updatePaletteCounts();
}

/* =======================
   SOLVE & CONTROLS
======================= */
function solveCube() {
    if (!engineReady) return alert("Engine loading...");
    snapToGrid();
    const cubeStr = getCubeStateString();
    
    if(cubeStr.includes("?")) {
        alert("Some faces are not painted (or internal error)!");
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

function updateStepStatus() {
    statusEl.innerHTML = `Step ${moveIndex} / ${solutionMoves.length}`;
}

function nextMove() {
    if (isAnimating || moveIndex >= solutionMoves.length) return;
    rotateFace(solutionMoves[moveIndex]);
    moveIndex++;
    updateStepStatus();
}

function prevMove() {
    if (isAnimating || moveIndex <= 0) return;
    moveIndex--;
    rotateFace(solutionMoves[moveIndex], true);
    updateStepStatus();
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
        playInterval = setInterval(() => {
            if(!isAnimating){
                if(moveIndex < solutionMoves.length) nextMove();
                else {
                    clearInterval(playInterval);
                    playInterval = null;
                    if(btn) btn.innerText = "PLAY";
                    statusEl.innerText = "Solved!";
                }
            }
        }, PLAY_SPEED);
    }
}

function resetCube() {
    location.reload();
}

/* =======================
   INPUT & ANIMATION
======================= */
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
    renderer.render(scene, camera);
}
