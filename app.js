// UPDATED startSolving function for app.js

function startSolving() {
    // 1. Convert captured arrays to single string
    let faceStr = '';
    captureOrder.forEach(face => {
        faceStr += cubeState[face].join('');
    });

    console.log("Sending to worker:", faceStr);
    
    // Show a "Thinking..." loading state to the user
    document.getElementById('instruction-text').innerText = "Calculating Solution...";

    // 2. Initialize the Worker
    const worker = new Worker('solver-worker.js');

    // 3. Send data to worker
    worker.postMessage(faceStr);

    // 4. Listen for the result
    worker.onmessage = function(e) {
        if (e.data.success) {
            console.log("Solution found:", e.data.solution);
            
            // Switch UI to 3D mode
            document.getElementById('scan-ui').classList.remove('active');
            document.getElementById('scan-ui').classList.add('hidden');
            document.getElementById('solve-ui').classList.remove('hidden');
            
            // Pass solution to the 3D renderer
            init3DScene(e.data.solution);
            
            // Terminate worker to save battery
            worker.terminate();
        } else {
            alert("Solver Error: " + e.data.error);
            // Optional: reset logic here
        }
    };
    
    worker.onerror = function(error) {
        console.error('Worker error:', error);
        alert("Computation Error. Try scanning again.");
    };
}
