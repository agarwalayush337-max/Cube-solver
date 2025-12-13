// ==========================================
// CONFIG & STATE
// ==========================================
const CUBE_MAP = {
    'U': { color: 'white',  hex: 0xffffff, r: [0.6, 0, 0] },     // Up
    'F': { color: 'green',  hex: 0x00ff00, r: [0.1, 0, 0] },     // Front
    'R': { color: 'red',    hex: 0xb90000, r: [0.1, -1.6, 0] },  // Right
    'L': { color: 'orange', hex: 0xff5800, r: [0.1, 1.6, 0] },   // Left
    'B': { color: 'blue',   hex: 0x0045ad, r: [0.1, 3.2, 0] },   // Back
    'D': { color: 'yellow', hex: 0xffd500, r: [-1.6, 0, 0] }     // Down
};

// Logical Cube State (What we send to solver)
let cubeState = {
    'U': Array(9).fill('U'), 'R': Array(9).fill('R'), 'F': Array(9).fill('F'),
    'D': Array(9).fill('D'), 'L': Array(9).fill('L'), 'B': Array(9).fill('B')
};

let currentFace = 'F'; // Start at Front
let isScanning = true;
let video, canvas, ctx;

// 3D Vars
let scene, camera, renderer, cubeGroup, allMeshes = [];

// ==========================================
// 1. INIT
// ==========================================
function onOpenCvReady() {
    initCamera();
    init3D();
    setupControls();
}

async function initCamera() {
    video = document.getElementById('video-feed');
    canvas = document.getElementById('hidden-canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    video.play();
    
    // Start Vision Loop
    requestAnimationFrame(processFrame);
}

// ==========================================
// 2. VISION ENGINE (Corrected Mirroring)
// ==========================================
function processFrame() {
    if (!isScanning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Analyze
        const colors = scanGrid(canvas.width, canvas.height);
        
        // Update 3D Live
        update3DPreview(colors);
    }
    requestAnimationFrame(processFrame);
}

function scanGrid(w, h) {
    const boxSize = Math.min(w, h) * 0.6; // Size of the green box relative to screen
    const startX = (w - boxSize) / 2;
    const startY = (h - boxSize) / 2;
    const cellSize = boxSize / 3;

    let detected = [];

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            
            // CRITICAL FIX: MIRROR LOGIC
            // We sample from Right to Left to match the mirrored display
            // But we store in standard order (TopLeft -> TopRight)
            
            // Visual X (Mirrored):
            let visualCol = 2 - col; 
            
            const centerX = startX + (visualCol * cellSize) + (cellSize/2);
            const centerY = startY + (row * cellSize) + (cellSize/2);
            
            // Sample pixel
            const p = ctx.getImageData(centerX, centerY, 1, 1).data;
            const char = getNearestColor(p[0], p[1], p[2]);
            detected.push(char);
        }
    }
    return detected;
}

// CENTER-RELATIVE COLOR MATCHING
// Instead of hard ranges, we check distance to standard palette
function getNearestColor(r, g, b) {
    // Standard Palette (Tune these RGBs to your specific cube if needed)
    const palette = [
        { id: 'U', r: 230, g: 230, b: 230 }, // White (Bright)
        { id: 'D', r: 200, g: 200, b: 50 },  // Yellow
        { id: 'R', r: 180, g: 30,  b: 30 },  // Red
        { id: 'L', r: 220, g: 100, b: 30 },  // Orange
        { id: 'F', r: 0,   g: 150, b: 50 },  // Green
        { id: 'B', r: 0,   g: 50,  b: 180 }   // Blue
    ];

    let bestMatch = 'U';
    let minDiff = Infinity;

    // Convert input to HSL for better match? 
    // For now, Euclidean RGB is faster and works if centers are distinct
    palette.forEach(c => {
        // Weighted Distance (Red/Blue define color more than Green)
        const diff = Math.sqrt(
            2 * (c.r - r)**2 + 
            4 * (c.g - g)**2 + 
            3 * (c.b - b)**2
        );
        if (diff < minDiff) {
            minDiff = diff;
            bestMatch = c.id;
        }
    });
    return bestMatch;
}

// ==========================================
// 3. 3D SYSTEM (Rotation Pattern)
// ==========================================
function init3D() {
    const cont = document.getElementById('three-preview');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    
    camera = new THREE.PerspectiveCamera(45, cont.clientWidth/cont.clientHeight, 0.1, 100);
    camera.position.z = 6;
    
    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(cont.clientWidth, cont.clientHeight);
    cont.appendChild(renderer.domElement);

    cubeGroup = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95);

    // Build 27 Cubies
    for(let x=-1; x<=1; x++) {
        for(let y=-1; y<=1; y++) {
            for(let z=-1; z<=1; z++) {
                // Default Dark Grey
                const mats = Array(6).fill(null).map(()=>new THREE.MeshBasicMaterial({color:0x333333}));
                const mesh = new THREE.Mesh(geo, mats);
                mesh.position.set(x,y,z);
                mesh.userData = {x,y,z};
                cubeGroup.add(mesh);
                allMeshes.push(mesh);
            }
        }
    }
    scene.add(cubeGroup);
    
    const animate = () => { requestAnimationFrame(animate); renderer.render(scene, camera); };
    animate();
    
    rotateToFace('F'); // Start
}

function update3DPreview(colors) {
    // 1. Update internal state
    cubeState[currentFace] = colors;

    // 2. Identify which face of the 3D cube is visible
    // This mapping depends on how the cube is rotated.
    // For "Front" view, we paint the Z=1 face.
    // For "Right" view, we paint the X=1 face.
    
    let targetZ = 0, targetX = 0, targetY = 0;
    let faceIndex = 0; // standard material index

    if(currentFace === 'F') { targetZ=1; faceIndex=4; }
    if(currentFace === 'B') { targetZ=-1; faceIndex=5; }
    if(currentFace === 'R') { targetX=1; faceIndex=0; }
    if(currentFace === 'L') { targetX=-1; faceIndex=1; }
    if(currentFace === 'U') { targetY=1; faceIndex=2; }
    if(currentFace === 'D') { targetY=-1; faceIndex=3; }

    // Filter relevant meshes
    let faceMeshes = allMeshes.filter(m => {
        if(targetZ !== 0) return m.userData.z === targetZ;
        if(targetX !== 0) return m.userData.x === targetX;
        if(targetY !== 0) return m.userData.y === targetY;
    });

    // SORTING IS KEY: Must match scanning order (TopLeft -> BottomRight)
    faceMeshes.sort((a,b) => {
        // Standard vertical sort
        const dy = b.userData.y - a.userData.y; 
        if(Math.abs(dy) > 0.1) return dy; // Top rows first (y=1 -> y=-1)
        
        // Horizontal sort depends on face
        if(currentFace === 'B') return b.userData.x - a.userData.x; // Back is reversed
        return a.userData.x - b.userData.x; // Standard Left -> Right
    });

    // Apply colors
    colors.forEach((c, i) => {
        if(faceMeshes[i]) {
            faceMeshes[i].material[faceIndex].color.setHex(CUBE_MAP[c].hex);
        }
    });
}

function rotateToFace(face) {
    // Smoothly snap to predetermined angles
    const rot = CUBE_MAP[face].r;
    cubeGroup.rotation.set(rot[0], rot[1], rot[2]);
}

// ==========================================
// 4. UI LOGIC
// ==========================================
function setupControls() {
    // Nav Buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Rotate Logic
            currentFace = e.target.dataset.face;
            rotateToFace(currentFace);
            
            document.getElementById('status-pill').innerText = "Scanning: " + CUBE_MAP[currentFace].color.toUpperCase();
        });
    });

    // Scan Button
    document.getElementById('scan-btn').addEventListener('click', () => {
        // Mark current face as done visually
        document.querySelector(`.nav-btn[data-face="${currentFace}"]`).classList.add('done');
        
        // Check if all done
        const allDone = Array.from(document.querySelectorAll('.nav-btn')).every(b => b.classList.contains('done'));
        if(allDone) {
            document.getElementById('scan-btn').classList.add('hidden');
            document.getElementById('solve-btn').classList.remove('hidden');
        } else {
            // Suggest next face (Simple rotation flow: F -> R -> B -> L -> U -> D)
            // You can implement auto-switch here if desired
        }
    });
    
    // Solver Link
    document.getElementById('solve-btn').addEventListener('click', () => {
        isScanning = false;
        
        // Build Kociemba String
        const order = ['U', 'R', 'F', 'D', 'L', 'B'];
        let str = "";
        order.forEach(f => str += cubeState[f].join(''));
        
        // Run Worker
        const worker = new Worker('solver-worker.js');
        worker.postMessage(str);
        
        worker.onmessage = (e) => {
            if(e.data.success) {
                alert("Solved!");
                // Show moves (Implementation of step-by-step UI here)
                // ...
            } else {
                alert("Error: " + e.data.error);
            }
        };
    });
}
