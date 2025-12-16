/* =========================================================
   RUBIK'S CUBE SOLVER – STRICT PREDICTIVE HINT SYSTEM
   ========================================================= */

/* =======================
   CONFIG
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

/* =======================
   UI ELEMENTS
======================= */
const statusEl = document.getElementById("status");
const solutionTextEl = document.getElementById("solutionText");

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
        statusEl.innerText = "Ready! Paint or Scramble.";
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
                solutionMoves.push(base); 
                solutionMoves.push(base); 
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
   STATE MANAGEMENT (For Simulation)
======================= */
function saveBoardState() {
    return cubes.map(c => c.material.map(m => m.color.getHex()));
}

function restoreBoardState(saved) {
    cubes.forEach((c, i) => {
        c.material.forEach((m, j) => {
            m.color.setHex(saved[i][j]);
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
    
    let boardAnalysis = []; 

    while (loopChanges && iteration < 20) {
        loopChanges = false;
        iteration++;
        boardAnalysis = []; 

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
                if(fillPiece(p, candidates[0], simulationMode)) {
                    loopChanges = true;
                    filledInThisRun++;
                }
            }
        });

        if (!loopChanges) {
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
        calculatePredictiveHint(boardAnalysis);
        updatePaletteCounts();
    }

    return filledInThisRun;
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

/* =======================
   PREDICTIVE HINT SYSTEM (STRICT MODE)
======================= */
function calculatePredictiveHint(boardPieces) {
    // 1. Identify "Testable" pieces
    let candidates = boardPieces.filter(p => 
        !p.isComplete && 
        p.painted.length > 0 && 
        p.possibleCandidates && 
        p.possibleCandidates.length > 0
    );

    if (candidates.length === 0) {
        hintBox.visible = false;
        return;
    }

    let bestScore = 0; // Strict threshold: MUST result in >0 fills
    let bestPiece = null;

    const originalState = saveBoardState();

    candidates.forEach(piece => {
        const testCandidate = piece.possibleCandidates[0]; 
        let emptyFace = piece.faces.find(f => f.color === null);
        
        if (emptyFace && testCandidate) {
            const neededColors = testCandidate.filter(c => !piece.painted.includes(c));
            if(neededColors.length > 0) {
                const testColor = neededColors[0];
                emptyFace.mat.color.setHex(colors[testColor]);
                
                const reactionScore = runLogicalAutofill(true); // SIMULATE

                if (reactionScore > bestScore) {
                    bestScore = reactionScore;
                    bestPiece = piece;
                }
                
                restoreBoardState(originalState);
            }
        }
    });

    // Only highlight if we actually found a chain reaction (Score > 0)
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
             
             // This runs the autofill AND calculates the next hint
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
   STATE STRING GEN
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

/* =======================
   UI UPDATES
======================= */
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

/* =======================
   CONTROLS
======================= */
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

/* =======================
   INPUT
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
    
    // Continuous Pulsing Effect for Hint Box
    if (hintBox && hintBox.visible) {
        const time = Date.now() * 0.005; 
        const scale = 1.05 + Math.sin(time * 2) * 0.05; 
        hintBox.scale.set(scale, scale, scale);
    }

    renderer.render(scene, camera);
}
