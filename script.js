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
        const diff = Math.abs(r1-r2) + Math.abs(g1-g2) + Math.abs(b1-b2);
        if (diff < minDiff) { minDiff = diff; closest = key; }
    }
    return closest;
}

let scene, camera, renderer, raycaster, mouse, cubes = [], pivotGroup;
let isAnimating = false, paintColor = 'U', solutionMoves = [], moveIndex = 0;
let isDragging = false, isMouseDown = false, previousMousePosition = { x: 0, y: 0 };

// --- WORKER SETUP ---
const statusEl = document.getElementById('status');
statusEl.innerText = "Loading Engine..."; 
statusEl.style.color = "orange";

const solverWorker = new Worker('worker.js');
let engineReady = false;

solverWorker.onmessage = function(e) {
    const data = e.data;
    if (data.type === 'status' && data.text === 'ready') {
        engineReady = true;
        statusEl.innerText = "Ready! Paint & Solve.";
        statusEl.style.color = "#00ff00";
    } 
    else if (data.type === 'solution') {
        let result = data.solution;
        
        // Handle Empty Result (Already Solved)
        if (result === undefined || result === null) {
             statusEl.innerText = "Error / Unsolvable";
             statusEl.style.color = "red";
        } else if (result.trim() === "") {
             statusEl.innerText = "Already Solved!";
             statusEl.style.color = "#00ff00";
        } else {
            // Clean up solution string
            result = result.trim();
            const movesCount = result.split(/\s+/).length;
            
            statusEl.innerHTML = `SOLVED! (${movesCount} moves)`;
            statusEl.style.color = "#00ff00";
            
            parseSolution(result);
            document.getElementById('action-controls').style.display = 'none';
            document.getElementById('playback-controls').style.display = 'flex';
        }
    } 
    else if (data.type === 'error') {
        statusEl.innerText = "Error";
        alert(data.message);
    }
};

init();
animate();

// ==========================================
// 2. 3D SCENE & INTERACTION
// ==========================================
function init() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 11); camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1); dl.position.set(10, 20, 10); scene.add(dl);
    
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchstart', onTouchStart, {passive:false});
    document.addEventListener('touchmove', onTouchMove, {passive:false});
    document.addEventListener('touchend', onTouchEnd);
    
    pivotGroup = new THREE.Group();
    scene.add(pivotGroup);
    createRubiksCube();
    pivotGroup.rotation.x = 0.3; pivotGroup.rotation.y = -0.4;
}

function createRubiksCube() {
    const geometry = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++) {
        const mats = [
            new THREE.MeshPhongMaterial({color:x==1?colors.R:colors.Core}),
            new THREE.MeshPhongMaterial({color:x==-1?colors.L:colors.Core}),
            new THREE.MeshPhongMaterial({color:y==1?colors.U:colors.Core}),
            new THREE.MeshPhongMaterial({color:y==-1?colors.D:colors.Core}),
            new THREE.MeshPhongMaterial({color:z==1?colors.F:colors.Core}),
            new THREE.MeshPhongMaterial({color:z==-1?colors.B:colors.Core})
        ];
        const cube = new THREE.Mesh(geometry, mats);
        cube.position.set(x,y,z);
        cube.userData = {initialX:x, initialY:y, initialZ:z, isCenter:(Math.abs(x)+Math.abs(y)+Math.abs(z))===1};
        pivotGroup.add(cube); cubes.push(cube);
    }
}

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
            alert("⚠️ Centers are fixed! Hold Green Facing You, White Top.");
            return;
        }
        const matIndex = hit.face.materialIndex;
        if (hit.object.material[matIndex].color.getHex() !== colors.Core) {
            hit.object.material[matIndex].color.setHex(colors[paintColor]);
        }
    }
}

function onMouseDown(e){isMouseDown=true;isDragging=false;previousMousePosition={x:e.clientX,y:e.clientY}}
function onMouseMove(e){if(!isMouseDown)return;const d={x:e.clientX-previousMousePosition.x,y:e.clientY-previousMousePosition.y};if(Math.abs(d.x)>2||Math.abs(d.y)>2)isDragging=true;if(isDragging){pivotGroup.rotation.y+=d.x*0.005;pivotGroup.rotation.x+=d.y*0.005}previousMousePosition={x:e.clientX,y:e.clientY}}
function onMouseUp(e){isMouseDown=false;if(!isDragging)handlePaintClick(e.clientX,e.clientY);isDragging=false}
function onTouchStart(e){isMouseDown=true;isDragging=false;previousMousePosition={x:e.touches[0].clientX,y:e.touches[0].clientY}}
function onTouchMove(e){if(!isMouseDown)return;const d={x:e.touches[0].clientX-previousMousePosition.x,y:e.touches[0].clientY-previousMousePosition.y};if(Math.abs(d.x)>2||Math.abs(d.y)>2)isDragging=true;if(isDragging){e.preventDefault();pivotGroup.rotation.y+=d.x*0.005;pivotGroup.rotation.x+=d.y*0.005}previousMousePosition={x:e.touches[0].clientX,y:e.touches[0].clientY}}
function onTouchEnd(e){isMouseDown=false;if(!isDragging&&e.changedTouches.length>0)handlePaintClick(e.changedTouches[0].clientX,e.changedTouches[0].clientY)}

// ==========================================
// 3. SOLVE LOGIC
// ==========================================
function getCubeStateString() {
    let state = "";
    const findCubie = (x, y, z) => cubes.find(c => c.userData.initialX === x && c.userData.initialY === y && c.userData.initialZ === z);
    const getColor = (cubie, matIndex) => getColorChar(cubie.material[matIndex].color.getHex());
    // Order: U, R, F, D, L, B
    [
      [[-1,1,-1], [0,1,-1], [1,1,-1], [-1,1,0], [0,1,0], [1,1,0], [-1,1,1], [0,1,1], [1,1,1]], // U
      [[1,1,1], [1,1,0], [1,1,-1], [1,0,1], [1,0,0], [1,0,-1], [1,-1,1], [1,-1,0], [1,-1,-1]], // R
      [[-1,1,1], [0,1,1], [1,1,1], [-1,0,1], [0,0,1], [1,0,1], [-1,-1,1], [0,-1,1], [1,-1,1]], // F
      [[-1,-1,1], [0,-1,1], [1,-1,1], [-1,-1,0], [0,-1,0], [1,-1,0], [-1,-1,-1], [0,-1,-1], [1,-1,-1]], // D
      [[-1,1,-1], [-1,1,0], [-1,1,1], [-1,0,-1], [-1,0,0], [-1,0,1], [-1,-1,-1], [-1,-1,0], [-1,-1,1]], // L
      [[1,1,-1], [0,1,-1], [-1,1,-1], [1,0,-1], [0,0,-1], [-1,0,-1], [1,-1,-1], [0,-1,-1], [-1,-1,-1]]  // B
    ].forEach((face, i) => {
        face.forEach(pos => state += getColor(findCubie(...pos), [2,0,4,3,1,5][i]));
    });
    return state;
}

function solveCube() {
    const stateString = getCubeStateString();
    console.log("Captured:", stateString);
    
    if (!engineReady) {
        alert("Engine loading... wait 1 second.");
        return;
    }
    
    statusEl.innerText = "Analyzing...";
    statusEl.style.color = "orange";
    solverWorker.postMessage(stateString);
}

function parseSolution(solStr) {
    solutionMoves = [];
    if (!solStr) return;
    const parts = solStr.trim().split(/\s+/);
    parts.forEach(move => move && solutionMoves.push(move));
    moveIndex = 0;
}

// ==========================================
// 4. ANIMATION
// ==========================================
function rotateFace(move) {
    if (isAnimating) return;
    isAnimating = true;
    const base = move[0], isPrime = move.includes("'"), isDouble = move.includes("2");
    let axis = 'y', direction = -1, angle = Math.PI / 2;
    if (isPrime) direction = 1; if (isDouble) { angle = Math.PI; direction = -1; }
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
    pivotGroup.add(pivot); group.forEach(c => pivot.attach(c));
    const targetRot = angle * direction;
    const duration = isDouble ? 400 : 250;
    const startTime = Date.now();
    function loop() {
        const p = Math.min((Date.now() - startTime) / duration, 1);
        pivot.rotation[axis] = targetRot * (1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(loop);
        else {
            pivot.rotation[axis] = targetRot; pivot.updateMatrixWorld();
            group.forEach(c => { pivotGroup.attach(c); c.position.round(); c.rotation.set(Math.round(c.rotation.x/(Math.PI/2))*(Math.PI/2),Math.round(c.rotation.y/(Math.PI/2))*(Math.PI/2),Math.round(c.rotation.z/(Math.PI/2))*(Math.PI/2)); c.updateMatrix(); });
            pivotGroup.remove(pivot); isAnimating = false;
        }
    }
    loop();
}
function nextMove(){if(moveIndex<solutionMoves.length){rotateFace(solutionMoves[moveIndex]);moveIndex++;document.getElementById('status').innerHTML=`Move ${moveIndex}/${solutionMoves.length}: <b style="color:#fff;font-size:24px">${solutionMoves[moveIndex-1]}</b>`}else{document.getElementById('status').innerText="Cube Solved!"}}
function prevMove(){}
let playInterval;
function togglePlay(){if(playInterval){clearInterval(playInterval);playInterval=null;document.getElementById('playPauseBtn').innerText="PLAY"}else{document.getElementById('playPauseBtn').innerText="PAUSE";playInterval=setInterval(()=>{if(!isAnimating&&moveIndex<solutionMoves.length)nextMove()},600)}}
function resetCube(){location.reload()}
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)}
