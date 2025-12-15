importScripts('./solver.js');

let engineReady = false;

// STEP 1: incremental init loop
function initEngine() {
  // initFull() does NOT finish in one call
  const done = min2phase.initFull();

  if (done === true) {
    engineReady = true;
    postMessage({ type: 'ready' });
  } else {
    // keep initializing without blocking
    postMessage({ type: 'status', message: 'Loading engine…' });
    setTimeout(initEngine, 0);
  }
}

// STEP 2: start initialization
try {
  if (typeof min2phase === 'undefined') {
    throw new Error('min2phase not loaded');
  }
  initEngine();
} catch (e) {
  postMessage({ type: 'error', message: e.message });
}

// STEP 3: handle solve requests
onmessage = function (e) {
  if (!engineReady) {
    postMessage({ type: 'status', message: 'Engine loading…' });
    return;
  }

  if (e.data.type === 'solve') {
    try {
      const solution = min2phase.solve(e.data.cube);
      postMessage({ type: 'solution', solution });
    } catch (err) {
      postMessage({ type: 'error', message: err.toString() });
    }
  }
};
