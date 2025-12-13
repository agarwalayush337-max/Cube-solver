let solverReady = false;

Cube.initSolver(() => {
  solverReady = true;
  console.log("Cube solver ready");
});


function solve() {
  if (!solverReady) {
    alert("Solver is still initializing. Please wait 1 second.");
    return;
  }

  const cubeStr = document.getElementById("cubeInput").value.trim();

  if (cubeStr.length !== 54) {
    alert("Cube string must be exactly 54 characters");
    return;
  }

  try {
    const cube = Cube.fromString(cubeStr);
    const solution = cube.solve();

    document.getElementById("solution").innerText =
      solution || "(Already Solved)";

    moves = solution ? solution.split(" ") : [];
    currentMove = 0;
  } catch (e) {
    alert("Invalid cube");
    console.error(e);
  }
}
