// worker.js
// Load the solver library we saved earlier
importScripts('solver.js');

let isReady = false;

// 1. Initialize the Brain immediately
if (typeof Cube !== 'undefined') {
    Cube.initSolver(); // This is the slow part! We do it here.
    isReady = true;
    self.postMessage({ type: 'status', text: 'Ready' });
}

// 2. Listen for "Solve" commands
self.onmessage = function(e) {
    const stateString = e.data;

    if (!isReady) {
        self.postMessage({ type: 'error', message: 'System is still warming up. Wait 2 seconds.' });
        return;
    }

    try {
        // Validate Color Counts first (Fail Fast)
        const counts = {};
        for (let char of stateString) counts[char] = (counts[char] || 0) + 1;
        
        // Basic check: Each color must appear 9 times
        for (let c of ['U','R','F','D','L','B']) {
            if (counts[c] !== 9) {
                throw new Error(`Invalid Cube! Found ${counts[c] || 0} '${c}' stickers. Must be exactly 9.`);
            }
        }

        // Run Solver
        const cube = Cube.fromString(stateString);
        const result = cube.solve(); // This is usually instant now

        self.postMessage({ type: 'solution', solution: result });

    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};
