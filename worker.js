importScripts('./solver.js');

console.log('WORKER BOOTED');
console.log('min2phase =', typeof min2phase);

let engineReady = false;

function initEngine() {
    console.log('initEngine tick');

    try {
        const done = min2phase.initFull();
        console.log('initFull returned:', done);

        if (done === true) {
            console.log('ENGINE READY');
            engineReady = true;
            postMessage({ type: 'ready' });
        } else {
            setTimeout(initEngine, 0);
        }
    } catch (e) {
        console.error('INIT ERROR', e);
        postMessage({ type: 'error', message: e.message });
    }
}

if (typeof min2phase === 'undefined') {
    console.error('❌ min2phase is undefined');
} else {
    console.log('✅ min2phase loaded');
    initEngine();
}

onmessage = function (e) {
    console.log('WORKER RECEIVED:', e.data);
};
