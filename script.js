const COLS = 10;
const ROWS = 20;
const CELL = 30;

const COLORS = {
  I: "#4dd0e1",
  O: "#ffd54f",
  T: "#ba68c8",
  S: "#81c784",
  Z: "#e57373",
  J: "#64b5f6",
  L: "#ffb74d",
};

const SHAPES = {
  I: [[0,1],[1,1],[2,1],[3,1]],
  O: [[1,0],[2,0],[1,1],[2,1]],
  T: [[1,0],[0,1],[1,1],[2,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
  J: [[0,0],[0,1],[1,1],[2,1]],
  L: [[2,0],[0,1],[1,1],[2,1]],
};

const PIECE_NAMES = Object.keys(SHAPES);

// NES-style gravity curve: frames per row drop, at 60fps, by level.
const FRAMES_PER_ROW = [48,43,38,33,28,23,18,13,8,6,5,5,5,4,4,4,3,3,3,2];
function framesForLevel(level) {
  if (level >= FRAMES_PER_ROW.length) return 1;
  return FRAMES_PER_ROW[level];
}

const boardCanvas = document.getElementById("board");
const ctx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");

let grid, current, next, lastPieceName;
let score, level, linesCleared;
let dropCounter, frameCount;
let running, paused, gameOver;
let softDrop;
let rafId;

function emptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPieceName() {
  let name = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
  if (name === lastPieceName) {
    name = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
  }
  lastPieceName = name;
  return name;
}

function spawnPiece(name) {
  const cells = SHAPES[name].map(([x, y]) => ({ x, y }));
  const startX = name === "O" ? 4 : 3;
  return {
    name,
    cells: cells.map((c) => ({ x: c.x + (startX - 1), y: c.y })),
  };
}

function collides(cells) {
  return cells.some(({ x, y }) => {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y < 0) return false;
    return grid[y][x] !== null;
  });
}

function rotate(piece) {
  if (piece.name === "O") return piece.cells;
  const pivot = piece.cells[1];
  return piece.cells.map(({ x, y }) => {
    const relX = x - pivot.x;
    const relY = y - pivot.y;
    return { x: pivot.x - relY, y: pivot.y + relX };
  });
}

function tryRotate() {
  const rotated = rotate(current);
  const kicks = [0, -1, 1, -2, 2];
  for (const dx of kicks) {
    const shifted = rotated.map((c) => ({ x: c.x + dx, y: c.y }));
    if (!collides(shifted)) {
      current.cells = shifted;
      draw();
      return;
    }
  }
}

function move(dx, dy) {
  const moved = current.cells.map((c) => ({ x: c.x + dx, y: c.y + dy }));
  if (collides(moved)) return false;
  current.cells = moved;
  return true;
}

function lockPiece() {
  current.cells.forEach(({ x, y }) => {
    if (y >= 0) grid[y][x] = COLORS[current.name];
  });
  clearLines();
  current = next;
  next = spawnPiece(randomPieceName());
  if (collides(current.cells)) {
    endGame();
  }
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (grid[y].every((cell) => cell !== null)) {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }
  if (cleared > 0) {
    const points = [0, 40, 100, 300, 1200][cleared] * (level + 1);
    score += points;
    linesCleared += cleared;
    level = Math.floor(linesCleared / 10);
    updateStats();
  }
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = linesCleared;
}

function hardDrop() {
  while (move(0, 1)) {}
  lockPiece();
  draw();
}

function drawCell(c, x, y, color) {
  c.fillStyle = color;
  c.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
  c.fillStyle = "rgba(255,255,255,0.15)";
  c.fillRect(x * CELL, y * CELL, CELL - 1, 4);
}

function draw() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x]) drawCell(ctx, x, y, grid[y][x]);
    }
  }

  if (current) {
    current.cells.forEach(({ x, y }) => {
      if (y >= 0) drawCell(ctx, x, y, COLORS[current.name]);
    });
  }

  nextCtx.fillStyle = "#000";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (next) {
    const cells = SHAPES[next.name];
    const offsetX = next.name === "O" || next.name === "I" ? 0.5 : 1;
    cells.forEach(([x, y]) => {
      drawCell(nextCtx, x - offsetX + 0.5, y + 0.5, COLORS[next.name]);
    });
  }
}

function endGame() {
  running = false;
  gameOver = true;
  overlayText.textContent = "GAME OVER";
  overlay.querySelector(".hint").textContent = "Stiskni Enter pro nový pokus";
  overlay.hidden = false;
  cancelAnimationFrame(rafId);
}

function resetGame() {
  grid = emptyGrid();
  score = 0;
  level = 0;
  linesCleared = 0;
  dropCounter = 0;
  frameCount = 0;
  lastPieceName = null;
  current = spawnPiece(randomPieceName());
  next = spawnPiece(randomPieceName());
  gameOver = false;
  updateStats();
}

function startGame() {
  resetGame();
  running = true;
  paused = false;
  overlay.hidden = true;
  draw();
  cancelAnimationFrame(rafId);
  loop();
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  overlay.hidden = !paused;
  if (paused) {
    overlayText.textContent = "PAUZA";
    overlay.querySelector(".hint").textContent = "Stiskni P pro pokračování";
  } else {
    loop();
  }
}

function loop() {
  if (!running || paused) return;
  frameCount++;
  const speed = softDrop ? 2 : framesForLevel(level);
  if (frameCount >= speed) {
    frameCount = 0;
    if (!move(0, 1)) {
      lockPiece();
    }
    draw();
  }
  rafId = requestAnimationFrame(loop);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (!running || gameOver)) {
    startGame();
    return;
  }
  if (e.key.toLowerCase() === "p") {
    togglePause();
    return;
  }
  if (!running || paused) return;

  switch (e.key) {
    case "ArrowLeft":
      move(-1, 0);
      draw();
      break;
    case "ArrowRight":
      move(1, 0);
      draw();
      break;
    case "ArrowDown":
      softDrop = true;
      break;
    case "ArrowUp":
      tryRotate();
      break;
    case " ":
      e.preventDefault();
      hardDrop();
      break;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowDown") softDrop = false;
});

overlay.addEventListener("click", () => {
  if (paused) {
    togglePause();
  } else {
    startGame();
  }
});

function bindTap(id, onDown, onUp) {
  const el = document.getElementById(id);
  const start = (e) => {
    e.preventDefault();
    if (running && !paused) onDown();
  };
  const end = (e) => {
    e.preventDefault();
    if (onUp) onUp();
  };
  el.addEventListener("touchstart", start, { passive: false });
  el.addEventListener("mousedown", start);
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", end);
  el.addEventListener("mouseup", end);
  el.addEventListener("mouseleave", end);
}

bindTap("btnLeft", () => { move(-1, 0); draw(); });
bindTap("btnRight", () => { move(1, 0); draw(); });
bindTap("btnRotate", () => tryRotate());
bindTap("btnDrop", () => hardDrop());
bindTap(
  "btnDown",
  () => { softDrop = true; },
  () => { softDrop = false; }
);

document.getElementById("btnPause").addEventListener("click", (e) => {
  e.preventDefault();
  togglePause();
});

resetGame();
draw();
