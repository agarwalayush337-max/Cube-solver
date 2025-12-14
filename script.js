// =====================================================
// PART 1: WORKER SETUP (The "Brain" of the Solver)
// =====================================================

// Initialize the worker thread
const solverWorker = new Worker('worker.js');
let isSolverReady = false;

// Listen for messages from the Worker
solverWorker.onmessage = function(event) {
    const data = event.data;

    // Case A: Worker is ready to solve
    if (data.status === 'ready') {
        console.log("✅ Worker: Solver engine is ready!");
        isSolverReady = true;
        
        // Update UI if you have a status element
        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.textContent = "System Ready. Click Solve.";
    } 
    
    // Case B: Solution Found
    else if (data.success) {
        console.log("🎉 Solution Found:", data.solution);
        
        // Display solution on screen
        const outputEl = document.getElementById('output') || document.getElementById('solution-text');
        if (outputEl) {
            outputEl.innerText = "Solution: " + data.solution;
            outputEl.style.color = "green";
        } else {
            alert("Solution: " + data.solution);
        }

        // TODO: IF you have a 3D function, call it here!
        // animateCube(data.solution);
    } 
    
    // Case C: Error
    else if (data.error) {
        console.error("❌ Worker Error:", data.error);
        alert("Error: " + data.error);
    }
};

// =====================================================
// PART 2: USER INTERACTION (Button Clicks)
// =====================================================

// Wait for the page to load
document.addEventListener('DOMContentLoaded', () => {

    const solveBtn = document.getElementById('solveBtn'); // Ensure your button has id="solveBtn"

    if (solveBtn) {
        solveBtn.addEventListener('click', () => {
            handleSolveClick();
        });
    } else {
        console.warn("⚠️ Warning: No button with id='solveBtn' found in index.html");
    }

});

// Function to handle the solve request
function handleSolveClick() {
    if (!isSolverReady) {
        alert("⚠️ Please wait, solver is still loading...");
        return;
    }

    // 1. GET THE CUBE STATE
    // IMPORTANT: If you lost your 3D code, we must use a test string.
    // If you have your 3D code, replace the string below with a function like getCubeState()
    
    // Test String (Scrambled State)
    const cubeState = "LLLUUUUUURRURRURRUFFFFFFFFFDDDDDDRRRDLLDLLDLLBBBBBBBBB";
    
    console.log("Sending state to worker:", cubeState);
    
    // 2. SEND TO WORKER
    solverWorker.postMessage(cubeState);
}
