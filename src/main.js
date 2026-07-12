import { fillerAlphabet, levels } from "./puzzles.js";
import "./styles.css";

const STORAGE_KEY = "crosswords-word-search:v2";
const app = document.querySelector("#app");

const state = {
  levelIndex: 0,
  found: {},
  activeStart: null,
  activeEnd: null,
  dragging: false,
  hintWord: null,
  message: "Find every hidden word.",
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (Number.isInteger(saved.levelIndex)) {
      state.levelIndex = Math.min(Math.max(saved.levelIndex, 0), levels.length - 1);
    }
    state.found = saved.found ?? {};
  } catch {
    state.levelIndex = 0;
    state.found = {};
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      levelIndex: state.levelIndex,
      found: state.found,
    }),
  );
}

function currentLevel() {
  return levels[state.levelIndex];
}

function wordKey(levelId, word) {
  return `${levelId}:${word}`;
}

function seededIndex(row, col, size) {
  return (row * 17 + col * 31 + size * 13 + row * col * 7) % fillerAlphabet.length;
}

function buildGrid(level) {
  const grid = Array.from({ length: level.size }, (_, row) =>
    Array.from({ length: level.size }, (_, col) => fillerAlphabet[seededIndex(row, col, level.size)]),
  );

  for (const placement of level.placements) {
    [...placement.word].forEach((letter, index) => {
      const row = placement.row + placement.dr * index;
      const col = placement.col + placement.dc * index;
      grid[row][col] = letter;
    });
  }

  return grid;
}

function cellsForPlacement(placement) {
  return [...placement.word].map((_, index) => ({
    row: placement.row + placement.dr * index,
    col: placement.col + placement.dc * index,
  }));
}

function getPlacement(level, word) {
  return level.placements.find((placement) => placement.word === word);
}

function normalizeLine(start, end) {
  if (!start || !end) return [];
  const rowDelta = end.row - start.row;
  const colDelta = end.col - start.col;
  const rowStep = Math.sign(rowDelta);
  const colStep = Math.sign(colDelta);
  const length = Math.max(Math.abs(rowDelta), Math.abs(colDelta)) + 1;

  if (!(rowDelta === 0 || colDelta === 0 || Math.abs(rowDelta) === Math.abs(colDelta))) {
    return [start];
  }

  return Array.from({ length }, (_, index) => ({
    row: start.row + rowStep * index,
    col: start.col + colStep * index,
  }));
}

function wordFromCells(grid, cells) {
  return cells.map((cell) => grid[cell.row]?.[cell.col] ?? "").join("");
}

function foundWords(level) {
  return level.words.filter((word) => state.found[wordKey(level.id, word)]);
}

function isLevelComplete(level) {
  return foundWords(level).length === level.words.length;
}

function cellId(cell) {
  return `${cell.row},${cell.col}`;
}

function foundCellIds(level) {
  const ids = new Set();
  for (const word of foundWords(level)) {
    for (const cell of cellsForPlacement(getPlacement(level, word))) {
      ids.add(cellId(cell));
    }
  }
  return ids;
}

function selectedCellIds() {
  return new Set(normalizeLine(state.activeStart, state.activeEnd).map(cellId));
}

function updateSelectionView() {
  const selectedIds = selectedCellIds();
  app.querySelectorAll("[data-row][data-col]").forEach((cell) => {
    const id = `${cell.dataset.row},${cell.dataset.col}`;
    cell.classList.toggle("is-selected", selectedIds.has(id));
  });
}

function hintCellIds(level) {
  if (!state.hintWord) return new Set();
  const placement = getPlacement(level, state.hintWord);
  return placement ? new Set(cellsForPlacement(placement).map(cellId)) : new Set();
}

function validateSelection() {
  const level = currentLevel();
  const grid = buildGrid(level);
  const cells = normalizeLine(state.activeStart, state.activeEnd);
  const candidate = wordFromCells(grid, cells);
  const reversed = [...candidate].reverse().join("");
  const match = level.words.find((word) => word === candidate || word === reversed);

  if (match && !state.found[wordKey(level.id, match)]) {
    state.found[wordKey(level.id, match)] = true;
    state.message = isLevelComplete(level) ? "Level clear." : `${match} found.`;
    state.hintWord = null;
    saveState();
  } else if (match) {
    state.message = `${match} is already found.`;
  } else {
    state.message = "Keep looking.";
  }

  state.activeStart = null;
  state.activeEnd = null;
  state.dragging = false;
  render();
}

function setLevel(index) {
  state.levelIndex = index;
  state.activeStart = null;
  state.activeEnd = null;
  state.dragging = false;
  state.hintWord = null;
  state.message = "Find every hidden word.";
  saveState();
  render();
}

function resetLevel() {
  const level = currentLevel();
  for (const word of level.words) {
    delete state.found[wordKey(level.id, word)];
  }
  state.hintWord = null;
  state.message = "Level reset.";
  saveState();
  render();
}

function showHint() {
  const level = currentLevel();
  const remaining = level.words.find((word) => !state.found[wordKey(level.id, word)]);
  state.hintWord = remaining ?? null;
  state.message = remaining ? `${remaining[0]} starts the next word.` : "Everything is found.";
  render();
}

function nextLevel() {
  const next = Math.min(state.levelIndex + 1, levels.length - 1);
  setLevel(next);
}

function handleCellStart(cell) {
  state.activeStart = cell;
  state.activeEnd = cell;
  state.dragging = true;
  state.hintWord = null;
  updateSelectionView();
}

function handleCellMove(cell) {
  if (!state.dragging || !state.activeStart) return;
  state.activeEnd = cell;
  updateSelectionView();
}

function handleCellEnd(cell) {
  if (!state.activeStart) {
    handleCellStart(cell);
    return;
  }

  if (!state.dragging && state.activeStart) {
    state.activeEnd = cell;
  } else {
    state.activeEnd = cell;
  }

  validateSelection();
}

function renderGrid(level, grid) {
  const foundIds = foundCellIds(level);
  const selectedIds = selectedCellIds();
  const hintedIds = hintCellIds(level);

  return grid
    .map((row, rowIndex) => {
      const cells = row
        .map((letter, colIndex) => {
          const id = `${rowIndex},${colIndex}`;
          const classes = [
            "cell",
            foundIds.has(id) ? "is-found" : "",
            selectedIds.has(id) ? "is-selected" : "",
            hintedIds.has(id) ? "is-hinted" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return `
            <button
              class="${classes}"
              type="button"
              data-row="${rowIndex}"
              data-col="${colIndex}"
              aria-label="Row ${rowIndex + 1}, column ${colIndex + 1}, ${letter}"
            >${letter}</button>
          `;
        })
        .join("");
      return `<div class="grid-row">${cells}</div>`;
    })
    .join("");
}

function renderWordBank(level) {
  return level.words
    .map((word) => {
      const found = state.found[wordKey(level.id, word)];
      return `<li class="word ${found ? "is-found" : ""}">${word}</li>`;
    })
    .join("");
}

function renderLevelTabs() {
  return levels
    .map(
      (level, index) => `
        <button class="level-tab ${index === state.levelIndex ? "is-active" : ""}" type="button" data-level="${index}">
          <span>${index + 1}</span>
          ${level.title}
        </button>
      `,
    )
    .join("");
}

function render() {
  const level = currentLevel();
  const grid = buildGrid(level);
  const foundCount = foundWords(level).length;
  const complete = isLevelComplete(level);
  const progress = Math.round((foundCount / level.words.length) * 100);

  app.innerHTML = `
    <main class="game-shell" style="--accent:${level.accent};--glow:${level.glow}">
      <section class="game-board" aria-label="CrossWords word search">
        <header class="topbar">
          <div>
            <p class="kicker">CrossWords</p>
            <h1>${level.title}</h1>
          </div>
          <div class="progress" aria-label="${progress}% complete">
            <span>${foundCount}/${level.words.length}</span>
            <div><i style="width:${progress}%"></i></div>
          </div>
        </header>

        <div class="level-strip" aria-label="Levels">
          ${renderLevelTabs()}
        </div>

        <div class="board-wrap">
          <div class="letter-grid" style="--grid-size:${level.size}">
            ${renderGrid(level, grid)}
          </div>
        </div>
      </section>

      <aside class="side-panel">
        <div class="level-card">
          <span>${level.difficulty}</span>
          <h2>${level.theme}</h2>
        </div>

        <ul class="word-bank" aria-label="Word bank">
          ${renderWordBank(level)}
        </ul>

        <div class="actions">
          <button class="primary" type="button" data-action="hint">Hint</button>
          <button type="button" data-action="reset">Reset</button>
          <button type="button" data-action="next" ${complete && state.levelIndex < levels.length - 1 ? "" : "disabled"}>Next</button>
        </div>

        <p class="status" aria-live="polite">${state.message}</p>
      </aside>
    </main>
  `;
}

function cellFromTarget(target) {
  const cell = target.closest("[data-row][data-col]");
  if (!cell) return null;
  return {
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
  };
}

function cellFromPoint(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  return target ? cellFromTarget(target) : null;
}

app.addEventListener("pointerdown", (event) => {
  const cell = cellFromTarget(event.target);
  if (!cell) return;
  event.preventDefault();
  handleCellStart(cell);
});

document.addEventListener("pointermove", (event) => {
  const cell = cellFromPoint(event);
  if (cell) handleCellMove(cell);
});

app.addEventListener("pointerover", (event) => {
  const cell = cellFromTarget(event.target);
  if (cell) handleCellMove(cell);
});

document.addEventListener("pointerup", (event) => {
  const cell = cellFromPoint(event) ?? cellFromTarget(event.target);
  if (cell) handleCellEnd(cell);
});

app.addEventListener("mousedown", (event) => {
  const cell = cellFromTarget(event.target);
  if (!cell) return;
  event.preventDefault();
  handleCellStart(cell);
});

document.addEventListener("mousemove", (event) => {
  const cell = cellFromPoint(event);
  if (cell) handleCellMove(cell);
});

document.addEventListener("mouseup", (event) => {
  const cell = cellFromPoint(event) ?? cellFromTarget(event.target);
  if (cell) handleCellEnd(cell);
});

app.addEventListener("click", (event) => {
  const levelButton = event.target.closest("[data-level]");
  if (levelButton) {
    setLevel(Number(levelButton.dataset.level));
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "hint") showHint();
  if (action === "reset") resetLevel();
  if (action === "next") nextLevel();
});

loadState();
render();
