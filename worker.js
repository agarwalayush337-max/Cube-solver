// worker.js
importScripts('solver.js'); 

let isReady = false;

// 1. Initialize the Fast Engine (min2phase)
try {
    if (typeof min2phase !== 'undefined') {
        // This builds the lookup tables (approx 0.1s)
        min2phase.initTables();
        isReady = true;
        self.postMessage({ type: 'status', text: 'ready' });
    } else {
        throw new Error("min2phase library not found in solver.js");
    }
} catch (e) {
    self.postMessage({ type: 'error', message: "Init failed: " + e.message });
}

// 2. Listen for Solve Request
self.onmessage = function(e) {
    const stateString = e.data;

    if (!isReady) {
        self.postMessage({ type: 'error', message: 'Engine loading...' });
        return;
    }

    try {
        // Basic validation: 9 stickers of each color
        const counts = {};
        for (let char of stateString) counts[char] = (counts[char] || 0) + 1;
        for (let c of ['U','R','F','D','L','B']) {
            if (counts[c] !== 9) throw new Error(`Invalid Cube! Found ${counts[c] || 0} '${c}' stickers. Must be 9.`);
        }

        // Run the Solver
        // solution(facelets, maxDepth, probeMax, probeMin, verbose)
        const search = new min2phase.Search();
        const result = search.solution(stateString, 21, 100000000, 0, 0);

        // Check results
        if (!result && result !== "") {
             // If result is null/false, it's unsolvable
             self.postMessage({ type: 'error', message: 'Unsolvable State. Check your colors.' });
        } else {
             // Returns a string like "R2 U F'..."
             // If string is empty "", it is already solved.
             self.postMessage({ type: 'solution', solution: result });
        }

    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};
