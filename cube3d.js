let scene, camera, renderer;
let cubelets = [];

initCube();

function initCube() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas: cubeCanvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight * 0.6);

  const colors = {
    U: 0xffffff,
    D: 0xffff00,
    F: 0x00ff00,
    B: 0x0000ff,
    R: 0xff0000,
    L: 0xffa500
  };

  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        const geo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
        const mats = Object.values(colors).map(c => new THREE.MeshBasicMaterial({ color: c }));
        const cube = new THREE.Mesh(geo, mats);
        cube.position.set(x, y, z);
        scene.add(cube);
        cubelets.push(cube);
      }

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
