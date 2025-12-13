// ==========================================
// GLOBAL STATE
// ==========================================
let video, canvas, ctx;
let openCvReady = false;
let isScanning = true;

// Stores the color of every sticker. 
// Order: U (Up), R (Right), F (Front), D (Down), L (Left), B (Back)
let cubeState = {
    'U': ['U','U','U','U','U','U','U','U','U'],
    'R': ['R','R','R','R','R','R','R','R','R'],
    'F': ['F','F','F','F','F','F','F','F','F'],
    'D': ['D','D','D','D','D','D','D','D','D'],
    'L': ['L','L','L','L','L','L','L','L','L'],
    'B': ['B','B','B','B','B','B','B','B','B']
};

// The standard scanning order required for the solver to understand orientation
const captureOrder = ['U', 'R', 'F', 'D', 'L', 'B'];
let currentFaceIndex = 0;

// ==========================================
// 1. INITIALIZATION & CAMERA
// ==========================================

// Called by the HTML script tag when OpenCV is ready
function onOpenCvReady() {
    console.log("OpenCV Ready");
    openCvReady = true;
    startCamera();
}

async function startCamera() {
    video = document.getElementById('camera-feed');
    canvas = document.getElementById('overlay-canvas');
    ctx = canvas.getContext('2d');

    // Request rear camera
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            requestAnimationFrame(tick); // Start the drawing loop
        };
    } catch (err) {
        alert("Camera access denied or not available: " + err.message);
    }

    // Attach button listener
    document.getElementById('capture-btn').addEventListener('click', captureFace);
    
    // Initial Instruction
    updateInstruction();
}

// Main Loop: Draws the grid overlay on top of the camera
function tick() {
    if (!isScanning) return; // Stop drawing if we are in 3D mode

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Clear previous draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the 3x3 grid guide
        drawGridOverlay();
    }
    requestAnimationFrame(tick);
}

function drawGridOverlay() {
    const size = Math.min(canvas.width, canvas.height) * 0.6;
    const startX = (canvas.width - size) / 2;
    const startY = (canvas.height - size) / 2;
    
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 3;
    ctx.strokeRect(startX, startY, size, size);

    const step = size / 3;
    
    // Draw lines
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
        // Vertical
        ctx.moveTo(startX + step * i, startY);
        ctx.lineTo(startX + step * i, startY + size);
        // Horizontal
        ctx.moveTo(startX, startY + step * i);
        ctx.lineTo(startX + size, startY + step * i);
    }
    ctx.stroke();
}

// ==========================================
// 2. VISION & COLOR DETECTION
// ==========================================

function captureFace() {
    if (!openCvReady) return alert("OpenCV is still loading...");

    // 1. Capture the current frame to a hidden canvas for reading
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);

    // 2. Calculate grid positions
    const size = Math.min(tempCanvas.width, tempCanvas.height) * 0.6;
    const startX = (tempCanvas.width - size) / 2;
    const startY = (tempCanvas.height - size) / 2;
    const cellSize = size / 3;

    let detectedColors = [];

    // 3. Loop through 9 squares
    // Reading Order: Top-Left to Bottom-Right
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            // Sample the center pixel of the cell
            const x = Math.floor(startX + (col * cellSize) + (cellSize / 2));
            const y = Math.floor(startY + (row * cellSize) + (cellSize / 2));
            
            const pixel = tempCtx.getImageData(x, y, 1, 1).data;
            const r = pixel[0];
            const g = pixel[1];
            const b = pixel[2];

            const colorCode = classifyColor(r, g, b);
            detectedColors.push(colorCode);
        }
    }

    // 4. Save to state
    const currentFaceName = captureOrder[currentFaceIndex];
    cubeState[currentFaceName] = detectedColors;
    
    console.log(`Scanned ${currentFaceName}:`, detectedColors);

    // 5. Progress to next face
    currentFaceIndex++;
    if (currentFaceIndex < 6) {
        updateInstruction();
    } else {
        startSolving();
    }
}

// Basic Euclidean Distance Color Classifier
// TIP: For better results, convert RGB to HSV color space.
function classifyColor(r, g, b) {
    const palette = {
        'U': [255, 255, 255], // White
        'D': [255, 255, 0],   // Yellow
        'F': [0, 255, 0],     // Green
        'B': [0, 0, 255],     // Blue
        'R': [255, 0, 0],     // Red
        'L': [255, 100, 0]    // Orange (Tweaked RGB)
    };

    let minDistance = Infinity;
    let result = 'U';

    Object.keys(palette).forEach(face => {
        const target = palette[face];
        // Calculate distance between scanned pixel and target color
        const dist = Math.sqrt(
            Math.pow(target[0] - r, 2) +
            Math.pow(target[1] - g, 2) +
            Math.pow(target[2] - b, 2)
        );

        if (dist < minDistance) {
            minDistance = dist;
            result = face;
        }
    });

    return result;
}

function updateInstruction() {
    const faceName = captureOrder[currentFaceIndex];
    const colorMap = {
        'U': 'WHITE (Up)',
        'R': 'RED (Right)',
        'F': 'GREEN (Front)',
        'D': 'YELLOW (Down)',
        'L': 'ORANGE (Left)',
        'B': 'BLUE (Back)'
    };
    document.getElementById('instruction-text').innerText = 
        `Step ${currentFaceIndex + 1}/6: Align Center with ${colorMap[faceName]}`;
}

// ==========================================
// 3. SOLVER WORKER INTEGRATION
// ==========================================

function startSolving() {
    isScanning = false;
    document.getElementById('instruction-text').innerText = "Analyzing Cube...";
    document.getElementById('capture-btn').disabled = true;

    // Convert state object to the string format required by Kociemba
    // Format: UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB
    let faceStr = '';
    captureOrder.forEach(face => {
        faceStr += cubeState[face].join('');
    });

    console.log("Sending string to worker:", faceStr);

    // Initialize Worker
    const worker = new Worker('solver-worker.js');
    
    worker.postMessage(faceStr);

    worker.onmessage = function(e) {
        if (e.data.success) {
            console.log("Solution found:", e.data.solution);
            // Transition to 3D View
            launch3DView(e.data.solution);
            worker.terminate();
        } else {
            alert("Error: " + e.data.error + "\n\nUsually means the cube was scanned incorrectly. Reloading...");
            location.reload();
        }
    };
}

// ==========================================
// 4. 3D VISUALIZATION (Three.js)
// ==========================================

function launch3DView(solutionString) {
    // Hide Camera UI, Show 3D UI
    document.getElementById('scan-ui').classList.remove('active');
    document.getElementById('scan-ui').classList.add('hidden');
    document.getElementById('solve-ui').classList.remove('hidden');

    // Parse moves
    const moves = solutionString.split(' ').filter(m => m.length > 0);
    let currentStep = 0;

    // --- Three.js Setup ---
    const container = document.getElementById('3d-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3, 3, 5); // Angle the camera
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // --- Build the Cube ---
    // A Rubik's cube is made of 27 smaller cubes (3x3x3)
    const cubeGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9); // Slightly smaller than 1 to show gaps

    // Helper to map our Face Letters to Hex Colors
    const getColorHex = (letter) => {
        const map = {
            'U': 0xFFFFFF, // White
            'D': 0xFFFF00, // Yellow
            'F': 0x00FF00, // Green
            'B': 0x0000FF, // Blue
            'R': 0xFF0000, // Red
            'L': 0xFF8800  // Orange
        };
        return map[letter] || 0x000000;
    };

    // Construct the 27 cubies
    // We loop x, y, z from -1 to 1
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                // Create material array for 6 sides of the cubie
                // Order: Right, Left, Top, Bottom, Front, Back
                const materials = [
                    new THREE.MeshBasicMaterial({ color: 0x111111 }), // Right (default black)
                    new THREE.MeshBasicMaterial({ color: 0x111111 }), // Left
                    new THREE.MeshBasicMaterial({ color: 0x111111 }), // Top
                    new THREE.MeshBasicMaterial({ color: 0x111111 }), // Bottom
                    new THREE.MeshBasicMaterial({ color: 0x111111 }), // Front
                    new THREE.MeshBasicMaterial({ color: 0x111111 })  // Back
                ];

                // Apply Colors only to outer faces (Paint the stickers)
                // This is a simplified mapping. For a true replica, you map `cubeState` arrays here.
                if (x === 1) materials[0].color.setHex(getColorHex('R'));
                if (x === -1) materials[1].color.setHex(getColorHex('L'));
                if (y === 1) materials[2].color.setHex(getColorHex('U'));
                if (y === -1) materials[3].color.setHex(getColorHex('D'));
                if (z === 1) materials[4].color.setHex(getColorHex('F'));
                if (z === -1) materials[5].color.setHex(getColorHex('B'));

                const mesh = new THREE.Mesh(geometry, materials);
                mesh.position.set(x, y, z);
                cubeGroup.add(mesh);
            }
        }
    }
    scene.add(cubeGroup);

    // --- Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);
        // Slowly rotate the whole cube so user can see it 3D
        cubeGroup.rotation.y += 0.005;
        renderer.render(scene, camera);
    }
    animate();

    // --- UI Controls ---
    const moveText = document.getElementById('move-text');
    
    document.getElementById('next-step').addEventListener('click', () => {
        if (currentStep < moves.length) {
            const move = moves[currentStep];
            moveText.innerText = `Move: ${move}`;
            
            // NOTE: Implementing true robotic rotation logic (grouping specific meshes, 
            // rotating them, and ungrouping) is extremely complex for one file.
            // For this version, we display the move to the user clearly.
            
            currentStep++;
        } else {
            moveText.innerText = "SOLVED!";
        }
    });

    document.getElementById('prev-step').addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            moveText.innerText = `Move: ${moves[currentStep -1] || "Start"}`;
        }
    });
}
