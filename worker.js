importScripts('./solver.js');

let engineReady = false;

/**
 * Incremental initialization loop
 * min2phase.initFull() MUST be called repeatedly
 * until it returns true
 */
function initEngine() {
    try {
        const done = min2phase.initFull();

        if (done === true) {
            engineReady = true;

            // 🔥 THIS MESSAGE UNBLOCKS YOUR UI
            postMessage({ type: 'ready' });
        } else {
            // Still loading tables
            postMessage({
                type: 'status',
                message: 'Loading engine…'
            });

            // Yield control, continue init
            setTimeout(initEngine, 0);
        }
    } catch (e) {
        postMessage({
            type: 'error',
            message: e.message
        });
    }
}

// Start initialization immediately
if (typeof min2phase === 'undefined') {
    postMessage({
        type: 'error',
        message: 'min2phase not loaded'
    });
} else {
    initEngine();
}

// Handle solve requests
onmessage = function (e) {
    if (!engineReady) {
        postMessage({
            type: 'status',
            message: 'Engine loading…'
        });
        return;
    }

    if (e.data && e.data.type === 'solve') {
        try {
            const solution = min2phase.solve(e.data.cube);

            postMessage({
                type: 'solution',
                solution: solution
            });
        } catch (err) {
            postMessage({
                type: 'error',
                message: err.toString()
            });
        }
    }
};
