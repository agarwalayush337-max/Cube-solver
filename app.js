let video, canvas, ctx;
let openCvReady = false;
let cubeState = { U: [], R: [], F: [], D: [], L: [], B: [] };
let captureOrder = ['U', 'R', 'F', 'D', 'L', 'B']; // Standard scanning order
let currentFaceIndex = 0;

function onOpenCvReady() {
    openCvReady = true;
    startCamera();
}

async function startCamera() {
    video = document.getElementById('camera-feed');
    canvas = document.getElementById('overlay-canvas');
    ctx = canvas.getContext('2d');

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;

    document.getElementById('capture-btn').addEventListener('click', captureFace);
}

// ---------------------------------------------------------
// VISION: Capture & Color Analysis
// ---------------------------------------------------------
function captureFace() {
    if (!openCvReady) return alert("OpenCV loading...");

    // Draw video frame to canvas to read pixels
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Calculate grid coordinates (Assuming center of screen)
    const size = 300; // Match CSS grid size
    const startX = (canvas.width - size) / 2;
    const startY = (canvas.height - size) / 2;
    const cellSize = size / 3;

    let faceColors = [];

    // Loop through 3x3 grid
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            // Sample center of each cell
            const x = startX + (col * cellSize) + (cellSize / 2);
            const y = startY + (row * cellSize) + (cellSize / 2);
            
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const colorCode = classifyColor(pixel[0], pixel[1], pixel[2]);
            faceColors.push(colorCode);
        }
    }

    // Save to state
    const currentFace = captureOrder[currentFaceIndex];
    cubeState[currentFace] = faceColors;
    console.log(`Captured ${currentFace}:`, faceColors);

    // Next Step
    currentFaceIndex++;
    if (currentFaceIndex < 6) {
        document.getElementById('instruction-text').innerText = `Align center color: ${getCenterColorName(currentFaceIndex)}`;
    } else {
        startSolving();
    }
}

// Simple RGB Distance Classifier (Enhance this with HSV for better results)
function classifyColor(r, g, b) {
    // Map standard cube colors (approximate RGB values)
    const palette = {
        'U': [255, 255, 255], // White
        'D': [255, 255, 0],   // Yellow
        'F': [0, 255, 0],     // Green
        'B': [0, 0, 255],     // Blue
        'R': [255, 0, 0],     // Red
        'L': [255, 165, 0]    // Orange
    };

    let minDist = Infinity;
    let closestLabel = 'U';

    for (let label in palette) {
        const [tr, tg, tb] = palette[label];
        const dist = Math.sqrt((r-tr)**2 + (g-tg)**2 + (b-tb)**2);
        if (dist < minDist) {
            minDist = dist;
            closestLabel = label;
        }
    }
    return closestLabel;
}

function getCenterColorName(index) {
    const names = ['WHITE (Up)', 'RED (Right)', 'GREEN (Front)', 'YELLOW (Down)', 'ORANGE (Left)', 'BLUE (Back)'];
    return names[index];
}

// ---------------------------------------------------------
// SOLVER: Kociemba Algorithm Interface
// ---------------------------------------------------------
function startSolving() {
    // 1. Convert captured arrays to single string
    // Order required by library: U1...U9 R1...R9 F1...F9 D1...D9 L1...L9 B1...B9
    let faceStr = '';
    captureOrder.forEach(face => {
        faceStr += cubeState[face].join('');
    });

    console.log("Solving for state:", faceStr);

    // Initialize Cube.js
    const solver = new Cube();
    try {
        const solution = solver.solve(Cube.fromString(faceStr));
        console.log("Solution:", solution);
        
        // Switch UI
        document.getElementById('scan-ui').classList.remove('active');
        document.getElementById('scan-ui').classList.add('hidden');
        document.getElementById('solve-ui').classList.remove('hidden');
        
        init3DScene(solution);
    } catch (e) {
        alert("Scan Error: Cube state is invalid. Please rescan carefully.");
        location.reload();
    }
}

// ---------------------------------------------------------
// 3D RENDER: Three.js (Simplified)
// ---------------------------------------------------------
function init3DScene(solutionMoves) {
    // Setup Scene, Camera, Renderer
    const container = document.getElementById('3d-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;
    camera.position.y = 3;
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Create a simple 3x3x3 Cube Group
    const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    const material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, vertexColors: true });
    
    // In a real app, you would color faces individually here based on cubeState
    // For this demo, we render a static "Solved" looking block
    const group = new THREE.Group();
    
    for(let x=-1; x<=1; x++) {
        for(let y=-1; y<=1; y++) {
            for(let z=-1; z<=1; z++) {
                const cube = new THREE.Mesh(geometry, new THREE.MeshNormalMaterial());
                cube.position.set(x, y, z);
                group.add(cube);
            }
        }
    }
    scene.add(group);

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();
    
    // Display Moves
    const moves = solutionMoves.split(' ');
    let step = 0;
    const moveText = document.getElementById('move-text');
    
    document.getElementById('next-step').addEventListener('click', () => {
        if(step < moves.length) {
            moveText.innerText = `Move: ${moves[step]}`;
            // Here you would trigger the rotation animation for the specific group
            step++;
        } else {
            moveText.innerText = "Solved!";
        }
    });
}
