importScripts('./solver.js');

let engineReady = false;

try {
  if (typeof min2phase === 'undefined') {
    throw new Error('min2phase not found');
  }

  // REAL Min2Phase initialization
  min2phase.initFull();

  engineReady = true;
  postMessage({ type: 'ready' });

} catch (e) {
  postMessage({
    type: 'error',
    message: e.message
  });
}

onmessage = function (e) {
  if (!engineReady) {
    postMessage({ type: 'status', message: 'Engine loading…' });
    return;
  }

  const cube = e.data.cube;
  try {
    const solution = min2phase.solve(cube);
    postMessage({ type: 'solution', solution });
  } catch (err) {
    postMessage({ type: 'error', message: err.toString() });
  }
};
