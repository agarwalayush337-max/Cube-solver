// ==========================================
// CONFIGURATION & STATE
// ==========================================
let video, canvas, ctx;
let openCvReady = false;

// 3D Variables
let scene, camera, renderer, cubeGroup;
let cubeMeshes = []; // Array to store the 54 face meshes (9 per side * 6 sides)

// Logic State
let isScanning = true;
let currentFaceIndex = 0; // 0=U, 1=R, 2=F, 3=D, 4=L, 5=B
const faceOrder = ['U', 'R', 'F', 'D', 'L', 'B'];
const faceNames = ['Up (White)', 'Right (Red)', 'Front (Green)', 'Down (Yellow)', 'Left (Orange)', 'Back (Blue)'];

// Color Definitions (Display Colors)
const COLORS = {
    'U': 0xFFFFFF, // White
    'R': 0xB90000, // Red
    'F': 0x009E60, // Green
    'D': 0xFFD500, // Yellow
    'L': 0xFF5800, // Orange
    'B': 0x0045AD, // Blue
    'X': 0x333333  // Grey/Unscanned
};

// State of the cube (what we will send to solver)
// We fill this array as we scan.
let cubeState = {
    'U': Array(9).fill('U'), // Default to White for U face
    'R': Array(9).fill('R'),
    'F': Array(9).fill('F'),
    'D': Array(9).fill('D'),
    'L': Array(9).fill('L'),
    'B': Array(9).fill('B')
};

// ==========================================
// 1. STARTUP
// ==========================================
function onOpenCvReady() {
    console.log("OpenCV Ready");
    openCvReady = true;
    init3D();       // Start the 3D cube immediately (bottom screen)
    startCamera();  // Start the camera (top screen)
}

async function startCamera() {
    video = document.getElementById('camera-feed');
    canvas = document.getElementById('overlay-canvas');
    ctx = canvas.getContext('2d');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            processVideoFrame(); // Start the vision loop
        };
    } catch (err) {
        alert("Camera Error: " + err.message);
    }

    document.getElementById('scan-btn').addEventListener('click', nextFace);
    document.getElementById('solve-btn').addEventListener('click', solveCube);
}

// ==========================================
// 2. VISION LOOP (Realtime Mirroring)
// ==========================================
function processVideoFrame() {
    if (!openCvReady || video.paused || video.ended) {
        requestAnimationFrame(processVideoFrame);
        return;
    }

    // 1. Draw frame to hidden canvas to read pixels
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. If we are scanning, analyze colors under the grid
    if (isScanning) {
        const detectedColors = scanGridColors();
        
        // 3. Update the 3D Cube LIVE to match what we see
        update3DLivePreview(detectedColors);
    }

    requestAnimationFrame(processVideoFrame);
}

function scanGridColors() {
    // Grid geometry matches CSS (#scan-grid)
    // We assume the grid is centered in the video frame
    const size = Math.min(canvas.width, canvas.height) * 0.5; // Roughly the visual size
    const startX = (canvas.width - size) / 2;
    const startY = (canvas.height - size) / 2;
    const cellSize = size / 3;

    let faceColors = [];

    for (let i = 0; i < 9; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;

        // Sample Center of the cell
        const x = Math.floor(startX + (col * cellSize) + (cellSize / 2));
        const y = Math.floor(startY + (row * cellSize) + (cellSize / 2));

        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const colorCode = classifyColor(pixel[0], pixel[1], pixel[2]);
        faceColors.push(colorCode);
    }
    return faceColors;
}

// Convert RGB to Cube Color Code
function classifyColor(r, g, b) {
    // Simple Euclidean distance map
    const map = [
        { char: 'U', r: 255, g: 255, b: 255 }, // White
        { char: 'D', r: 255, g: 255, b: 0 },   // Yellow
        { char: 'R', r: 200, g: 0,   b: 0 },   // Red
        { char: 'L', r: 255, g: 100, b: 0 },   // Orange
        { char: 'F', r: 0,   g: 255, b: 0 },   // Green
        { char: 'B', r: 0,   g: 0,   b: 255 }    // Blue
    ];

    let minDist = Infinity;
    let match = 'U';

    map.forEach(c => {
        const dist = Math.sqrt((r-c.r)**2 + (g-c.g)**2 + (b-c.b)**2);
        if (dist < minDist) {
            minDist = dist;
            match = c.char;
        }
    });
    return match;
}

// ==========================================
// 3. 3D VISUALIZATION
// ==========================================
function init3D() {
    const container = document.getElementById('three-canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 6); // Look straight at the cube front
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Create the Cube (27 cubies)
    cubeGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95); // Gap between cubes

    // We need to identify which mesh belongs to which face to update it dynamically
    // Order of ThreeJS BoxGeometry materials: Right, Left, Top, Bottom, Front, Back
    
    // Create a logical map to access meshes by face index (0-8)
    // We will build a helper structure: cubeFaceMap['F'][4] = (Mesh Object)
    
    // Simplified: Just build the group, we will paint it by raycasting or logical mapping
    // Actually, logical mapping is better for the "solver" data structure.
    
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                // Default grey material
                const materials = Array(6).fill(null).map(() => new THREE.MeshBasicMaterial({ color: 0x333333 }));
                const mesh = new THREE.Mesh(geometry, materials);
                mesh.position.set(x, y, z);
                mesh.userData = { x, y, z }; // Store logic position
                cubeGroup.add(mesh);
                cubeMeshes.push(mesh);
            }
        }
    }
    
    scene.add(cubeGroup);
    
    // Rotate slightly so we see 3D depth
    cubeGroup.rotation.x = 0.5;
    cubeGroup.rotation.y = 0.5;

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();
    
    // Initial Orientation (Show UP face)
    rotateToFace('U');
}

// This is the Magic Function: Paints the 3D cube based on Camera Input
function update3DLivePreview(detectedColors) {
    const faceName = faceOrder[currentFaceIndex];
    
    // Update our internal state
    cubeState[faceName] = detectedColors;

    // Update 3D Meshes
    // This logic maps the flat array (0-8) to the 3D coordinates (x,y,z)
    // This is complex because "Front" changes based on rotation. 
    // Simplified approach: We only paint the side facing the camera in the 3D view.
    
    // We need to know which 9 meshes correspond to the current face
    const meshesToPaint = getMeshesForFace(faceName);
    
    detectedColors.forEach((colorCode, idx) => {
        const hex = COLORS[colorCode];
        const mesh = meshesToPaint[idx].mesh;
        const matIndex = meshesToPaint[idx].matIndex;
        mesh.material[matIndex].color.setHex(hex);
    });
}

function getMeshesForFace(face) {
    // Returns array of { mesh, matIndex } for the 9 cubies of a face
    // Sorted top-left to bottom-right
    let filtered = [];
    
    cubeMeshes.forEach(mesh => {
        const { x, y, z } = mesh.userData;
        
        if (face === 'F' && z === 1) filtered.push({ mesh, matIndex: 4, x, y: -y }); // Invert Y for array order
        if (face === 'B' && z === -1) filtered.push({ mesh, matIndex: 5, x: -x, y: -y });
        if (face === 'U' && y === 1) filtered.push({ mesh, matIndex: 2, x, y: z }); // Map Z to Y for 2D sorting
        if (face === 'D' && y === -1) filtered.push({ mesh, matIndex: 3, x, y: -z });
        if (face === 'R' && x === 1) filtered.push({ mesh, matIndex: 0, x: -z, y: -y });
        if (face === 'L' && x === -1) filtered.push({ mesh, matIndex: 1, x: z, y: -y });
    });

    // Sort to match the scanning order (Top-Left -> Bottom-Right)
    filtered.sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y; // Row first
        return a.x - b.x; // Then Col
    });
    
    return filtered;
}

// ==========================================
// 4. APP LOGIC (Scanning Steps)
// ==========================================

function nextFace() {
    // User clicked "Capture". The current colors are already in cubeState (due to live preview).
    // Just animate to the next face.
    
    currentFaceIndex++;
    
    if (currentFaceIndex < 6) {
        const nextFaceName = faceOrder[currentFaceIndex];
        document.getElementById('instruction').innerText = `SCAN: ${faceNames[currentFaceIndex]}`;
        
        // Rotate 3D cube to show the new face to be scanned
        rotateToFace(nextFaceName);
    } else {
        // Scanning Done
        isScanning = false;
        document.getElementById('instruction').innerText = "SCAN COMPLETE";
        document.getElementById('scan-btn').classList.add('hidden');
        document.getElementById('solve-btn').classList.remove('hidden');
    }
}

function rotateToFace(face) {
    // GSAP would be better, but we'll snap for now or use simple lerp
    // Reset rotation
    cubeGroup.rotation.set(0,0,0);
    
    switch(face) {
        case 'U': cubeGroup.rotation.x = 0.5; cubeGroup.rotation.y = 0.5; break; // Angled Top
        case 'F': cubeGroup.rotation.set(0.2, 0, 0); break;
        case 'R': cubeGroup.rotation.set(0.2, -1.5, 0); break;
        case 'D': cubeGroup.rotation.set(-1.5, 0, 0); break; // Look from bottom
        case 'L': cubeGroup.rotation.set(0.2, 1.5, 0); break;
        case 'B': cubeGroup.rotation.set(0.2, 3.14, 0); break;
    }
}

function solveCube() {
    // Send cubeState to Worker (from previous answer)
    // ... (Use the worker code provided previously) ...
    // For visual demo, we just alert
    alert("Sending to solver logic...");
}
