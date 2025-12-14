// worker.js

// 1. FORCE load the FULL version from the web (contains the Solver)
importScripts('https://unpkg.com/cubejs@1.3.2/lib/cube.js');

let isSolverReady = false;

// 2. Initialize the Solver
try {
    // Check if the function exists before calling it
    if (typeof Cube !== 'undefined' && typeof Cube.initSolver === 'function') {
        console.log("Worker: Building solver tables (this takes 2-5s)...");
        Cube.initSolver(); 
        isSolverReady = true;
        self.postMessage({ status: 'ready' }); // Tell script.js we are ready
    } else {
        // This log will appear if you somehow still have the Lite version
        console.error("Worker Error: Loaded 'Cube', but 'initSolver' is missing. You are using the Lite version!");
    }
} catch (e) {
    console.error("Worker Initialization Error:", e);
}

// 3. Handle the Solve Command
self.onmessage = function(e) {
    const stateString = e.data;

    if (!isSolverReady) {
        self.postMessage({ error: "Solver is still initializing... please wait." });
        return;
    }

    try {
        // Create a new Cube object from the string
        const cube = Cube.fromString(stateString);
        
        // Solve it
        const solution = cube.solve();
        
        self.postMessage({ success: true, solution: solution });
    } catch (err) {
        self.postMessage({ error: "Solve failed: " + err.message });
    }
};
