// worker.js
// 1. Load the library
importScripts('solver.js');

// 2. Start Initialization IMMEDIATELY
// This calculation takes time (30s - 3mins on mobile)
// We do it here so the main screen doesn't freeze.
let isReady = false;

try {
    if (typeof cubeSolver !== 'undefined') {
        // Initialize the Kociemba algorithm tables
        cubeSolver.initialize('kociemba'); 
        isReady = true;
        
        // Notify the main page that we are ready
        self.postMessage({ type: 'status', text: 'ready' });
    }
} catch (e) {
    self.postMessage({ type: 'error', message: "Init failed: " + e.message });
}

// 3. Listen for "Solve" commands
self.onmessage = function(e) {
    const stateString = e.data;

    if (!isReady) {
        self.postMessage({ type: 'error', message: 'Engine is still warming up! Please wait 30 seconds and try again.' });
        return;
    }

    try {
        // The solver is already initialized, so this should be FAST now (0.1s)
        const result = cubeSolver.solve(stateString, 'kociemba');
        
        if (result === null) {
            self.postMessage({ type: 'error', message: 'Unsolvable State. Check your colors.' });
        } else {
            self.postMessage({ type: 'solution', solution: result });
        }

    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};
