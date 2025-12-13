// solver-worker.js

// Load the Cube library inside the worker thread
importScripts('https://cdn.jsdelivr.net/npm/cubejs@1.3.2/lib/cube.min.js');

// Listen for the "Start" message from the main app
self.onmessage = function(e) {
    const faceString = e.data;
    
    console.log("Worker: Starting calculation for", faceString);

    try {
        // Initialize the solver (this is the heavy part that freezes UI)
        // Note: The first time this runs, it builds huge lookup tables
        Cube.initSolver(); 
        
        const solver = new Cube();
        const solution = solver.solve(Cube.fromString(faceString));
        
        // Send the solution string back to the main app
        self.postMessage({ success: true, solution: solution });
        
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};
