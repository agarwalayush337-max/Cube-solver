importScripts('./solver.js');

console.log('WORKER BOOTED');

let engineReady = false;

try {
    if (typeof min2phase === 'undefined') {
        throw new Error('min2phase not loaded');
    }

    console.log('Initializing Min2Phase…');

    // ✅ REAL Min2Phase init (SYNC, NO RETURN VALUE)
    min2phase.initFull();

    engineReady = true;

    console.log('ENGINE READY');
    postMessage({ type: 'ready' });

} catch (e) {
    console.error('INIT ERROR', e);
    postMessage({
        type: 'error',
        message: e.message
    });
}

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
                solution
            });
        } catch (err) {
            postMessage({
                type: 'error',
                message: err.toString()
            });
        }
    }
};
