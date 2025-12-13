// ==========================================
// CONFIG & STATE
// ==========================================
const COLORS = {
    'U': { hex: 0xFFFFFF, name: 'White' },
    'R': { hex: 0xB90000, name: 'Red' },
    'F': { hex: 0x009E60, name: 'Green' },
    'D': { hex: 0xFFD500, name: 'Yellow' },
    'L': { hex: 0xFF5800, name: 'Orange' },
    'B': { hex: 0x0045AD, name: 'Blue' }
};

// Map standard order to indices for internal logic
const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
let currentFace = 'U';
let cubeState = {
    'U': Array(9).fill('U'), 'R': Array(9).fill('R'), 'F': Array(9).fill('F'),
    'D': Array(9).fill('D'), 'L': Array(9).fill('L'), 'B': Array(9).fill('B')
};
let scannedFaces = new Set(); // Track which faces are done

// ThreeJS Globals
let scene, camera, renderer, cubeGroup;
let allCubies = []; // Store mesh references

let video, cvCanvas, cvCtx;
let isScanning = true;

// ==========================================
// 1. INITIALIZATION
// ==========================================
function onOpenCvReady() {
    document.getElementById('loader').style.display = 'none';
    initCamera();
    init3D();
    setupUI();
}

async function initCamera() {
    video = document.getElementById('video-feed');
    cvCanvas = document.getElementById('processing-canvas');
    cvCtx = cvCanvas.getContext('2d', { willReadFrequently: true });

    try {
        // Request Highest Definition possible for clarity
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 }, // Force high res
                height: { ideal: 1080 },
                focusMode: 'continuous'
            }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            // Important: Match canvas size to video stream, NOT screen size
            cvCanvas.width = video.videoWidth;
            cvCanvas.height = video.videoHeight;
            requestAnimationFrame(scanLoop);
        };
    } catch (err) {
        alert("Camera Error: " + err.message);
    }
}

// ==========================================
// 2. VISION LOOP (HSV LOGIC)
// ==========================================
function scanLoop() {
    if (video.readyState === video.HAVE_ENOUGH_DATA && isScanning) {
        cvCtx.drawImage(video, 0, 0, cvCanvas.width, cvCanvas.height);
        
        // Analyze the 9 grid points
        const colors = analyzeGrid();
        
        // Live Update the 3D Cube
        update3DPreview(colors);
    }
    requestAnimationFrame(scanLoop);
}

function analyzeGrid() {
    // Dynamic Grid sizing based on actual video resolution
    const size = Math.min(cvCanvas.width, cvCanvas.height) * 0.5;
    const startX = (cvCanvas.width - size) / 2;
    const startY = (cvCanvas.height - size) / 2;
    const step = size / 3;

    let detected = [];

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const x = Math.floor(startX + col * step + step / 2);
            const y = Math.floor(startY + row * step + step / 2);
            
            // Get pixel data
            const p = cvCtx.getImageData(x, y, 1, 1).data;
            const colorChar = classifyColorHSV(p[0], p[1], p[2]);
            detected.push(colorChar);
        }
    }
    return detected;
}

// ROBUST COLOR DETECTION (HSV)
// Converts RGB to HSV and checks ranges
function classifyColorHSV(r, g, b) {
    // 1. Convert RGB to HSV
    r /= 255, g /= 255, b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    let d = max - min;
    s = max == 0 ? 0 : d / max;

    if (max == min) h = 0; 
    else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    // HSV Ranges (0-360 hue is 0-1 here)
    // Tune these if specific lighting fails
    
    // White: Low Saturation
    if (s < 0.2 && v > 0.5) return 'U'; 
    
    // Yellow: High Val, Yellow Hue (~0.16)
    if (h > 0.12 && h < 0.22) return 'D';
    
    // Orange: Low Hue (~0.08)
    if (h > 0.02 && h < 0.12) return 'L';
    
    // Red: Very low or very high Hue
    if (h <= 0.02 || h >= 0.95) return 'R';
    
    // Green: ~0.33
    if (h > 0.22 && h < 0.45) return 'F';
    
    // Blue: ~0.66
    if (h > 0.5 && h < 0.75) return 'B';

    return 'U'; // Default fallback
}

// ==========================================
// 3. 3D VISUALIZATION
// ==========================================
function init3D() {
    const container = document.getElementById('three-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Create 3x3x3 Cube Group
    cubeGroup = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.92, 0.92, 0.92);

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const mats = Array(6).fill(null).map(() => new THREE.MeshBasicMaterial({ color: 0x111111 }));
                const mesh = new THREE.Mesh(geo, mats);
                mesh.position.set(x, y, z);
                mesh.userData = { x, y, z }; // Logical coordinates
                cubeGroup.add(mesh);
                allCubies.push(mesh);
            }
        }
    }
    scene.add(cubeGroup);
    
    // Add simple lighting just in case we switch materials
    const light = new THREE.AmbientLight(0xffffff);
    scene.add(light);

    // Initial orientation
    rotate3DToFace('U');

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();
}

function rotate3DToFace(face) {
    // Hard reset rotation then apply specific angle
    cubeGroup.rotation.set(0,0,0);
    
    // These angles orient the cube so the selected face is front-center
    const angles = {
        'U': [0.5, 0.5, 0],     // Angled view of Top
        'F': [0.2, 0, 0],       // Front
        'R': [0.2, -1.6, 0],    // Right
        'L': [0.2, 1.6, 0],     // Left
        'B': [0.2, 3.14, 0],    // Back
        'D': [-1.6, 0, 0]       // Bottom
    };
    
    const [x, y, z] = angles[face];
    
    // Simple transition (could be tweened)
    cubeGroup.rotation.set(x, y, z);
}

function update3DPreview(detectedColors) {
    // Only paint the face we are currently looking at
    // We need to find the 9 meshes corresponding to 'currentFace'
    
    // Map logical face to 3D normals
    const faceNormalMap = {
        'U': { axis: 'y', val: 1, matIdx: 2 },
        'D': { axis: 'y', val: -1, matIdx: 3 },
        'F': { axis: 'z', val: 1, matIdx: 4 },
        'B': { axis: 'z', val: -1, matIdx: 5 },
        'R': { axis: 'x', val: 1, matIdx: 0 },
        'L': { axis: 'x', val: -1, matIdx: 1 }
    };

    const config = faceNormalMap[currentFace];
    
    // Filter cubies that are on this face
    let faceCubies = allCubies.filter(c => c.userData[config.axis] === config.val);
    
    // Sort them Top-Left to Bottom-Right (Visual)
    // This sorting depends on the face.
    faceCubies.sort((a, b) => {
        // This is a simplified sort for standard orientation
        if (currentFace === 'U' || currentFace === 'D') return a.userData.x - b.userData.x || a.userData.z - b.userData.z;
        return a.userData.x - b.userData.x || -a.userData.y + b.userData.y; 
        // Note: A perfect generic sorter requires more logic, but this covers most standard holds.
    });

    detectedColors.forEach((color, idx) => {
        if(faceCubies[idx]) {
            faceCubies[idx].material[config.matIdx].color.setHex(COLORS[color].hex);
        }
    });
}

// ==========================================
// 4. APP LOGIC & UI
// ==========================================
function setupUI() {
    // Face Selectors
    document.querySelectorAll('.face-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentFace = e.target.dataset.face;
            
            // UI Updates
            document.querySelectorAll('.face-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            document.getElementById('scan-feedback').innerText = "Align Face: " + COLORS[currentFace].name;
            rotate3DToFace(currentFace);
        });
    });

    // Capture Button
    document.getElementById('capture-btn').addEventListener('click', () => {
        // Save current preview to state
        const detected = analyzeGrid(); // Get fresh read
        cubeState[currentFace] = detected;
        scannedFaces.add(currentFace);

        // Mark UI as scanned
        document.querySelector(`.face-btn[data-face="${currentFace}"]`).classList.add('scanned');

        // Auto-advance logic (optional)
        // ...

        if (scannedFaces.size === 6) {
            document.getElementById('solve-btn').classList.remove('hidden');
            document.getElementById('capture-btn').classList.add('hidden');
        }
    });

    // Solve Button
    document.getElementById('solve-btn').addEventListener('click', runSolver);
}

function runSolver() {
    isScanning = false; // Stop camera updates
    
    // Format string for Kociemba: U...R...F...D...L...B...
    let faceStr = '';
    FACE_ORDER.forEach(f => {
        faceStr += cubeState[f].join('');
    });

    console.log("Solving:", faceStr);

    // Call Worker (Assuming you have solver-worker.js)
    const worker = new Worker('solver-worker.js');
    worker.postMessage(faceStr);
    
    worker.onmessage = (e) => {
        if(e.data.success) {
            alert("Solution Found!");
            showSolutionUI(e.data.solution);
        } else {
            alert("Cube Invalid! Check scans. " + e.data.error);
        }
    };
}

function showSolutionUI(solution) {
    document.getElementById('actions').classList.add('hidden');
    document.getElementById('solution-controls').classList.remove('hidden');
    
    const moves = solution.split(' ');
    let idx = 0;
    
    document.getElementById('move-display').innerText = `Start (${moves.length} moves)`;
    
    document.getElementById('next-move').addEventListener('click', () => {
        if(idx < moves.length) {
            document.getElementById('move-display').innerText = moves[idx];
            // Here you would add the rotation animation for the 3D cube
            idx++;
        } else {
            document.getElementById('move-display').innerText = "DONE!";
        }
    });
}
