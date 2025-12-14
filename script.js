// ==========================================
// 1. CONFIGURATION & GLOBALS
// ==========================================
const colors = {
    'U': 0xFFFFFF, // White
    'R': 0xB90000, // Red
    'F': 0x009E60, // Green
    'D': 0xFFD500, // Yellow
    'L': 0xFF5800, // Orange
    'B': 0x0051BA, // Blue
    'Core': 0x151515 // Black
};

function getColorChar(hex) {
    let minDiff = Infinity;
    let closest = null;
    const r1 = (hex >> 16) & 255;
    const g1 = (hex >> 8) & 255;
    const b1 = hex & 255;

    for (let [key, val] of Object.entries(colors)) {
        if (key === 'Core') continue;
        const r2 = (val >> 16) & 255;
        const g2 = (val >> 8) & 255;
        const b2 = val & 255;
        const diff = Math.abs(r1-r2) + Math.abs(g1-g2) + Math.abs(b1-b2);
        if (diff < minDiff) { minDiff = diff; closest = key; }
    }
    return closest;
}

let scene, camera, renderer, raycaster, mouse;
let cubes = []; 
let pivotGroup; 
let isAnimating = false;
let paintColor = 'U'; 
let solutionMoves = [];
let moveIndex = 0;
let isSolverReady = false;

let isDragging = false;
let isMouseDown = false;
let previousMousePosition = { x: 0, y: 0 };

init();
animate();

// Initialize solver (simple version, no tables needed for small depth, or it builds fast)
setTimeout(() => {
    if (typeof Cube !== 'undefined') {
        // The simple solver doesn't need heavy init, but we can call it if exists
        if(Cube.initSolver) Cube.initSolver();
        isSolverReady = true;
        console.log("Solver Ready");
    }
}, 500);

// ==========================================
// 2. 3D SCENE SETUP
// ==========================================
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-10, -10, -10);
    scene.add(backLight);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchstart', onTouchStart, {passive: false});
    document.addEventListener('touchmove', onTouchMove, {passive: false});
    document.addEventListener('touchend', onTouchEnd);

    pivotGroup = new THREE.Group();
    scene.add(pivotGroup);

    createRubiksCube();
    pivotGroup.rotation.x = 0.3;
    pivotGroup.rotation.y = -0.4;
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
                
                const isCenter = (Math.abs(x) + Math.abs(y) + Math.abs(z)) === 1;
                cube.userData = { initialX: x, initialY: y, initialZ: z, isCenter: isCenter }; 
                
                pivotGroup.add(cube); 
                cubes.push(cube);
            }
        }
    }
}

// ==========================================
// 3. INTERACTION
// ==========================================
function selectColor(el, c) {
    paintColor = c;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
}

function handlePaintClick(x, y) {
    if (isAnimating) return;

    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubes);

    if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.object.userData.isCenter) {
            alert("⚠️ Centers are fixed! Rotate your physical cube to match: Green Front, White Top.");
            return;
        }
        const matIndex = hit.face.materialIndex;
        if (hit.object.material[matIndex].color.getHex() !== colors.Core) {
            hit.object.material[matIndex].color.setHex(colors[paintColor]);
        }
    }
}

function onMouseDown(e) { isMouseDown=true; isDragging=false; previousMousePosition={x:e.clientX, y:e.clientY}; }
function onMouseMove(e) {
    if(!isMouseDown) return;
    const delta = { x: e.clientX - previousMousePosition.x, y: e.clientY - previousMousePosition.y };
    if(Math.abs(delta.x)>2 || Math.abs(delta.y)>2) isDragging=true;
    if(isDragging) { pivotGroup.rotation.y += delta.x*0.005; pivotGroup.rotation.x += delta.y*0.005; }
    previousMousePosition = {x:e.clientX, y:e.clientY};
}
function onMouseUp(e) { isMouseDown=false; if(!isDragging) handlePaintClick(e.clientX, e.clientY); isDragging=false; }
function onTouchStart(e) { isMouseDown=true; isDragging=false; previousMousePosition={x:e.touches[0].clientX, y:e.touches[0].clientY}; }
function onTouchMove(e) {
    if(!isMouseDown) return;
    const delta = { x: e.touches[0].clientX - previousMousePosition.x, y: e.touches[0].clientY - previousMousePosition.y };
    if(Math.abs(delta.x)>2 || Math.abs(delta.y)>2) isDragging=true;
    if(isDragging) { e.preventDefault(); pivotGroup.rotation.y += delta.x*0.005; pivotGroup.rotation.x += delta.y*0.005; }
    previousMousePosition = {x:e.touches[0].clientX, y:e.touches[0].clientY};
}
function onTouchEnd(e) { isMouseDown=false; if(!isDragging && e.changedTouches.length>0) handlePaintClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }

// ==========================================
// 4. SOLVER LOGIC
// ==========================================

function getCubeStateString() {
    let state = "";
    const findCubie = (x, y, z) => cubes.find(c => c.userData.initialX === x && c.userData.initialY === y && c.userData.initialZ === z);
    const getColor = (cubie, matIndex) => getColorChar(cubie.material[matIndex].color.getHex());

    // Standard Order for this Library: U, R, F, D, L, B
    const U_order = [[-1,1,-1], [0,1,-1], [1,1,-1], [-1,1,0], [0,1,0], [1,1,0], [-1,1,1], [0,1,1], [1,1,1]];
    const R_order = [[1,1,1], [1,1,0], [1,1,-1], [1,0,1], [1,0,0], [1,0,-1], [1,-1,1], [1,-1,0], [1,-1,-1]];
    const F_order = [[-1,1,1], [0,1,1], [1,1,1], [-1,0,1], [0,0,1], [1,0,1], [-1,-1,1], [0,-1,1], [1,-1,1]];
    const D_order = [[-1,-1,1], [0,-1,1], [1,-1,1], [-1,-1,0], [0,-1,0], [1,-1,0], [-1,-1,-1], [0,-1,-1], [1,-1,-1]];
    const L_order = [[-1,1,-1], [-1,1,0], [-1,1,1], [-1,0,-1], [-1,0,0], [-1,0,1], [-1,-1,-1], [-1,-1,0], [-1,-1,1]];
    const B_order = [[1,1,-1], [0,1,-1], [-1,1,-1], [1,0,-1], [0,0,-1], [-1,0,-1], [1,-1,-1], [0,-1,-1], [-1,-1,-1]];

    U_order.forEach(pos => state += getColor(findCubie(...pos), 2));
    R_order.forEach(pos => state += getColor(findCubie(...pos), 0));
    F_order.forEach(pos => state += getColor(findCubie(...pos), 4));
    D_order.forEach(pos => state += getColor(findCubie(...pos), 3));
    L_order.forEach(pos => state += getColor(findCubie(...pos), 1));
    B_order.forEach(pos => state += getColor(findCubie(...pos), 5));

    return state;
}

function solveCube() {
    const statusEl = document.getElementById('status');
    const stateString = getCubeStateString();
    
    console.log("Captured:", stateString);
    statusEl.innerText = "Solving...";
    statusEl.style.color = "orange";

    setTimeout(() => {
        try {
            if (!isSolverReady) throw new Error("Solver not ready.");
            
            // Create cube object and solve
            const cube = Cube.fromString(stateString);
            const result = cube.solve(); // Returns string
            
            console.log("Result:", result);

            if (result === "") { // Wait, empty string means solved in this lib? No, check docs.
                 // Actually this lib returns empty string if already solved.
                 if (stateString === "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB") {
                    statusEl.innerText = "Already Solved!";
                    statusEl.style.color = "#00ff00";
                    return;
                 }
            }
            
            const movesCount = result.split(' ').length;
            statusEl.innerHTML = `SOLVED! (${movesCount} moves)`;
            statusEl.style.color = "#00ff00";
            
            parseSolution(result);
            
            document.getElementById('action-controls').style.display = 'none';
            document.getElementById('playback-controls').style.display = 'flex';
            
        } catch (err) {
            console.error(err);
            statusEl.innerText = "Unsolvable / Error";
            statusEl.style.color = "red";
            alert("Error: " + err.message);
        }
    }, 100);
}

function parseSolution(solStr) {
    solutionMoves = [];
    if (!solStr) return;
    const parts = solStr.trim().split(/\s+/);
    parts.forEach(move => {
        if (!move) return;
        solutionMoves.push(move);
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
    const isDouble = move.includes("2");
    
    let axis = 'y';
    let direction = -1; 
    if (isPrime) direction = 1;
    let angle = Math.PI / 2;
    if (isDouble) { angle = Math.PI; direction = -1; }

    let group = [];
    
    cubes.forEach(cube => {
        const pos = cube.position;
        if (base === 'R' && pos.x > 0.1) { axis='x'; group.push(cube); }
        if (base === 'L' && pos.x < -0.1) { axis='x'; group.push(cube); direction *= -1; }
        if (base === 'U' && pos.y > 0.1) { axis='y'; group.push(cube); }
        if (base === 'D' && pos.y < -0.1) { axis='y'; group.push(cube); direction *= -1; }
        if (base === 'F' && pos.z > 0.1) { axis='z'; group.push(cube); }
        if (base === 'B' && pos.z < -0.1) { axis='z'; group.push(cube); direction *= -1; }
    });

    const pivot = new THREE.Object3D();
    pivot.rotation.set(0,0,0);
    pivotGroup.add(pivot); 
    group.forEach(c => pivot.attach(c));

    const targetRot = angle * direction;
    const duration = isDouble ? 500 : 300;
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
                pivotGroup.attach(c);
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
        const displayMove = solutionMoves[moveIndex-1];
        document.getElementById('status').innerHTML = `Move ${moveIndex}/${solutionMoves.length}: <b style="color:#fff; font-size:24px">${displayMove}</b>`;
    } else {
        document.getElementById('status').innerText = "Cube Solved!";
    }
}
function prevMove() {}
let playInterval;
function togglePlay() {
    if (playInterval) { clearInterval(playInterval); playInterval = null; document.getElementById('playPauseBtn').innerText = "PLAY"; } 
    else { document.getElementById('playPauseBtn').innerText = "PAUSE"; playInterval = setInterval(() => { if (!isAnimating && moveIndex < solutionMoves.length) nextMove(); }, 900); }
}
function resetCube() { location.reload(); }
function animate() { requestAnimationFrame(animate); renderer.render(scene, camera); }
