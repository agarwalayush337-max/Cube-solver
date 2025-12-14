// script.js

const outputDiv = document.getElementById('output');
const solveBtn = document.getElementById('solveBtn');

// 1. Create the Worker
const solverWorker = new Worker('worker.js');

// 2. Listen for responses from the Worker
solverWorker.onmessage = function(event) {
    const data = event.data;

    if (data.error) {
        outputDiv.innerHTML += `<div class="error">Error: ${data.error}</div>`;
        solveBtn.disabled = false; // Re-enable button
    } 
    else if (data.success) {
        outputDiv.innerHTML += `<div class="success">Solution Found: ${data.solution}</div>`;
        console.log("Moves:", data.solution);
        solveBtn.disabled = false; // Re-enable button
    }
};

// 3. Handle Button Click
solveBtn.addEventListener('click', () => {
    // The specific state from your error log
    const cubeState = "LLLUUUUUURRURRURRUFFFFFFFFFDDDDDDRRRDLLDLLDLLBBBBBBBBB";
    
    outputDiv.innerHTML = "Status: Solving... (Check Console)";
    solveBtn.disabled = true; // Disable button while working
    
    // Send data to worker
    solverWorker.postMessage(cubeState);
});
