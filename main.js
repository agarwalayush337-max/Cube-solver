/***********************
 * SOLVER INITIALIZATION
 ***********************/
Cube.initSolver(); // synchronous – must be called once

/***********************
 * SOLVE BUTTON LOGIC
 ***********************/
function solveCube() {
  const input = document.getElementById("cubeInput").value.trim();

  if (!isValidInput(input)) {
    alert("Cube must contain exactly 9 of each: U R F D L B");
    return;
  }

  try {
    const cube = Cube.fromString(input);
    const solution = cube.solve();

    document.getElementById("solution").innerText =
      solution === "" ? "Already solved" : solution;
  } catch (e) {
    alert("Invalid cube state");
    console.error(e);
  }
}

/***********************
 * INPUT VALIDATION
 ***********************/
function isValidInput(str) {
  if (str.length !== 54) return false;

  const count = {};
  for (let c of str) count[c] = (count[c] || 0) + 1;

  return ["U", "R", "F", "D", "L", "B"].every(
    f => count[f] === 9
  );
}

/***********************
 * BASIC 3D CUBE
 ***********************/
let scene, camera, renderer;

init3D();
animate();

function init3D() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / (window.innerHeight * 0.55),
    0.1,
    100
  );
  camera.position.set(4, 4, 4);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("cubeCanvas"),
    antialias: true
  });

  renderer.setSize(window.innerWidth, window.innerHeight * 0.55);

  const colors = [
    0xffffff, // U
    0xffff00, // D
    0x00ff00, // F
    0x0000ff, // B
    0xff0000, // R
    0xffa500  // L
  ];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
        const mats = colors.map(c => new THREE.MeshBasicMaterial({ color: c }));
        const cube = new THREE.Mesh(geo, mats);
        cube.position.set(x, y, z);
        scene.add(cube);
      }
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  scene.rotation.y += 0.005;
  renderer.render(scene, camera);
}
