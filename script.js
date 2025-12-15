// ==========================================
// 1. CONFIGURATION
// ==========================================
const colors = {
    'U': 0xFFFFFF, 'R': 0xB90000, 'F': 0x009E60,
    'D': 0xFFD500, 'L': 0xFF5800, 'B': 0x0051BA, 'Core': 0x151515
};

function getColorChar(hex) {
    let minDiff = Infinity, closest = null;
    const r1 = (hex >> 16) & 255, g1 = (hex >> 8) & 255, b1 = hex & 255;
    for (let [key, val] of Object.entries(colors)) {
        if (key === 'Core') continue;
        const r2 = (val >> 16) & 255, g2 = (val >> 8) & 255, b2 = val & 255;
        const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
        if (diff < minDiff) {
            minDiff = diff;
            closest = key;
        }
    }
    return closest;
}

let scene, camera, renderer, raycaster, mouse, cubes = [], pivotGroup;
let isAnimating = false, paintColor = 'U', solutionMoves = [], moveIndex = 0;
let isDragging = false, isMouseDown = false, previousMousePosition = { x: 0, y: 0 };

// ==========================================
// 2. WORKER SETUP (FIXED)
// ==========================================
const statusEl = document.getElementById('status');
statusEl.innerText = "Loading engine…";
statusEl.style.color = "orange";

const solverWorker = new Worker('worker.js');
let engineReady = false;

solverWorker.onmessage = function (e) {
    const data = e.data;

    // ✅ READY
    if (data.type === 'ready') {
        engineReady = true;
        statusEl.innerText = "Ready! Paint & Solve.";
        statusEl.style.color = "#00ff00";
    }

    // ⏳ STATUS UPDATE
    else if (data.type === 'status') {
        statusEl.innerText = data.message || "Loading engine…";
        statusEl.style.color = "orange";
    }

    // ✅ SOLUTION
    else if (data.type === 'solution') {
        const result = data.solution?.trim() || "";

        if (!result) {
            if (getCubeStateString() === "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB") {
                statusEl.innerText = "Already Solved!";
                statusEl.style.color = "#00ff00";
            } else {
                statusEl.innerText = "Invalid or unsolvable cube";
                statusEl.style.color = "red";
            }
            return;
        }

        const movesCount = result.split(/\s+/).length;
        statusEl.innerHTML = `SOLVED! (${movesCount} moves)`;
        statusEl.style.color = "#00ff00";

        parseSolution(result);
        document.getElementById('action-controls').style.display = 'none';
        document.getElementById('playback-controls').style.display = 'flex';
    }

    // ❌ ERROR
    else if (data.type === 'error') {
        statusEl.innerText = "Error";
        statusEl.style.color = "red";
        alert(data.message);
    }
};

// ==========================================
// 3. INIT SCENE
// ==========================================
init();
animate();

function init() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 11);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(10, 20, 10);
    scene.add(dl);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    pivotGroup = new THREE.Group();
    scene.add(pivotGroup);

    createRubiksCube();
    pivotGroup.rotation.set(0.3, -0.4, 0);
}
// ==========================================
// INPUT HANDLERS (MISSING – FIX)
// ==========================================
function onMouseDown(e) {
    isMouseDown = true;
    isDragging = false;
    previousMousePosition = { x: e.clientX, y: e.clientY };
}

function onMouseMove(e) {
    if (!isMouseDown) return;

    const delta = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
    };

    if (Math.abs(delta.x) > 2 || Math.abs(delta.y) > 2) {
        isDragging = true;
    }

    if (isDragging) {
        pivotGroup.rotation.y += delta.x * 0.005;
        pivotGroup.rotation.x += delta.y * 0.005;
    }

    previousMousePosition = { x: e.clientX, y: e.clientY };
}

function onMouseUp(e) {
    isMouseDown = false;

    if (!isDragging) {
        handlePaintClick(e.clientX, e.clientY);
    }
    isDragging = false;
}

function onTouchStart(e) {
    isMouseDown = true;
    isDragging = false;
    previousMousePosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
    };
}

function onTouchMove(e) {
    if (!isMouseDown) return;

    const delta = {
        x: e.touches[0].clientX - previousMousePosition.x,
        y: e.touches[0].clientY - previousMousePosition.y
    };

    if (Math.abs(delta.x) > 2 || Math.abs(delta.y) > 2) {
        isDragging = true;
    }

    if (isDragging) {
        e.preventDefault();
        pivotGroup.rotation.y += delta.x * 0.005;
        pivotGroup.rotation.x += delta.y * 0.005;
    }

    previousMousePosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
    };
}

function onTouchEnd(e) {
    isMouseDown = false;

    if (!isDragging && e.changedTouches.length > 0) {
        handlePaintClick(
            e.changedTouches[0].clientX,
            e.changedTouches[0].clientY
        );
    }
}


// ==========================================
// 4. CUBE CREATION
// ==========================================
function createRubiksCube() {
    const geometry = new THREE.BoxGeometry(0.96, 0.96, 0.96);

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

                const cube = new THREE.Mesh(geometry, mats);
                cube.position.set(x, y, z);
                cube.userData = {
                    initialX: x,
                    initialY: y,
                    initialZ: z,
                    isCenter: (Math.abs(x) + Math.abs(y) + Math.abs(z)) === 1
                };

                pivotGroup.add(cube);
                cubes.push(cube);
            }
}

// ==========================================
// 5. SOLVE LOGIC (FIXED)
// ==========================================
function solveCube() {
    if (!engineReady) {
        alert("Engine is still loading. Please wait.");
        return;
    }

    const stateString = getCubeStateString();
    console.log("Captured cube:", stateString);

    statusEl.innerText = "Analyzing…";
    statusEl.style.color = "orange";

    // ✅ CORRECT MESSAGE FORMAT
    solverWorker.postMessage({
        type: 'solve',
        cube: stateString
    });
}

function parseSolution(solStr) {
    solutionMoves = solStr.trim().split(/\s+/);
    moveIndex = 0;
}

// ==========================================
// 6. STATE CAPTURE (UNCHANGED)
// ==========================================
function getCubeStateString() {
    let state = "";

    const findCubie = (x, y, z) =>
        cubes.find(c => c.userData.initialX === x && c.userData.initialY === y && c.userData.initialZ === z);

    const getColor = (cubie, matIndex) =>
        getColorChar(cubie.material[matIndex].color.getHex());

    const faces = [
        [[-1,1,-1],[0,1,-1],[1,1,-1],[-1,1,0],[0,1,0],[1,1,0],[-1,1,1],[0,1,1],[1,1,1]],
        [[1,1,1],[1,1,0],[1,1,-1],[1,0,1],[1,0,0],[1,0,-1],[1,-1,1],[1,-1,0],[1,-1,-1]],
        [[-1,1,1],[0,1,1],[1,1,1],[-1,0,1],[0,0,1],[1,0,1],[-1,-1,1],[0,-1,1],[1,-1,1]],
        [[-1,-1,1],[0,-1,1],[1,-1,1],[-1,-1,0],[0,-1,0],[1,-1,0],[-1,-1,-1],[0,-1,-1],[1,-1,-1]],
        [[-1,1,-1],[-1,1,0],[-1,1,1],[-1,0,-1],[-1,0,0],[-1,0,1],[-1,-1,-1],[-1,-1,0],[-1,-1,1]],
        [[1,1,-1],[0,1,-1],[-1,1,-1],[1,0,-1],[0,0,-1],[-1,0,-1],[1,-1,-1],[0,-1,-1],[-1,-1,-1]]
    ];

    const matMap = [2, 0, 4, 3, 1, 5];

    faces.forEach((face, i) =>
        face.forEach(pos =>
            state += getColor(findCubie(...pos), matMap[i])
        )
    );

    return state;
}

// ==========================================
// 7. ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
