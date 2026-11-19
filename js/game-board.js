// ─── Board setup and drag & drop (DOM) ───────────────────────────────────────
import { BOARD_ROWS, BOARD_COLS } from './game-logic.js';
import { render } from './game-render.js';

// ─── Parse card ID ────────────────────────────────────────────────────────────
// Tray cards:  "tc-{index}"
// Board cards: "bc-{row}-{col}"
function parseCardId(state, id) {
    if (id.startsWith('tc-')) {
        const i = parseInt(id.slice(3));
        return { src: 'tray', i, card: state.playerCards[i] };
    }
    if (id.startsWith('bc-')) {
        const [r, c] = id.slice(3).split('-').map(Number);
        return { src: 'board', r, c, card: state.gameBoard[r][c] };
    }
    return null;
}

// ─── Drop handler for a board cell ───────────────────────────────────────────
function makeCellDroppable(state, cell, row, col) {
    cell.addEventListener('dragover', e => {
        e.preventDefault();
        cell.classList.add('dragover');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('dragover'));

    cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('dragover');
        if (!state.isPlayerTurn) return;

        const info = parseCardId(state, e.dataTransfer.getData('text/plain'));
        if (!info || !info.card) return;

        // Reject if target cell is occupied by a different card
        if (state.gameBoard[row][col] && !(info.src === 'board' && info.r === row && info.c === col)) return;

        if (info.src === 'tray') {
            state.gameBoard[row][col] = info.card;
            state.playerCards.splice(info.i, 1);
        } else {
            state.gameBoard[row][col] = info.card;
            state.gameBoard[info.r][info.c] = null;
        }
        render(state);
    });
}

// ─── Build the game board (BOARD_ROWS × BOARD_COLS) ──────────────────────────
export function setupBoard(state) {
    const existing = document.querySelector('.game-board');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'game-board';

    for (let r = 0; r < BOARD_ROWS; r++)
        for (let c = 0; c < BOARD_COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.id = `cell-${r}-${c}`;
            makeCellDroppable(state, cell, r, c);
            container.appendChild(cell);
        }

    document.getElementById('board-area').appendChild(container);
}

// ─── Drop handler for the player's tray ──────────────────────────────────────
export function setupTrayDrop(state) {
    const box = document.querySelector('.box');
    box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('dragover'); });
    box.addEventListener('dragleave', () => box.classList.remove('dragover'));

    box.addEventListener('drop', e => {
        e.preventDefault();
        box.classList.remove('dragover');
        if (!state.isPlayerTurn) return;

        const info = parseCardId(state, e.dataTransfer.getData('text/plain'));
        if (!info || info.src !== 'board') return;

        state.playerCards.push(info.card);
        state.gameBoard[info.r][info.c] = null;
        render(state);
    });
}
