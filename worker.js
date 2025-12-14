// worker.js
importScripts('solver.js'); 

let isReady = false;

// 1. Initialize the Fast Engine
try {
    // min2phase.initTables() is very fast
    min2phase.initTables();
    isReady = true;
    self.postMessage({ type: 'status', text: 'ready' });
} catch (e) {
    self.postMessage({ type: 'error', message: "Init failed: " + e });
}

// 2. Listen for Solve Request
self.onmessage = function(e) {
    const stateString = e.data;

    if (!isReady) {
        self.postMessage({ type: 'error', message: 'Engine not ready yet.' });
        return;
    }

    try {
        // Validate Color Counts (9 of each)
        const counts = {};
        for (let char of stateString) counts[char] = (counts[char] || 0) + 1;
        for (let c of ['U','R','F','D','L','B']) {
            if (counts[c] !== 9) throw new Error(`Invalid Cube! Found ${counts[c] || 0} '${c}' stickers. Must be 9.`);
        }

        // SOLVE!
        // min2phase returns a string immediately
        const search = new min2phase.Search();
        
        // Arguments: state, maxDepth, probeMax, probeMin, verbose
        const solution = search.solution(stateString, 21, 100000000, 0, 0);

        if (!solution) {
            // Check if it's already solved
             if(stateString === "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB") {
                 self.postMessage({ type: 'solution', solution: "" }); // Empty string = solved
             } else {
                 self.postMessage({ type: 'error', message: 'Unsolvable State. Check your colors.' });
             }
        } else {
            self.postMessage({ type: 'solution', solution: solution });
        }

    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};
