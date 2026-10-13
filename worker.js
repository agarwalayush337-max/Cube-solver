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
            // First solution (≤21 moves, a few ms), then keep asking for a
            // shorter one with a small search budget each time. Typically
            // ends at ~19 moves in well under a second.
            let solution = min2phase.solve(e.data.cube);
            const len = s => s.trim() ? s.trim().split(/\s+/).length : 0;
            if (!solution.startsWith("Error")) {
                const t0 = Date.now();
                while (len(solution) > 0 && Date.now() - t0 < 2500) {
                    const shorter = new min2phase.Search().solution(e.data.cube, len(solution) - 1, 5000, 0, 0);
                    if (shorter.startsWith("Error")) break;
                    solution = shorter;
                }
            }
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
