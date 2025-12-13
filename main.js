function solve() {
  const cube = cubeInput.value.trim();

  if (cube.length !== 54) {
    alert("Invalid cube string");
    return;
  }

  try {
    const result = min2phase.solve(cube);
    document.getElementById("solution").innerText = result;
    moves = result.split(" ");
    currentMove = 0;
  } catch {
    alert("Invalid cube");
  }
}
