// worker.js - Runs locally
importScripts('cube.js'); 

let isReady = false;

// Initialize
try {
    if (typeof Cube !== 'undefined') {
        Cube.initSolver(); // Heavy calculation
        isReady = true;
        self.postMessage({ type: 'ready' });
    }
} catch (e) { console.error(e); }

self.onmessage = function(e) {
    const data = e.data;
    
    if (data.type === 'solve') {
        if (!isReady) {
            self.postMessage({ type: 'error', message: "Solver loading... wait 3s" });
            return;
        }
        try {
            const cube = Cube.fromString(data.state);
            const solution = cube.solve();
            self.postMessage({ type: 'solution', moves: solution });
        } catch (err) {
            self.postMessage({ type: 'error', message: "Invalid colors! Check cube." });
        }
    }
};
