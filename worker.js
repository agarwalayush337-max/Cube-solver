// worker.js (Updated)
importScripts('https://unpkg.com/cubejs@1.3.2/lib/cube.js');

let isSolverReady = false;

// Initialize Solver
try {
    if (typeof Cube !== 'undefined') {
        Cube.initSolver(); // This takes time (2-5 seconds)
        isSolverReady = true;
        
        // NEW: Tell the main thread we are ready
        self.postMessage({ status: 'ready' }); 
    }
} catch (e) {
    console.error("Worker Init Error", e);
}

self.onmessage = function(e) {
    const stateString = e.data;

    if (!isSolverReady) {
        self.postMessage({ error: "Solver is still initializing..." });
        return;
    }

    try {
        const cube = Cube.fromString(stateString);
        const result = cube.solve();
        self.postMessage({ success: true, solution: result });
    } catch (err) {
        self.postMessage({ error: "Solve failed: " + err.message });
    }
};
