/***********************
 * INIT SOLVER (ONCE)
 ***********************/
Cube.initSolver();

/***********************
 * SOLVE BUTTON
 ***********************/
function solveCube() {
  const input = document
    .getElementById("cubeInput")
    .value
    .toUpperCase()
    .replace(/[^URFDLB]/g, "");

  console.log("INPUT:", input, input.length);

  if (input.length !== 54) {
    alert("Cube string must be exactly 54 characters");
    return;
  }

  try {
    const solution = Cube.solve(input);

    document.getElementById("solution").innerText =
      solution === "" ? "Already solved" : solution;

  } catch (e) {
    console.error(e);
    alert("Invalid cube state");
  }
}

