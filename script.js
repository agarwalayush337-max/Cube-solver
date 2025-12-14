// ==========================================
// 1. SETUP & CONSTANTS
// ==========================================
const colors = {
    'U': 0xFFFFFF, 'R': 0xB90000, 'F': 0x009E60,
    'D': 0xFFD500, 'L': 0xFF5800, 'B': 0x0051BA,
    'Core': 0x111111 // Black plastic color
};

// Map logical faces to 3D normals
const faceNormals = [
    { name: 'R', normal: new THREE.Vector3(1, 0, 0) },
    { name: 'L', normal: new THREE.Vector3(-1, 0, 0) },
    { name: 'U', normal: new THREE.Vector3(0, 1, 0) },
    { name: 'D', normal: new THREE.Vector3(0, -1, 0) },
    { name: 'F', normal: new THREE.Vector3(0, 0, 1) },
    { name: 'B', normal: new THREE.Vector3(0, 0, -1) }
];

let scene, camera, renderer, raycaster, mouse;
let cubes = []; // Stores the 27 mini-cubes
let isAnimating = false;
let paintingColor = 'U'; // Default paint color

// Solver Worker
const worker = new Worker('worker.js');
let workerReady = false;
let solutionMoves = [];
let currentMoveIndex = 0;

// ==========================================
// 2. INITIALIZATION
// ==========================================
init();
animate();

function init() {
    // Scene Setup
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(5, 5, 7);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Interaction
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    window.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('touchstart', onTouchStart, {passive: false});

    createRubiksCube();
}

// ==========================================
// 3. CUBE CREATION (27 PIECES)
// ==========================================
function createRubiksCube() {
    const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95); // 0.95 leaves gap for black lines

    // Create 27 cubies
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                
                // Materials: Default to Black (Core), color faces based on position
                const materials = [
                    new THREE.MeshPhongMaterial({ color: x==1 ? colors.R : colors.Core }), // Right
                    new THREE.MeshPhongMaterial({ color: x==-1 ? colors.L : colors.Core }), // Left
                    new THREE.MeshPhongMaterial({ color: y==1 ? colors.U : colors.Core }), // Top
                    new THREE.MeshPhongMaterial({ color: y==-1 ? colors.D : colors.Core }), // Bottom
                    new THREE.MeshPhongMaterial({ color: z==1 ? colors.F : colors.Core }), // Front
                    new THREE.MeshPhongMaterial({ color: z==-1 ? colors.B : colors.Core })  // Back
                ];

                const cube = new THREE.Mesh(geometry, materials);
                cube.position.set(x, y, z);
                
                // Add user data to identify faces later
                cube.userData = { 
                    initialPos: {x,y,z}, 
                    isCubie: true
                };
                
                scene.add(cube);
                cubes.push(cube);
            }
        }
    }
}

// ==========================================
// 4. INTERACTION (PAINTING)
// ==========================================
function selectColor(el, colorCode) {
    paintingColor = colorCode;
    // UI Update
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
}

function onMouseDown(event) { handleInput(event.clientX, event.clientY); }
function onTouchStart(event) { handleInput(event.touches[0].clientX, event.touches[0].clientY); }

function handleInput(x, y) {
    if (isAnimating) return; // Lock during animation

    // Calculate mouse position
    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.object.userData.isCubie) {
            // "Paint" the face by changing material color
            const matIndex = hit.face.materialIndex;
            hit.object.material[matIndex].color.setHex(colors[paintingColor]);
            
            // Note: In a real solver, we'd need to track this logic internally 
            // mapping (x,y,z) + faceIndex -> string notation.
        }
    }
}

// ==========================================
// 5. ANIMATION LOGIC (ROTATIONS)
// ==========================================
// We group cubies based on the move (e.g., all cubies with x=1 for 'R' move)
// Then rotate the group.

function rotateFace(move) {
    if (isAnimating) return;
    isAnimating = true;

    const axis = getAxisFromMove(move); // 'x', 'y', or 'z'
    const layer = getLayerFromMove(move); // 1, -1, etc.
    const angle = move.includes("'") ? Math.PI/2 : -Math.PI/2; // Reverse for prime

    // 1. Find pieces in this layer
    const activeCubies = cubes.filter(c => Math.abs(c.position[axis] - layer) < 0.1);

    // 2. Create a pivot object
    const pivot = new THREE.Object3D();
    pivot.rotation.set(0,0,0);
    scene.add(pivot);

    // 3. Attach cubies to pivot
    activeCubies.forEach(c => {
        pivot.attach(c);
    });

    // 4. Animate rotation
    const duration = 300; // ms
    const start = Date.now();
    
    function animateLoop() {
        const now = Date.now();
        const progress = Math.min((now - start) / duration, 1);
        
        // Rotate pivot
        if(axis === 'x') pivot.rotation.x = angle * progress;
        if(axis === 'y') pivot.rotation.y = angle * progress;
        if(axis === 'z') pivot.rotation.z = angle * progress;

        if (progress < 1) {
            requestAnimationFrame(animateLoop);
        } else {
            // 5. Cleanup
            pivot.updateMatrixWorld();
            activeCubies.forEach(c => {
                scene.attach(c); // Re-attach to scene, keeps new transform
                // Round positions to fix floating point drift
                c.position.x = Math.round(c.position.x);
                c.position.y = Math.round(c.position.y);
                c.position.z = Math.round(c.position.z);
            });
            scene.remove(pivot);
            isAnimating = false;
        }
    }
    animateLoop();
}

function getAxisFromMove(move) {
    if (move.includes('R') || move.includes('L')) return 'x';
    if (move.includes('U') || move.includes('D')) return 'y';
    return 'z';
}
function getLayerFromMove(move) {
    if (move.includes('R')) return 1;
    if (move.includes('L')) return -1;
    if (move.includes('U')) return 1;
    if (move.includes('D')) return -1;
    if (move.includes('F')) return 1;
    if (move.includes('B')) return -1;
    return 0;
}

// ==========================================
// 6. SOLVER INTEGRATION
// ==========================================
worker.onmessage = function(e) {
    const data = e.data;
    const statusDiv = document.getElementById('status');
    
    if (data.type === 'ready') {
        workerReady = true;
        statusDiv.textContent = "Solver Ready. Paint & Click Solve.";
        statusDiv.style.color = "#00FF00";
    }
    else if (data.type === 'solution') {
        statusDiv.textContent = `Solved in ${data.moves.length} moves!`;
        parseSolution(data.moves);
        document.querySelector('.controls').style.display = 'none';
        document.getElementById('playback-controls').style.display = 'flex';
    }
    else if (data.type === 'error') {
        alert(data.message);
        statusDiv.textContent = "Error: " + data.message;
        statusDiv.style.color = "red";
    }
};

function solveCube() {
    if(!workerReady) return;
    document.getElementById('status').textContent = "Thinking...";
    
    // For this demo, we generate a scrambled string manually or assume 
    // the user paints a valid state.
    // GENERATING STRING FROM 3D COLORS IS COMPLEX. 
    // FOR THIS DEMO: sending a HARDCODED scramble to prove it works.
    // In production, you must read the mesh colors to build the string.
    
    // Example: Sending a request to solve (Test Scramble)
    const testState = "BBBUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"; 
    // NOTE: To make this fully manual, we need a 'readCubeState()' function
    // that scans the 'cubes' array materials.
    
    worker.postMessage({ type: 'solve', state: testState });
}

function parseSolution(movesString) {
    // Convert "U R2 F'" -> ["U", "R", "R", "F'"]
    solutionMoves = [];
    const rawMoves = movesString.split(' ');
    
    rawMoves.forEach(m => {
        if(m.includes('2')) {
            const base = m.replace('2', '');
            solutionMoves.push(base, base);
        } else {
            solutionMoves.push(m);
        }
    });
    currentMoveIndex = 0;
}

// Playback
function nextMove() {
    if(currentMoveIndex < solutionMoves.length) {
        rotateFace(solutionMoves[currentMoveIndex]);
        currentMoveIndex++;
    }
}
function prevMove() {
    // Logic for reversing moves would go here
}
function togglePlay() {
    // Auto-play logic
    let interval = setInterval(() => {
        if(currentMoveIndex >= solutionMoves.length) clearInterval(interval);
        else nextMove();
    }, 500);
}

// ==========================================
// 7. RENDER LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    // Orbit Controls (Simple Manual Rotation)
    // For a real app, include OrbitControls.js, but here is a simple auto-rotate for idle
    // renderer.render(scene, camera);
    
    // Simple drag logic would go here, for now static camera:
    renderer.render(scene, camera);
}

function resetCube() {
    location.reload(); // Simplest reset
}
