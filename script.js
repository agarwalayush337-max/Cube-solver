// ==========================================
// 1. CONFIGURATION & GLOBALS
// ==========================================
const colors = {
    'U': 0xFFFFFF, // White (Up)
    'R': 0xB90000, // Red (Right)
    'F': 0x009E60, // Green (Front)
    'D': 0xFFD500, // Yellow (Down)
    'L': 0xFF5800, // Orange (Left)
    'B': 0x0051BA, // Blue (Back)
    'Core': 0x151515 // Plastic Color
};

// Helper to reverse lookup hex -> Char (e.g. 0xFFFFFF -> 'U')
function getColorChar(hex) {
    for (let [key, val] of Object.entries(colors)) {
        if (val === hex) return key;
    }
    return null;
}

let scene, camera, renderer, raycaster, mouse;
let cubes = []; 
let pivotGroup; // We will put all cubes in here to rotate them easily
let isAnimating = false;
let paintColor = 'U'; 
let solutionMoves = [];
let moveIndex = 0;

// Rotation Variables
let isDragging = false;
let isMouseDown = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationVelocity = { x: 0, y: 0 };

init();
animate();

// ==========================================
// 2. 3D SCENE SETUP
// ==========================================
function init() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 12); // Moved camera back
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-10, -10, -10);
    scene.add(backLight);

    // Interaction
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // Add Event Listeners for Rotation & Clicking
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    // Touch support for mobile
    document.addEventListener('touchstart', onTouchStart, {passive: false});
    document.addEventListener('touchmove', onTouchMove, {passive: false});
    document.addEventListener('touchend', onTouchEnd);

    // Group to hold the cube for easy rotation
    pivotGroup = new THREE.Group();
    scene.add(pivotGroup);

    createRubiksCube();
    
    // Default Rotation: Tilted slightly so you can see 3 sides
    pivotGroup.rotation.x = 0.5;
    pivotGroup.rotation.y = -0.7;
}

function createRubiksCube() {
    const geometry = new THREE.BoxGeometry(0.96, 0.96, 0.96); 

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                
                const materials = [
                    new THREE.MeshPhongMaterial({ color: x==1 ? colors.R : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: x==-1 ? colors.L : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: y==1 ? colors.U : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: y==-1 ? colors.D : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: z==1 ? colors.F : colors.Core }),
                    new THREE.MeshPhongMaterial({ color: z==-1 ? colors.B : colors.Core })
                ];

                const cube = new THREE.Mesh(geometry, materials);
                cube.position.set(x, y, z);
                cube.userData = { initialX: x, initialY: y, initialZ: z }; // Store ID
                
                pivotGroup.add(cube); // Add to the rotatable group
                cubes.push(cube);
            }
        }
    }
}

// ==========================================
// 3. INTERACTION (ROTATE & PAINT)
// ==========================================

function selectColor(el, c) {
    paintColor = c;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
}

// --- Mouse Events ---
function onMouseDown(e) {
    isMouseDown = true;
    isDragging = false; // Assume click first
    previousMousePosition = { x: e.clientX, y: e.clientY };
}

function onMouseMove(e) {
    if (!isMouseDown) return;

    const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
    };

    // If moved more than 5 pixels, treat as drag (rotation)
    if (Math.abs(deltaMove.x) > 2 || Math.abs(deltaMove.y) > 2) {
        isDragging = true;
    }

    if (isDragging) {
        // Rotate the Pivot Group
        const rotateSpeed = 0.005;
        pivotGroup.rotation.y += deltaMove.x * rotateSpeed;
        pivotGroup.rotation.x += deltaMove.y * rotateSpeed;
    }

    previousMousePosition = { x: e.clientX, y: e.clientY };
}

function onMouseUp(e) {
    isMouseDown = false;
    
    // Only paint if we DID NOT drag
    if (!isDragging) {
        handlePaintClick(e.clientX, e.clientY);
    }
    isDragging = false;
}

// --- Touch Events (Mobile) ---
function onTouchStart(e) {
    isMouseDown = true;
    isDragging = false;
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}
function onTouchMove(e) {
    if(!isMouseDown) return;
    const deltaMove = {
        x: e.touches[0].clientX - previousMousePosition.x,
        y: e.touches[0].clientY - previousMousePosition.y
    };
    if (Math.abs(deltaMove.x) > 2 || Math.abs(deltaMove.y) > 2) isDragging = true;
    
    if(isDragging) {
        e.preventDefault(); // Stop scroll
        pivotGroup.rotation.y += deltaMove.x * 0.005;
        pivotGroup.rotation.x += deltaMove.y * 0.005;
    }
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}
function onTouchEnd(e) {
    isMouseDown = false;
    if (!isDragging && e.changedTouches.length > 0) {
        handlePaintClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
}


function handlePaintClick(x, y) {
    if (isAnimating) return;

    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubes);

    if (intersects.length > 0) {
        const hit = intersects[0];
        const matIndex = hit.face.materialIndex;
        const currentHex = hit.object.material[matIndex].color.getHex();
        
        // Don't paint the black core
        if (currentHex !== colors.Core) {
            hit.object.material[matIndex].color.setHex(colors[paintColor]);
        }
    }
}

// ==========================================
// 4. COLOR READING & SOLVING
// ==========================================

function getCubeStateString() {
    // Standard Order: U1...U9, R1...R9, F1...F9, D1...D9, L1...L9, B1...B9
    // This is TRICKY. We must find which cubie is currently at the U1 position.
    
    // Simplified Logic: 
    // Since we only rotate the GROUP, the local x,y,z of cubies hasn't changed!
    // We just need to check the painted material of the correct face.
    
    let state = "";
    
    // Helper to find a cubie by its ORIGINAL ID (x,y,z)
    const findCubie = (x, y, z) => cubes.find(c => c.userData.initialX === x && c.userData.initialY === y && c.userData.initialZ === z);
    
    // Helper to get color char of a specific face of a cubie
    // matIndex: 0:R, 1:L, 2:U, 3:D, 4:F, 5:B
    const getColor = (cubie, matIndex) => getColorChar(cubie.material[matIndex].color.getHex());

    // 1. Up Face (y=1). Order: Top-Left to Bottom-Right (z=-1 to 1, x=-1 to 1)
    // U (Top) Face mapping is: 
    // U1(-1,1,-1) U2(0,1,-1) U3(1,1,-1)
    // U4(-1,1,0)  U5(0,1,0)  U6(1,1,0)
    // U7(-1,1,1)  U8(0,1,1)  U9(1,1,1)
    // The material index for UP is 2.
    const U_order = [
        [-1,1,-1], [0,1,-1], [1,1,-1],
        [-1,1,0],  [0,1,0],  [1,1,0],
        [-1,1,1],  [0,1,1],  [1,1,1]
    ];
    U_order.forEach(pos => state += getColor(findCubie(...pos), 2));

    // 2. Right Face (x=1). Material Index 0.
    // Order: y=1 to -1, z=1 to -1
    const R_order = [
        [1,1,1], [1,1,0], [1,1,-1],
        [1,0,1], [1,0,0], [1,0,-1],
        [1,-1,1],[1,-1,0],[1,-1,-1]
    ];
    R_order.forEach(pos => state += getColor(findCubie(...pos), 0));

    // 3. Front Face (z=1). Material Index 4.
    // Order: y=1 to -1, x=-1 to 1
    const F_order = [
        [-1,1,1], [0,1,1], [1,1,1],
        [-1,0,1], [0,0,1], [1,0,1],
        [-1,-1,1],[0,-1,1],[1,-1,1]
    ];
    F_order.forEach(pos => state += getColor(findCubie(...pos), 4));

    // 4. Down Face (y=-1). Material Index 3.
    // Order: z=1 to -1, x=-1 to 1 (Standard order varies, this is typical)
    const D_order = [
        [-1,-1,1], [0,-1,1], [1,-1,1],
        [-1,-1,0], [0,-1,0], [1,-1,0],
        [-1,-1,-1],[0,-1,-1],[1,-1,-1]
    ];
    D_order.forEach(pos => state += getColor(findCubie(...pos), 3));

    // 5. Left Face (x=-1). Material Index 1.
    // Order: y=1 to -1, z=-1 to 1
    const L_order = [
        [-1,1,-1], [-1,1,0], [-1,1,1],
        [-1,0,-1], [-1,0,0], [-1,0,1],
        [-1,-1,-1],[-1,-1,0],[-1,-1,1]
    ];
    L_order.forEach(pos => state += getColor(findCubie(...pos), 1));

    // 6. Back Face (z=-1). Material Index 5.
    // Order: y=1 to -1, x=1 to -1
    const B_order = [
        [1,1,-1], [0,1,-1], [-1,1,-1],
        [1,0,-1], [0,0,-1], [-1,0,-1],
        [1,-1,-1],[0,-1,-1],[-1,-1,-1]
    ];
    B_order.forEach(pos => state += getColor(findCubie(...pos), 5));

    return state;
}


function solveCube() {
    const statusEl = document.getElementById('status');
    
    // 1. Read Colors
    const stateString = getCubeStateString();
    console.log("Read State:", stateString);
    
    statusEl.innerText = "Solving...";
    statusEl.style.color = "orange";

    setTimeout(() => {
        try {
            // 2. SOLVE using the library
            // The result is just the string of moves, e.g., "R U R' U'"
            const result = cubeSolver.solve(stateString, 'kociemba');
            
            console.log("Result:", result);
            
            // ERROR CHECKING:
            // If result is empty or null, it failed.
            if (!result) {
                 // Check if it's already solved (the solver returns empty string for solved states)
                const solvedState = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
                if(stateString === solvedState) {
                    statusEl.innerText = "Cube is already solved!";
                    statusEl.style.color = "#00ff00";
                    return;
                }
                throw new Error("Unsolvable state. Check colors.");
            }

            // SUCCESS!
            // We use 'result' directly because it IS the solution string.
            const movesCount = result.split(' ').length;
            statusEl.innerText = `Solved! (${movesCount} moves)`;
            statusEl.style.color = "#00ff00";
            
            parseSolution(result); // Pass the string directly
            
            // Switch UI
            document.getElementById('action-controls').style.display = 'none';
            document.getElementById('playback-controls').style.display = 'flex';
            
        } catch (err) {
            console.error(err);
            statusEl.innerText = "Error: Check Colors";
            statusEl.style.color = "red";
            alert("Solver Error: " + err.message);
        }
    }, 100);
}

function parseSolution(solStr) {
    solutionMoves = [];
    const parts = solStr.trim().split(/\s+/);
    parts.forEach(move => {
        if (!move) return;
        if (move.includes('2')) {
            const base = move[0];
            solutionMoves.push(base);
            solutionMoves.push(base);
        } else {
            solutionMoves.push(move);
        }
    });
    moveIndex = 0;
}

// ==========================================
// 5. ANIMATION
// ==========================================
function rotateFace(move) {
    if (isAnimating) return;
    isAnimating = true;

    const base = move[0]; 
    const isPrime = move.includes("'");
    
    let axis = 'y';
    let direction = -1; 
    if (isPrime) direction = 1;

    let group = [];
    
    // Logic: We must find cubies based on their CURRENT position relative to the PivotGroup
    // But since PivotGroup rotates the whole world, the 'cubes' local positions are still x,y,z -1/0/1.
    // So we can use the same logic as before!
    
    cubes.forEach(cube => {
        const pos = cube.position;
        // Float precision handling
        if (base === 'R' && pos.x > 0.5) { axis='x'; group.push(cube); }
        if (base === 'L' && pos.x < -0.5) { axis='x'; group.push(cube); direction *= -1; }
        if (base === 'U' && pos.y > 0.5) { axis='y'; group.push(cube); }
        if (base === 'D' && pos.y < -0.5) { axis='y'; group.push(cube); direction *= -1; }
        if (base === 'F' && pos.z > 0.5) { axis='z'; group.push(cube); }
        if (base === 'B' && pos.z < -0.5) { axis='z'; group.push(cube); direction *= -1; }
    });

    const pivot = new THREE.Object3D();
    pivot.rotation.set(0,0,0);
    pivotGroup.add(pivot); // Add pivot to the group, not scene
    
    group.forEach(c => {
        pivot.attach(c);
    });

    const targetRot = (Math.PI / 2) * direction;
    const duration = 300;
    const startTime = Date.now();

    function loop() {
        const elapsed = Date.now() - startTime;
        const p = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        
        pivot.rotation[axis] = targetRot * ease;

        if (p < 1) {
            requestAnimationFrame(loop);
        } else {
            pivot.rotation[axis] = targetRot;
            pivot.updateMatrixWorld();
            group.forEach(c => {
                pivotGroup.attach(c); // Attach back to pivotGroup
                c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z));
                c.rotation.set(
                    Math.round(c.rotation.x / (Math.PI/2)) * (Math.PI/2),
                    Math.round(c.rotation.y / (Math.PI/2)) * (Math.PI/2),
                    Math.round(c.rotation.z / (Math.PI/2)) * (Math.PI/2)
                );
                c.updateMatrix();
            });
            pivotGroup.remove(pivot);
            isAnimating = false;
        }
    }
    loop();
}

function nextMove() {
    if (moveIndex < solutionMoves.length) {
        rotateFace(solutionMoves[moveIndex]);
        moveIndex++;
        document.getElementById('status').innerText = `Move ${moveIndex}/${solutionMoves.length}: ${solutionMoves[moveIndex-1]}`;
    } else {
        document.getElementById('status').innerText = "Cube Solved!";
    }
}
function prevMove() { /* todo */ }
let playInterval;
function togglePlay() {
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        document.getElementById('playPauseBtn').innerText = "PLAY";
    } else {
        document.getElementById('playPauseBtn').innerText = "PAUSE";
        playInterval = setInterval(() => {
            if (!isAnimating && moveIndex < solutionMoves.length) nextMove();
        }, 600);
    }
}
function resetCube() { location.reload(); }
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
