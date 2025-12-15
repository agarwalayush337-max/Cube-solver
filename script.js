/* =========================================================
   RUBIK'S CUBE SOLVER – UPDATED script.js
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
    Core: 0x202020 // Slightly lighter core for visibility
};

const SCRAMBLE_MOVES = ["U","U'","R","R'","F","F'","D","D'","L","L'","B","B'"];
const PLAY_SPEED = 1000; // 1 Second per move

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
        statusEl.innerText = "Ready! Paint or Scramble.";
        statusEl.style.color = "#00ff00";
    }

    if (d.type === "solution") {
        // Basic check for error strings from solver
        if (!d.solution || d.solution.startsWith("Error")) {
            statusEl.innerText = "Unsolvable State! Check colors.";
            statusEl.style.color = "red";
            return;
        }

        // Check if solution is empty (already solved)
        if (d.solution.trim() === "") {
             statusEl.innerText = "Cube is already solved!";
             statusEl.style.color = "#00ff88";
             return;
        }

        solutionMoves = d.solution.trim().split(/\s+/);
        
        // Filter out double spaces or empty strings
        solutionMoves = solutionMoves.filter(m => m.length > 0);

        moveIndex = 0;
        solutionTextEl.innerText = d.solution;
        
        // Switch UI
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

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(5, 6, 9); // Better initial angle
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById("canvas-container").appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(10, 20, 10);
    scene.add(dl);
    
    // Back light to see shadows
    const bl = new THREE.DirectionalLight(0xffffff, 0.3);
    bl.position.set(-10, -10, -10);
    scene.add(bl);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    pivotGroup = new THREE.Group();
    scene.add(pivotGroup);

    createCube();
    
    // Initial Rotation for view
    pivotGroup.rotation.y = -Math.PI / 4;
    pivotGroup.rotation.x = Math.PI / 6;

    // Mouse Events
    document.addEventListener("mousedown", onInputStart);
    document.addEventListener("mousemove", onInputMove);
    document.addEventListener("mouseup", onInputEnd);

    // Touch Events (Mobile)
    document.addEventListener("touchstart", onInputStart, { passive: false });
    document.addEventListener("touchmove", onInputMove, { passive: false });
    document.addEventListener("touchend", onInputEnd);

    updatePaletteCounts();
}

/* =======================
   NUMBER TEXTURE
======================= */
function createNumberTexture(num) {
    if(num === 9) return null; // Don't show number if completed
    
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");

    // ctx.fillStyle = "rgba(0,0,0,0.5)";
    // ctx.fillRect(0,0,size,size);

    ctx.fillStyle = "black";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num, size / 2, size / 2);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

/* =======================
   CUBE CREATION
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
                    new THREE.MeshPhongMaterial({ color: x === 1 ? colors.R : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: x === -1 ? colors.L : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: y === 1 ? colors.U : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: y === -1 ? colors.D : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: z === 1 ? colors.F : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: z === -1 ? colors.B : colors.Core })
                ];

                const cube = new THREE.Mesh(geo, mats);
                cube.position.set(x, y, z);
                
                // CRITICAL: Store logical indices separately from position
                cube.userData = { 
                    ix: x, iy: y, iz: z, 
                    isCenter: (Math.abs(x) + Math.abs(y) + Math.abs(z)) === 1
                };

                pivotGroup.add(cube);
                cubes.push(cube);
            }
}

/* =======================
   STATE UPDATER (FIX #1)
======================= */
// After any rotation, we must update userData.ix/iy/iz based on new world positions
/* =======================
   STATE UPDATER (FIXED)
======================= */
function updateCubeIndices() {
    cubes.forEach(c => {
        // 1. Get the world position
        const worldPos = new THREE.Vector3();
        c.getWorldPosition(worldPos);

        // 2. Snap to nearest integer (-1, 0, 1)
        c.userData.ix = Math.round(worldPos.x);
        c.userData.iy = Math.round(worldPos.y);
        c.userData.iz = Math.round(worldPos.z);

        // 3. Reset local position to perfectly match the logical index
        // This prevents floating point drift (e.g. 0.99999 -> 1.0)
        c.position.set(c.userData.ix, c.userData.iy, c.userData.iz);
        
        // 4. Reset rotation to nearest 90 degrees to keep it clean
        c.rotation.x = Math.round(c.rotation.x / (Math.PI/2)) * (Math.PI/2);
        c.rotation.y = Math.round(c.rotation.y / (Math.PI/2)) * (Math.PI/2);
        c.rotation.z = Math.round(c.rotation.z / (Math.PI/2)) * (Math.PI/2);
        
        c.updateMatrix();
    });
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
        
        // Visual cue: fade out if full
        if(counts[color] >= 9) s.style.opacity = 0.5;
        else s.style.opacity = 1;
    });
}

function selectColor(el, c) {
    paintColor = c;
    document.querySelectorAll(".swatch").forEach(s => s.classList.remove("selected"));
    el.classList.add("selected");
}

function clearCube() {
    if(isAnimating) return;
    if(!confirm("Clear all colors (except centers)?")) return;

    cubes.forEach(c => {
        if(!c.userData.isCenter) {
            c.material.forEach(m => {
                // If it's not core color (internal face), reset it
                // We identify internal faces by checking if they were originally core
                // But simplified: Just set visible faces to Core
                // We need to preserve the "Core" material for faces that are naturally internal
                // Actually, simplest is to reset the whole cube geometry or just paint black.
                
                // Better approach:
                // Re-create the cube to be safe and clean
            });
        }
    });
    
    // Simplest Clean: Re-init
    createCube();
    // Paint centers
    // Actually, createCube initializes solved.
    // We want initialized BLANK.
    cubes.forEach(c => {
         c.material.forEach((m, i) => {
             // Logic: If x=1 (Right face), material index 0 should be Red if Center, else Black
             // This is getting complex.
             // EASIER: Just paint everything black, then restore centers.
             m.color.setHex(colors.Core);
             m.emissive.setHex(0x000000);
             m.emissiveMap = null;
         });
    });
    
    // Restore Centers
    cubes.forEach(c => {
        if(c.userData.isCenter) {
            // Find which face is visible
            const map = [
                { idx: 0, val: c.userData.ix, check: 1, col: colors.R },
                { idx: 1, val: c.userData.ix, check: -1, col: colors.L },
                { idx: 2, val: c.userData.iy, check: 1, col: colors.U },
                { idx: 3, val: c.userData.iy, check: -1, col: colors.D },
                { idx: 4, val: c.userData.iz, check: 1, col: colors.F },
                { idx: 5, val: c.userData.iz, check: -1, col: colors.B },
            ];
            map.forEach(f => {
                if(f.val === f.check) c.material[f.idx].color.setHex(f.col);
            });
        }
    });

    statusEl.innerText = "Cube Cleared";
    solutionTextEl.innerText = "";
    updatePaletteCounts();
}

function handlePaint(clientX, clientY) {
    if (isAnimating) return;

    // Calculate mouse position in normalized device coordinates
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubes);

    if (intersects.length > 0) {
        const hit = intersects[0];
        const obj = hit.object;
        
        // Cannot paint centers
        if (obj.userData.isCenter) {
             statusEl.innerText = "Centers are fixed!";
             setTimeout(() => statusEl.innerText = "Ready...", 1000);
             return;
        }

        const matIndex = hit.face.materialIndex;
        const mat = obj.material[matIndex];
        
        // Only paint if this face is an outer face (not Core color initially)
        // However, user might want to fix mistakes. 
        // We assume valid face if it's not completely black/hidden.
        
        mat.color.setHex(colors[paintColor]);
        mat.emissive.setHex(0x000000); // Clear number
        mat.emissiveMap = null;
        mat.needsUpdate = true;

        smartAutoFill();
        updatePaletteCounts();
    }
}

/* =======================
   SMART FILL (FIX #6)
======================= */
function smartAutoFill() {
    const state = getCubeStateString();
    const counts = countColors(state);
    
    // 1. Calculate remaining stickers needed
    let missingColors = [];
    for(let k in counts) {
        if(counts[k] < 9) {
            for(let i=0; i < (9 - counts[k]); i++) missingColors.push(k);
        }
    }
    
    // 2. Count empty spots (Core color on outer faces)
    // This is tricky. We need to iterate faces.
    // Simplified: If missingColors.length is small (e.g. <= 4), 
    // and we have exactly that many empty spots, fill them.
    
    if (missingColors.length === 0) return; // Full
    if (missingColors.length > 5) return;   // Too many to guess safely

    // Find all stickers that are currently "Core" (Black) but should be colored
    // We scan the logical faces.
    let emptyStickers = [];
    
    // Helper to check color of a logical face
    const checkFace = (cx, cy, cz, matIdx) => {
        const cube = cubes.find(c => c.userData.ix===cx && c.userData.iy===cy && c.userData.iz===cz);
        if(cube && cube.material[matIdx].color.getHex() === colors.Core) {
            emptyStickers.push(cube.material[matIdx]);
        }
    };
    
    // Scan all 6 faces (logic borrowed from getCubeStateString)
    // This is a bit heavy, but safe
    // R L U D F B
    const ranges = [
         {x:1, mat:0}, {x:-1, mat:1},
         {y:1, mat:2}, {y:-1, mat:3},
         {z:1, mat:4}, {z:-1, mat:5}
    ];

    cubes.forEach(c => {
        ranges.forEach(r => {
            // If cube is on this face side
            if( (r.x && c.userData.ix === r.x) || 
                (r.y && c.userData.iy === r.y) || 
                (r.z && c.userData.iz === r.z) ) {
                
                // Check if current color is Core (unpainted)
                if(c.material[r.mat].color.getHex() === colors.Core) {
                     emptyStickers.push(c.material[r.mat]);
                }
            }
        });
    });

    // Probability Fill: If empty slots match missing count, fill them sequentially
    if (emptyStickers.length === missingColors.length) {
        statusEl.innerText = "Auto-filling remaining...";
        emptyStickers.forEach((mat, i) => {
            mat.color.setHex(colors[missingColors[i]]);
            mat.needsUpdate = true;
        });
        updatePaletteCounts();
    }
}


/* =======================
   INPUT HANDLING (TOUCH & MOUSE)
======================= */
function onInputStart(e) {
    isMouseDown = true;
    isDragging = false;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    lastMouse = { x: clientX, y: clientY };
}

function onInputMove(e) {
    if (!isMouseDown) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - lastMouse.x;
    const dy = clientY - lastMouse.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;

    if (isDragging) {
        // Rotate the WHOLE cube group
        pivotGroup.rotation.y += dx * 0.005;
        pivotGroup.rotation.x += dy * 0.005;
    }
    lastMouse = { x: clientX, y: clientY };
}

function onInputEnd(e) {
    isMouseDown = false;
    
    // If it was a tap (not drag), handle paint
    if (!isDragging) {
        // For touchend, we need changedTouches because touches is empty
        let clientX, clientY;
        if(e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        handlePaint(clientX, clientY);
    }
    isDragging = false;
}

/* =======================
   GET STATE STRING
======================= */
function getColorChar(hex) {
    for (const k in colors) {
        if (k === "Core") continue;
        if (colors[k] === hex) return k;
    }
    return "?"; // Unknown/Black
}

function countColors(state) {
    const c = { U:0,R:0,F:0,D:0,L:0,B:0 };
    for (const ch of state) if (c[ch] !== undefined) c[ch]++;
    return c;
}

function getCubeStateString() {
    let state = "";
    
    // Order: U, R, F, D, L, B
    // U Face (y=1):  -1,-1 to 1,1 ?? No.
    // Standard notation order is:
    // U1 U2 U3 ... U9
    // Scan order usually: Top-Left to Bottom-Right of that face
    
    // U Face: y=1. z goes -1 to 1? x goes -1 to 1?
    // Standard U: x(-1->1), z(-1->1) usually.
    // Let's rely on standard mapping arrays
    
    const find = (x,y,z) => cubes.find(c => c.userData.ix===x && c.userData.iy===y && c.userData.iz===z);

    // Indices for U, R, F, D, L, B faces
    // Adjusted for standard orientation
    const faces = [
        // U (y=1): z=-1..1, x=-1..1 (Top row to bottom row?)
        // Standard: -1,1,-1  0,1,-1  1,1,-1 ...
        [[-1,1,-1],[0,1,-1],[1,1,-1], [-1,1,0],[0,1,0],[1,1,0], [-1,1,1],[0,1,1],[1,1,1]], 
        // R (x=1): 
        [[1,1,1],[1,1,0],[1,1,-1], [1,0,1],[1,0,0],[1,0,-1], [1,-1,1],[1,-1,0],[1,-1,-1]],
        // F (z=1):
        [[-1,1,1],[0,1,1],[1,1,1], [-1,0,1],[0,0,1],[1,0,1], [-1,-1,1],[0,-1,1],[1,-1,1]],
        // D (y=-1):
        [[-1,-1,1],[0,-1,1],[1,-1,1], [-1,-1,0],[0,-1,0],[1,-1,0], [-1,-1,-1],[0,-1,-1],[1,-1,-1]],
        // L (x=-1):
        [[-1,1,-1],[-1,1,0],[-1,1,1], [-1,0,-1],[-1,0,0],[-1,0,1], [-1,-1,-1],[-1,-1,0],[-1,-1,1]],
        // B (z=-1):
        [[1,1,-1],[0,1,-1],[-1,1,-1], [1,0,-1],[0,0,-1],[-1,0,-1], [1,-1,-1],[0,-1,-1],[-1,-1,-1]]
    ];

    const matIndices = [2, 0, 4, 3, 1, 5]; // Materials matching faces U,R,F,D,L,B

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
   SOLVE & SCRAMBLE
======================= */
function solveCube() {
    if (!engineReady) return alert("Engine loading...");

    const cubeStr = getCubeStateString();
    
    // Validation
    if(cubeStr.includes("?")) {
        alert("Some faces are not painted!");
        return;
    }

    const counts = countColors(cubeStr);
    const invalid = Object.entries(counts).filter(([_,v]) => v !== 9);
    if (invalid.length) {
        alert(`Invalid Colors! Each color must appear exactly 9 times.\nCheck: ${invalid.map(i=>i[0]+":"+i[1]).join(", ")}`);
        return;
    }

    statusEl.innerText = "Computing solution...";
    statusEl.style.color = "cyan";
    
    solverWorker.postMessage({ type:"solve", cube: cubeStr });
}

function scrambleCube() {
    if (isAnimating) return;
    
    // Clear any existing paint to avoid conflicts? 
    // No, standard scramble works on solved cube usually.
    // If user painted it, we scramble that state.
    
    let i = 0;
    const scramble = Array.from({length: 20},
        () => SCRAMBLE_MOVES[Math.floor(Math.random()*SCRAMBLE_MOVES.length)]
    );
    
    statusEl.innerText = "Scrambling...";

    function apply() {
        if (i >= scramble.length) {
            statusEl.innerText = "Ready to Solve";
            return;
        }
        rotateFace(scramble[i++]);
        setTimeout(apply, 150); // Fast scramble
    }
    apply();
}

/* =======================
   ROTATION ENGINE
======================= */
/* =======================
   ROTATION ENGINE (FIXED)
======================= */
function rotateFace(move, reverse=false) {
    if (isAnimating && !move) return; 
    isAnimating = true;

    let face = move[0];
    let prime = move.includes("'");
    let twice = move.includes("2");
    if (reverse) prime = !prime;

    let dir = prime ? 1 : -1;
    let axis = new THREE.Vector3();
    let group = [];

    // Identify axis and selection criteria
    if (face === "U") axis.set(0, 1, 0);
    if (face === "D") { axis.set(0, 1, 0); dir *= -1; }
    if (face === "L") { axis.set(1, 0, 0); dir *= -1; }
    if (face === "R") axis.set(1, 0, 0);
    if (face === "F") axis.set(0, 0, 1);
    if (face === "B") { axis.set(0, 0, 1); dir *= -1; }

    // Select cubes based on logical indices (ix, iy, iz)
    cubes.forEach(c => {
        const { ix, iy, iz } = c.userData;
        if (face === "U" && iy === 1) group.push(c);
        if (face === "D" && iy === -1) group.push(c);
        if (face === "L" && ix === -1) group.push(c);
        if (face === "R" && ix === 1) group.push(c);
        if (face === "F" && iz === 1) group.push(c);
        if (face === "B" && iz === -1) group.push(c);
    });

    // Create a temporary pivot at (0,0,0)
    const pivot = new THREE.Object3D();
    pivot.rotation.set(0, 0, 0);
    pivotGroup.add(pivot);

    // Attach cubes to pivot
    group.forEach(c => {
        pivotGroup.remove(c);
        pivot.add(c);
    });

    const targetAngle = (twice ? Math.PI : Math.PI/2) * dir;
    const duration = PLAY_SPEED === 1000 ? 500 : 120; // Fast for scramble
    const start = Date.now();

    function step() {
        const now = Date.now();
        let p = (now - start) / duration;
        if (p > 1) p = 1;

        // Smooth easing
        const ease = p * (2 - p);
        
        // Rotate on the specific axis
        pivot.rotation.set(
            axis.x * targetAngle * ease,
            axis.y * targetAngle * ease,
            axis.z * targetAngle * ease
        );

        if (p < 1) {
            requestAnimationFrame(step);
        } else {
            // FINISH: Re-attach to main group
            pivot.updateMatrixWorld(); // Ensure pivot transform is final
            
            // We must carefully detach to preserve world transforms
            // But since our pivot is at 0,0,0 inside pivotGroup, it's safer to:
            // 1. Update the cubies' world matrices
            // 2. Attach back to pivotGroup
            
            for (let i = group.length - 1; i >= 0; i--) {
                const c = group[i];
                // Three.js 'attach' handles the coordinate conversion automatically
                pivotGroup.attach(c); 
            }
            
            pivotGroup.remove(pivot);

            // KEY FIX: Snap positions to grid so next move works
            updateCubeIndices();

            isAnimating = false;
        }
    }
    step();
}

/* =======================
   PLAYBACK
======================= */
function updateStepStatus() {
    statusEl.innerHTML = `Step ${moveIndex} / ${solutionMoves.length} <br> <span style='font-size:14px;color:#aaa'>Next: ${solutionMoves[moveIndex] || "Done"}</span>`;
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
        if(moveIndex >= solutionMoves.length) moveIndex = 0; // Restart if done
        
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
        }, PLAY_SPEED); // 1 Second
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
