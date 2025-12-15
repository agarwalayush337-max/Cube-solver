/* =========================================================
   RUBIK'S CUBE SOLVER – SCRAMBLE FIX FINAL VERSION
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
    Core: 0x202020 // Dark Grey (Internal)
};

const SCRAMBLE_MOVES = ["U","U'","R","R'","F","F'","D","D'","L","L'","B","B'"];
const PLAY_SPEED = 1000; // 1 Second per move for playback
const SCRAMBLE_SPEED = 100; // 100ms per move for scramble (fast but safe)

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

        solutionMoves = d.solution.trim().split(/\s+/).filter(m => m.length > 0);
        moveIndex = 0;
        solutionTextEl.innerText = d.solution;
        
        document.getElementById("action-controls").style.display = "none";
        document.getElementById("playback-controls").style.display = "flex";
        
        updateStepStatus();
    }

    if (d.type === "error") {
        statusEl.innerText = "Invalid Cube Configuration";
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

    // FIXED: Camera moved further back (Z=12) to reduce size
    // Angle set to create a nice isometric view
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

    // Initial Rotation: slightly rotated so it doesn't look flat/diagonal
    pivotGroup.rotation.x = 0;
    pivotGroup.rotation.y = -0.5;

    // Events
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
    while(pivotGroup.children.length > 0){ 
        pivotGroup.remove(pivotGroup.children[0]); 
    }
    cubes = [];

    const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);

    for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
            for (let z = -1; z <= 1; z++) {
                
                const mats = [
                    new THREE.MeshPhongMaterial({ color: x === 1 ? colors.R : colors.Core }), // R
                    new THREE.MeshPhongMaterial({ color: x === -1 ? colors.L : colors.Core }), // L
                    new THREE.MeshPhongMaterial({ color: y === 1 ? colors.U : colors.Core }), // U
                    new THREE.MeshPhongMaterial({ color: y === -1 ? colors.D : colors.Core }), // D
                    new THREE.MeshPhongMaterial({ color: z === 1 ? colors.F : colors.Core }), // F
                    new THREE.MeshPhongMaterial({ color: z === -1 ? colors.B : colors.Core })  // B
                ];

                const cube = new THREE.Mesh(geo, mats);
                cube.position.set(x, y, z);
                
                // Initialize Logical Indices
                cube.userData = { 
                    ix: x, iy: y, iz: z, 
                    isCenter: (Math.abs(x) + Math.abs(y) + Math.abs(z)) === 1
                };

                pivotGroup.add(cube);
                cubes.push(cube);
            }
}

/* =======================
   CRITICAL: GRID SNAPPING
======================= */
function snapToGrid() {
    cubes.forEach(c => {
        // 1. Force Position to Integer
        c.position.set(
            Math.round(c.position.x),
            Math.round(c.position.y),
            Math.round(c.position.z)
        );

        // 2. Force Rotation to 90-degree steps
        const euler = new THREE.Euler().setFromQuaternion(c.quaternion);
        euler.x = Math.round(euler.x / (Math.PI/2)) * (Math.PI/2);
        euler.y = Math.round(euler.y / (Math.PI/2)) * (Math.PI/2);
        euler.z = Math.round(euler.z / (Math.PI/2)) * (Math.PI/2);
        c.quaternion.setFromEuler(euler);
        
        c.updateMatrix();

        // 3. Update Logical Indices based on the new Snapped Position
        c.userData.ix = Math.round(c.position.x);
        c.userData.iy = Math.round(c.position.y);
        c.userData.iz = Math.round(c.position.z);
    });
}

/* =======================
   ROTATION ENGINE (CALLBACK BASED)
======================= */
// Added 'onComplete' callback to ensure sync
function rotateFace(move, reverse=false, onComplete=null) {
    if (isAnimating && !onComplete) return; // Block user clicks if animating
    isAnimating = true;

    let face = move[0];
    let prime = move.includes("'");
    let twice = move.includes("2");
    if (reverse) prime = !prime;

    let dir = prime ? 1 : -1;
    let axis = "y"; 
    let group = [];

    // SELECT CUBES based on current logical positions
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
    
    // Scramble is fast, Playback is slow
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
            // FINISH
            pivot.rotation[axis] = targetAngle;
            pivot.updateMatrixWorld();

            group.forEach(c => pivotGroup.attach(c));
            pivotGroup.remove(pivot);
            
            // KEY: Snap to grid BEFORE allowing next move
            snapToGrid();
            
            isAnimating = false;
            if(onComplete) onComplete();
        }
    }
    step();
}

/* =======================
   SCRAMBLE (RECURSIVE QUEUE)
======================= */
function scrambleCube() {
    if (isAnimating) return;
    
    // Reset state first to ensure clean slate? No, scramble from current.
    statusEl.innerText = "Scrambling...";
    
    // Generate 20 random moves
    const moves = Array.from({length: 20}, () => 
        SCRAMBLE_MOVES[Math.floor(Math.random()*SCRAMBLE_MOVES.length)]
    );

    let i = 0;
    
    // Recursive function to ensure Move 2 waits for Move 1
    function nextMove() {
        if (i >= moves.length) {
            statusEl.innerText = "Ready to Solve";
            return;
        }
        
        const move = moves[i++];
        // Call rotateFace and pass 'nextMove' as callback
        rotateFace(move, false, nextMove);
    }
    
    nextMove(); // Start the chain
}

/* =======================
   PALETTE & PAINT
======================= */
function updatePaletteCounts() {
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

    cubes.forEach(c => {
        if(!c.userData.isCenter) {
             c.material.forEach(m => {
                 m.color.setHex(colors.Core);
                 m.emissiveMap = null;
                 m.needsUpdate = true;
             });
        }
    });
    
    statusEl.innerText = "Cube Cleared";
    solutionTextEl.innerText = "";
    document.getElementById("action-controls").style.display = "flex";
    document.getElementById("playback-controls").style.display = "none";
    updatePaletteCounts();
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
             setTimeout(() => statusEl.innerText = "Ready...", 1000);
             return;
        }

        const matIndex = hit.face.materialIndex;
        const mat = obj.material[matIndex];
        
        mat.color.setHex(colors[paintColor]);
        mat.needsUpdate = true;

        smartAutoFill();
        updatePaletteCounts();
    }
}

/* =======================
   SMART AUTOFILL (IMPROVED)
======================= */
function smartAutoFill() {
    const state = getCubeStateString();
    const counts = countColors(state);
    
    let missingColors = [];
    for(let k in counts) {
        if(counts[k] < 9) {
            for(let i=0; i < (9 - counts[k]); i++) missingColors.push(k);
        }
    }
    
    if (missingColors.length === 0) return;

    // Find visible empty stickers
    let emptyStickers = [];
    
    cubes.forEach(c => {
        // Use ROUNDED positions to check faces
        const x = Math.round(c.position.x);
        const y = Math.round(c.position.y);
        const z = Math.round(c.position.z);
        
        // Check only exposed faces
        const check = (faceVal, targetVal, matIdx) => {
            if(faceVal === targetVal && c.material[matIdx].color.getHex() === colors.Core) {
                emptyStickers.push(c.material[matIdx]);
            }
        };

        check(x, 1, 0);  // Right
        check(x, -1, 1); // Left
        check(y, 1, 2);  // Up
        check(y, -1, 3); // Down
        check(z, 1, 4);  // Front
        check(z, -1, 5); // Back
    });

    // Only auto-fill if the number of empty spots matches missing colors EXACTLY
    // (and we aren't trying to fill the whole cube from scratch, limit to last 10)
    if (emptyStickers.length === missingColors.length && missingColors.length <= 12) {
        statusEl.innerText = "Auto-filling...";
        emptyStickers.forEach((mat, i) => {
            mat.color.setHex(colors[missingColors[i]]);
            mat.needsUpdate = true;
        });
        updatePaletteCounts();
    }
}

/* =======================
   INPUT: DRAG & CLICK
======================= */
function onInputStart(e) {
    // isAnimating check removed to allow stopping play, 
    // but drag logic should check it
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
    
    if (Math.abs(cx - startMouse.x) > 5 || Math.abs(cy - startMouse.y) > 5) {
        isDragging = true;
    }

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

/* =======================
   STATE STRING
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

function getCubeStateString() {
    let state = "";
    
    // Lookup by ROUNDED position
    const find = (x,y,z) => cubes.find(c => 
        Math.round(c.position.x)===x && 
        Math.round(c.position.y)===y && 
        Math.round(c.position.z)===z
    );

    // Standard Face Order for Kociemba Solver
    const faces = [
        // U: Top Face
        [[-1,1,-1],[0,1,-1],[1,1,-1], [-1,1,0],[0,1,0],[1,1,0], [-1,1,1],[0,1,1],[1,1,1]], 
        // R: Right Face
        [[1,1,1],[1,1,0],[1,1,-1], [1,0,1],[1,0,0],[1,0,-1], [1,-1,1],[1,-1,0],[1,-1,-1]],
        // F: Front Face
        [[-1,1,1],[0,1,1],[1,1,1], [-1,0,1],[0,0,1],[1,0,1], [-1,-1,1],[0,-1,1],[1,-1,1]],
        // D: Down Face
        [[-1,-1,1],[0,-1,1],[1,-1,1], [-1,-1,0],[0,-1,0],[1,-1,0], [-1,-1,-1],[0,-1,-1],[1,-1,-1]],
        // L: Left Face
        [[-1,1,-1],[-1,1,0],[-1,1,1], [-1,0,-1],[-1,0,0],[-1,0,1], [-1,-1,-1],[-1,-1,0],[-1,-1,1]],
        // B: Back Face
        [[1,1,-1],[0,1,-1],[-1,1,-1], [1,0,-1],[0,0,-1],[-1,0,-1], [1,-1,-1],[0,-1,-1],[-1,-1,-1]]
    ];
    const matIndices = [2, 0, 4, 3, 1, 5];

    faces.forEach((facePts, i) => {
        facePts.forEach(pt => {
            const cube = find(pt[0], pt[1], pt[2]);
            if(cube) {
                const hex = cube.material[matIndices[i]].color.getHex();
                state += getColorChar(hex);
            } else {
                state += "?";
            }
        });
    });
    return state;
}

/* =======================
   SOLVE & CONTROLS
======================= */
function solveCube() {
    if (!engineReady) return alert("Engine loading...");

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
                if(moveIndex < solutionMoves.length) {
                    nextMove();
                } else {
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
   RENDER LOOP
======================= */
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
