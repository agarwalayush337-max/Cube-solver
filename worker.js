// worker.js

// 1. Load the FULL CubeJS library from a CDN
// This version includes the solver engine.
importScripts('https://unpkg.com/cubejs@1.3.2/lib/cube.js');

let isSolverReady = false;

// 2. Initialize the Solver immediately
try {
    if (typeof Cube !== 'undefined') {
        // This calculates the move tables. It takes a moment.
        Cube.initSolver();
        isSolverReady = true;
        console.log("Worker: Solver initialized and ready.");
    } else {
        console.error("Worker: Cube library failed to load.");
    }
} catch (e) {
    console.error("Worker: Initialization error", e);
}

// 3. Listen for the 'solve' command
self.onmessage = function(e) {
    // We expect the message data to be the state string
    const stateString = e.data;

    if (!isSolverReady) {
        self.postMessage({ error: "Solver is still initializing... please wait a moment." });
        return;
    }

    try {
        // Create cube instance
        const cube = Cube.fromString(stateString);
        
        // Solve it
        const result = cube.solve();
        
        // Send back the result
        self.postMessage({ success: true, solution: result });

    } catch (err) {
        self.postMessage({ error: "Calculation Failed: " + err.message });
    }
};
