let currentMove = 0;
let moves = [];

function executeMove(move) {
  // Placeholder: rotate layer based on move
  // (R, R', U, U', etc.)
  console.log("Executing", move);
}

function nextMove() {
  if (currentMove < moves.length) {
    executeMove(moves[currentMove]);
    currentMove++;
  }
}

function prevMove() {
  if (currentMove > 0) {
    currentMove--;
  }
}

function play() {
  const interval = setInterval(() => {
    if (currentMove >= moves.length) {
      clearInterval(interval);
      return;
    }
    nextMove();
  }, 600);
}
