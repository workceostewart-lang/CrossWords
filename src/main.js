import { puzzles } from "./puzzles.js";
import "./styles.css";

const STORAGE_KEY = "crosswords:v1";
const app = document.querySelector("#app");

const state = {
  puzzleId: puzzles[0].id,
  direction: "across",
  cursor: { row: 0, col: 0 },
  inputs: {},
  startedAt: null,
  elapsedMs: 0,
  completedAt: null,
  checked: false,
};

function gridSize(puzzle) {
  return puzzle.words.length;
}

function makeSolutions(puzzle) {
  return puzzle.words.map((word) => word.toLowerCase().split(""));
}

function makeNumberMap(size) {
  const map = new Map();
  let number = 1;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const startsAcross = col === 0;
      const startsDown = row === 0;
      if (startsAcross || startsDown) {
        map.set(`${row},${col}`, number);
        number += 1;
      }
    }
  }
  return map;
}

function getPuzzle(puzzleId) {
  return puzzles.find((puzzle) => puzzle.id === puzzleId) ?? puzzles[0];
}

function getCompletedCount(puzzle, inputs) {
  const size = gridSize(puzzle);
  let correct = 0;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const expected = puzzle.words[row][col].toUpperCase();
      if ((inputs[`${row},${col}`] ?? "") === expected) {
        correct += 1;
      }
    }
  }
  return correct;
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state.puzzleId = parsed.puzzleId ?? state.puzzleId;
      state.direction = parsed.direction === "down" ? "down" : "across";
      state.cursor = parsed.cursor ?? state.cursor;
      state.inputs = parsed.inputs ?? {};
      state.startedAt = parsed.startedAt ?? null;
      state.elapsedMs = parsed.elapsedMs ?? 0;
      state.completedAt = parsed.completedAt ?? null;
      state.checked = Boolean(parsed.checked);
    }
  } catch {
    // Ignore corrupt storage and start fresh.
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getElapsedMs() {
  if (state.completedAt || !state.startedAt) {
    return state.elapsedMs;
  }
  return state.elapsedMs + (Date.now() - state.startedAt);
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startTimerIfNeeded() {
  if (!state.startedAt && !state.completedAt) {
    state.startedAt = Date.now();
  }
}

function finishPuzzle() {
  if (state.completedAt) return;
  state.completedAt = Date.now();
  state.elapsedMs = getElapsedMs();
  state.startedAt = null;
  state.checked = true;
  saveState();
}

function setPuzzle(puzzleId) {
  const puzzle = getPuzzle(puzzleId);
  state.puzzleId = puzzle.id;
  state.direction = "across";
  state.cursor = { row: 0, col: 0 };
  state.inputs = {};
  state.startedAt = null;
  state.elapsedMs = 0;
  state.completedAt = null;
  state.checked = false;
  saveState();
  render();
}

function selectClue(direction, index) {
  state.direction = direction;
  state.cursor = direction === "across" ? { row: index, col: 0 } : { row: 0, col: index };
  startTimerIfNeeded();
  saveState();
  render();
}

function toggleDirection() {
  state.direction = state.direction === "across" ? "down" : "across";
  startTimerIfNeeded();
  saveState();
  render();
}

function normalizeLetter(value) {
  return value.replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase();
}

function moveCursor(deltaRow, deltaCol) {
  const puzzle = getPuzzle(state.puzzleId);
  const size = gridSize(puzzle);
  const row = Math.min(size - 1, Math.max(0, state.cursor.row + deltaRow));
  const col = Math.min(size - 1, Math.max(0, state.cursor.col + deltaCol));
  state.cursor = { row, col };
}

function currentLineIndex() {
  return state.direction === "across" ? state.cursor.row : state.cursor.col;
}

function render() {
  const puzzle = getPuzzle(state.puzzleId);
  const size = gridSize(puzzle);
  const solutions = makeSolutions(puzzle);
  const numberMap = makeNumberMap(size);
  const correctCount = getCompletedCount(puzzle, state.inputs);
  const totalCells = size * size;
  const progress = Math.round((correctCount / totalCells) * 100);
  const activeLine = currentLineIndex();
  const elapsed = getElapsedMs();
  const isSolved = correctCount === totalCells;
  if (isSolved) finishPuzzle();

  const board = [];
  for (let row = 0; row < size; row += 1) {
    const cells = [];
    for (let col = 0; col < size; col += 1) {
      const key = `${row},${col}`;
      const isActive =
        (state.direction === "across" && row === state.cursor.row) ||
        (state.direction === "down" && col === state.cursor.col);
      const isCursor = row === state.cursor.row && col === state.cursor.col;
      const expected = solutions[row][col];
      const value = state.inputs[key] ?? "";
      const isCorrect = value === expected && value.length === 1;
      const isWrong = state.checked && value.length === 1 && value !== expected;
      const startsHere = numberMap.has(key);
      const number = numberMap.get(key);
      cells.push(`
        <button
          class="cell ${isActive ? "is-active" : ""} ${isCursor ? "is-cursor" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}"
          data-row="${row}"
          data-col="${col}"
          type="button"
        >
          ${startsHere ? `<span class="cell-number">${number}</span>` : ""}
          <span class="cell-letter">${value}</span>
        </button>
      `);
    }
    board.push(`<div class="row">${cells.join("")}</div>`);
  }

  const acrossClues = puzzle.across
    .map((clue, index) => {
      const number = numberMap.get(`${index},0`);
      const active = state.direction === "across" && activeLine === index;
      return `
        <button class="clue ${active ? "is-active" : ""}" type="button" data-direction="across" data-index="${index}">
          <span class="clue-number">${number}</span>
          <span class="clue-text">${clue.clue}</span>
        </button>
      `;
    })
    .join("");

  const downClues = puzzle.down
    .map((clue, index) => {
      const number = numberMap.get(`0,${index}`);
      const active = state.direction === "down" && activeLine === index;
      return `
        <button class="clue ${active ? "is-active" : ""}" type="button" data-direction="down" data-index="${index}">
          <span class="clue-number">${number}</span>
          <span class="clue-text">${clue.clue}</span>
        </button>
      `;
    })
    .join("");

  const cards = puzzles
    .map((item) => {
      const saved = item.id === puzzle.id;
      return `
        <button
          class="puzzle-card ${saved ? "is-selected" : ""}"
          type="button"
          data-action="puzzle"
          data-puzzle="${item.id}"
          style="--accent:${item.accent}"
        >
          <span class="puzzle-title">${item.title}</span>
          <span class="puzzle-subtitle">${item.subtitle}</span>
          <span class="puzzle-meta">${item.words.length} x ${item.words.length} word square</span>
        </button>
      `;
    })
    .join("");

  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <p class="eyebrow">Fantomzone collection</p>
          <h1>CrossWords</h1>
          <p class="lede">A compact crossword playground built from mirrored word squares.</p>
        </div>
        <div class="stats">
          <div class="stat">
            <span>Progress</span>
            <strong>${progress}%</strong>
          </div>
          <div class="stat">
            <span>Timer</span>
            <strong>${formatTime(elapsed)}</strong>
          </div>
          <div class="stat">
            <span>Mode</span>
            <strong>${state.direction.toUpperCase()}</strong>
          </div>
        </div>
        <div class="puzzle-list">
          ${cards}
        </div>
      </aside>

      <main class="main">
        <section class="hero-card">
          <div>
            <p class="eyebrow">${puzzle.subtitle}</p>
            <h2>${puzzle.title}</h2>
            <p class="hero-copy">Fill the grid with the clues on the side. Click a clue to lock direction, or use the arrow keys to move around the square.</p>
          </div>
          <div class="hero-badge" style="--accent:${puzzle.accent}">
            <span>${size}x${size}</span>
            <strong>Word Square</strong>
          </div>
        </section>

        <section class="playfield">
          <div class="board-panel">
            <div class="board-wrap">
              <div class="board" aria-label="Crossword grid">${board.join("")}</div>
            </div>
            ${isSolved ? `<div class="success">Solved. Nice work.</div>` : ""}
            <div class="controls">
              <button type="button" class="action" data-action="toggle-direction">Toggle direction</button>
              <button type="button" class="action" data-action="check">Check puzzle</button>
              <button type="button" class="action" data-action="reveal">Reveal cell</button>
              <button type="button" class="action ghost" data-action="reset">Reset</button>
            </div>
          </div>

          <div class="clue-panel">
            <div class="clue-column">
              <h3>Across</h3>
              <div class="clues">${acrossClues}</div>
            </div>
            <div class="clue-column">
              <h3>Down</h3>
              <div class="clues">${downClues}</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;

  const cursorCell = app.querySelector(`[data-row="${state.cursor.row}"][data-col="${state.cursor.col}"]`);
  if (cursorCell) {
    cursorCell.focus({ preventScroll: true });
  }
}

function setLetter(letter) {
  const puzzle = getPuzzle(state.puzzleId);
  const size = gridSize(puzzle);
  const { row, col } = state.cursor;
  const key = `${row},${col}`;
  state.inputs[key] = letter;
  state.checked = false;
  startTimerIfNeeded();
  if (state.direction === "across") {
    if (col < size - 1) state.cursor = { row, col: col + 1 };
  } else if (row < size - 1) {
    state.cursor = { row: row + 1, col };
  }
  saveState();
  render();
}

function clearCurrent() {
  const { row, col } = state.cursor;
  const key = `${row},${col}`;
  if (state.inputs[key]) {
    state.inputs[key] = "";
    state.checked = false;
  }
}

function revealCurrent() {
  const puzzle = getPuzzle(state.puzzleId);
  const { row, col } = state.cursor;
  state.inputs[`${row},${col}`] = puzzle.words[row][col].toUpperCase();
  state.checked = false;
  startTimerIfNeeded();
  saveState();
  render();
}

function resetPuzzle() {
  const puzzle = getPuzzle(state.puzzleId);
  state.inputs = {};
  state.startedAt = null;
  state.elapsedMs = 0;
  state.completedAt = null;
  state.checked = false;
  state.direction = "across";
  state.cursor = { row: 0, col: 0 };
  saveState();
  render();
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-row], [data-col], [data-direction]");
  if (!target) return;

  const action = target.getAttribute("data-action");
  if (action === "puzzle") {
    setPuzzle(target.getAttribute("data-puzzle"));
    return;
  }

  if (action === "toggle-direction") {
    toggleDirection();
    return;
  }

  if (action === "check") {
    state.checked = true;
    saveState();
    render();
    return;
  }

  if (action === "reveal") {
    revealCurrent();
    return;
  }

  if (action === "reset") {
    resetPuzzle();
    return;
  }

  if (target.matches("[data-direction]")) {
    selectClue(target.getAttribute("data-direction"), Number(target.getAttribute("data-index")));
    return;
  }

  const row = Number(target.getAttribute("data-row"));
  const col = Number(target.getAttribute("data-col"));
  state.cursor = { row, col };
  startTimerIfNeeded();
  saveState();
  render();
});

document.addEventListener("keydown", (event) => {
  const key = event.key;
  if (key.length === 1 && /[a-z]/i.test(key)) {
    event.preventDefault();
    setLetter(normalizeLetter(key));
    return;
  }

  if (key === "Backspace") {
    event.preventDefault();
    clearCurrent();
    if (state.direction === "across") {
      moveCursor(0, -1);
    } else {
      moveCursor(-1, 0);
    }
    startTimerIfNeeded();
    saveState();
    render();
    return;
  }

  if (key === "ArrowLeft") {
    event.preventDefault();
    moveCursor(0, -1);
  } else if (key === "ArrowRight") {
    event.preventDefault();
    moveCursor(0, 1);
  } else if (key === "ArrowUp") {
    event.preventDefault();
    moveCursor(-1, 0);
  } else if (key === "ArrowDown") {
    event.preventDefault();
    moveCursor(1, 0);
  } else if (key === "Tab" || key === " ") {
    event.preventDefault();
    toggleDirection();
    return;
  } else if (key === "Enter") {
    event.preventDefault();
    state.checked = true;
    saveState();
    render();
    return;
  } else {
    return;
  }

  startTimerIfNeeded();
  saveState();
  render();
});

loadSavedState();
render();
