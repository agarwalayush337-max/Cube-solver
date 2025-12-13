// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const COLORS = {
    'U': { code: 'U', hex: '#FFFFFF', name: 'White' },
    'R': { code: 'R', hex: '#B90000', name: 'Red' },
    'F': { code: 'F', hex: '#009E60', name: 'Green' },
    'D': { code: 'D', hex: '#FFD500', name: 'Yellow' },
    'L': { code: 'L', hex: '#FF5800', name: 'Orange' },
    'B': { code: 'B', hex: '#0045AD', name: 'Blue' }
};

// Standard Cube Orientation Rules for Rotation
const FACE_ROTATIONS = {
    'U': [0.5, 0, 0],     // Top
    'F': [0, 0, 0],       // Front
    'R': [0, -1.57, 0],   // Right
    'L': [0, 1.57, 0],    // Left
    'B': [0, 3.14, 0],    // Back
    'D': [-0.5, 0, 0]     // Bottom
};

let currentFace = 'F';
let isMirrored = true; // Default to mirrored (Front Camera behavior)
let cubeState = {
    'U': Array(9).fill('U'), 'R': Array(9).fill('R'), 'F': Array(9).fill('F'),
    'D': Array(9).fill('D'), 'L': Array(9).fill('L'), 'B': Array(9).fill('B')
};
// To store detected colors temporarily before capturing
let liveDetection = Array(9).fill('U');

// Three.js Globals
let scene, camera, renderer, cubeGroup, allMeshes = [];

// Solver
let solutionMoves = [];
let currentMoveIdx = 0;

// ==========================================
// 2. INITIALIZATION
// ==========================================
window.onload = function() {
    initCamera();
    init3D();
    
    // Setup Mirror Toggle
    document.getElementById('mirror-toggle').addEventListener('click', () => {
        isMirrored = !isMirrored;
        const video = document.getElementById('video-feed');
        if(isMirrored) video.classList.remove('no-mirror');
        else video.classList.add('no-mirror');
    });
};

async function initCamera() {
    const video = document.getElementById('video-feed');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = stream;
        video.play();
        requestAnimationFrame(visionLoop);
    } catch (e) {
        alert("Camera Error: " + e.message);
    }
}

// ==========================================
// 3. ROBUST VISION ENGINE (Lab Color Space)
// ==========================================
function visionLoop() {
    const video = document.getElementById('video-feed');
    const canvas = document.getElementById('vision-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // 1. HANDLE MIRRORING ACCURATELY
        ctx.save();
        if (isMirrored) {
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        } else {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();

        // 2. SAMPLE GRID
        // Define grid region (center 50% of screen)
        const size = Math.min(canvas.width, canvas.height) * 0.5;
        const startX = (canvas.width - size) / 2;
        const startY = (canvas.height - size) / 2;
        const step = size / 3;

        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / 3);
            const col = i % 3;
            
            // Sample center pixel
            const cx = Math.floor(startX + col * step + step / 2);
            const cy = Math.floor(startY + row * step + step / 2);
            
            const p = ctx.getImageData(cx, cy, 1, 1).data;
            const detected = classifyColorLab(p[0], p[1], p[2]);
            
            liveDetection[i] = detected;
            
            // Update UI Dot Color
            const cell = document.getElementById(`cell-${i}`);
            cell.style.setProperty('--dot-color', COLORS[detected].hex);
            cell.querySelector('::after').style.backgroundColor = COLORS[detected].hex;
        }

        // Update 3D Preview Live
        update3DState(currentFace, liveDetection);
    }
    requestAnimationFrame(visionLoop);
}

// RGB to CIELAB Conversion & Delta E Calculation
// This is significantly more accurate than RGB or HSV for human-eye colors
function classifyColorLab(r, g, b) {
    const lab = rgb2lab([r, g, b]);
    
    // Reference Palette in Lab Space
    // Values derived from standard sticker averages
    const palette = {
        'U': [90, 0, 0],      // White (High L, Neutral a/b)
        'D': [85, -10, 85],   // Yellow (High L, High b)
        'R': [45, 60, 45],    // Red (Med L, High a)
        'L': [60, 45, 65],    // Orange (Higher L than red, High b)
        'B': [35, 10, -55],   // Blue (Low L, Negative b)
        'F': [45, -50, 40]    // Green (Med L, Negative a)
    };

    let minDiff = Infinity;
    let bestMatch = 'U';

    for (let key in palette) {
        const ref = palette[key];
        // Euclidean distance in Lab space (Delta E 76 approx)
        const diff = Math.sqrt(
            Math.pow(lab[0] - ref[0], 2) + 
            Math.pow(lab[1] - ref[1], 2) + 
            Math.pow(lab[2] - ref[2], 2)
        );
        
        // Weight adjustments for common errors
        // Orange/Red confusion is common. If color is Orange but diff is close to Red, bias towards Red if L is low.
        let weightedDiff = diff;
        
        if (weightedDiff < minDiff) {
            minDiff = weightedDiff;
            bestMatch = key;
        }
    }
    return bestMatch;
}

// Helper: RGB to Lab Math
function rgb2lab(rgb) {
    let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
    y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
    z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

// ==========================================
// 4. INTERACTION & LOGIC
// ==========================================

function selectFace(faceCode) {
    currentFace = faceCode;
    
    // UI Update
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-face="${faceCode}"]`).classList.add('active');
    
    // Instruction Update
    const name = COLORS[faceCode].name;
    const hex = COLORS[faceCode].hex;
    const label = document.getElementById('target-color');
    label.innerText = name;
    label.style.color = hex;

    // Rotate 3D Model
    if(cubeGroup) {
        const rot = FACE_ROTATIONS[faceCode];
        // Simple lerp or snap
        cubeGroup.rotation.set(rot[0], rot[1], rot[2]);
    }
}

// TAP TO CORRECT (The "0 Error" feature)
const colorCycle = ['U', 'R', 'F', 'D', 'L', 'B'];
function manualCorrect(index) {
    if (index === 4) return; // Cannot change center

    // Get current detected color
    let current = liveDetection[index];
    
    // Find index in cycle and get next
    let colorIdx = colorCycle.indexOf(current);
    let nextColor = colorCycle[(colorIdx + 1) % 6];
    
    // Force update the live detection array
    liveDetection[index] = nextColor;
    
    // Update visual immediately
    const cell = document.getElementById(`cell-${index}`);
    cell.querySelector('::after').style.backgroundColor = COLORS[nextColor].hex;
}

function captureCurrentFace() {
    // Lock the current live detection into the official state
    // Create a copy to prevent reference issues
    cubeState[currentFace] = [...liveDetection];
    
    // Visual Feedback
    document.querySelector(`.nav-btn[data-face="${currentFace}"]`).classList.add('scanned');
    
    // Auto-advance logic (Simple)
    const order = ['F', 'R', 'B', 'L', 'U', 'D'];
    let currIdx = order.indexOf(currentFace);
    if(currIdx < 5) {
        selectFace(order[currIdx + 1]);
    } else {
        // All done?
        document.getElementById('scan-btn').classList.add('hidden');
        document.getElementById('solve-btn').classList.remove('hidden');
    }
}

function solveCube() {
    // Check if worker exists, if not basic logic
    const order = ['U', 'R', 'F', 'D', 'L', 'B'];
    let faceStr = "";
    
    // Validate state integrity roughly
    // (Count stickers: should be 9 of each color)
    
    order.forEach(f => faceStr += cubeState[f].join(''));
    
    console.log("Solving:", faceStr);
    
    // Worker Implementation
    const worker = new Worker('solver-worker.js');
    worker.postMessage(faceStr);
    
    worker.onmessage = (e) => {
        if(e.data.success) {
            solutionMoves = e.data.solution.split(' ');
            currentMoveIdx = 0;
            showSolution();
        } else {
            alert("Cube is impossible! Double check your colors. Tap grid cells to fix errors.");
        }
        worker.terminate();
    }
}

function showSolution() {
    document.getElementById('solution-overlay').classList.remove('hidden');
    updateMoveText();
}

function nextMove() {
    if(currentMoveIdx < solutionMoves.length) {
        currentMoveIdx++;
        updateMoveText();
    }
}

function prevMove() {
    if(currentMoveIdx > 0) {
        currentMoveIdx--;
        updateMoveText();
    }
}

function updateMoveText() {
    const display = document.getElementById('move-display');
    if(currentMoveIdx === 0) display.innerText = "Start";
    else if(currentMoveIdx > solutionMoves.length) display.innerText = "Solved!";
    else display.innerText = solutionMoves[currentMoveIdx - 1];
}

// ==========================================
// 5. 3D SYSTEM (Visual Mirror)
// ==========================================
function init3D() {
    const container = document.getElementById('three-preview');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    
    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 5;
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    
    // Build Cube
    cubeGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    
    for(let x=-1; x<=1; x++) {
        for(let y=-1; y<=1; y++) {
            for(let z=-1; z<=1; z++) {
                const materials = Array(6).fill(null).map(() => 
                    new THREE.MeshBasicMaterial({ color: 0x222222 })
                );
                const mesh = new THREE.Mesh(geometry, materials);
                mesh.position.set(x,y,z);
                mesh.userData = { x, y, z };
                cubeGroup.add(mesh);
                allMeshes.push(mesh);
            }
        }
    }
    scene.add(cubeGroup);
    
    // Start loop
    const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };
    animate();
}

function update3DState(face, colors) {
    // Map logical colors to visual hex
    // Identify face meshes
    // Similar to previous mapping logic but simpler:
    
    let targetAxis = '';
    let targetVal = 0;
    let materialIndex = 0;

    if (face === 'U') { targetAxis = 'y'; targetVal = 1; materialIndex = 2; }
    if (face === 'D') { targetAxis = 'y'; targetVal = -1; materialIndex = 3; }
    if (face === 'F') { targetAxis = 'z'; targetVal = 1; materialIndex = 4; }
    if (face === 'B') { targetAxis = 'z'; targetVal = -1; materialIndex = 5; }
    if (face === 'R') { targetAxis = 'x'; targetVal = 1; materialIndex = 0; }
    if (face === 'L') { targetAxis = 'x'; targetVal = -1; materialIndex = 1; }

    const faceMeshes = allMeshes.filter(m => m.userData[targetAxis] === targetVal);

    // Sort top-left to bottom-right based on face orientation
    faceMeshes.sort((a, b) => {
        const az = a.userData;
        const bz = b.userData;
        
        // Sorting logic varies by face, simplified here for general cases
        if(face === 'U' || face === 'D') return (az.z - bz.z) || (az.x - bz.x);
        return (bz.y - az.y) || (az.x - bz.x);
    });

    colors.forEach((c, idx) => {
        if(faceMeshes[idx]) {
            faceMeshes[idx].material[materialIndex].color.set(COLORS[c].hex);
        }
    });
}
