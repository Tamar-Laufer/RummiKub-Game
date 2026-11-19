// ─── Rendering (DOM) ──────────────────────────────────────────────────────────
import { BOARD_ROWS, BOARD_COLS } from './game-logic.js';
import { updateCardCounts } from './game-ui.js';
import { isJoker } from './rules.js';

const COLOR_HEX = { red: '#FF0000', black: '#000000', blue: '#0000FF', orange: '#FFA500' };
const JOKER_IMAGE = { red: '../images/redJocker.png', black: '../images/blackJocker.png' };

// ─── Card element ─────────────────────────────────────────────────────────────
// A joker looks like a regular tile with the joker face (red or black) in the circle
function createCardEl(card, id) {
    const el = document.createElement('div');
    el.className = 'card';
    el.id = id;
    el.draggable = true;

    const numSpan = document.createElement('span');
    if (isJoker(card)) {
        el.classList.add('card-joker');
        el.title = 'Joker';
        const face = document.createElement('img');
        face.src = JOKER_IMAGE[card[1]];
        face.alt = 'Joker';
        face.draggable = false;          // drag the whole tile, not the image
        numSpan.appendChild(face);
    } else {
        numSpan.textContent = card[1];
        numSpan.style.color = COLOR_HEX[card[0]] || '#000';
    }

    const hiddenColor = document.createElement('span');
    hiddenColor.textContent = card[0];
    hiddenColor.style.display = 'none';

    const logo = document.createElement('p');
    logo.textContent = 'Rummikub';

    el.append(numSpan, hiddenColor, logo);

    el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', id);
        el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));

    return el;
}

// ─── Render board ─────────────────────────────────────────────────────────────
function renderBoard(state) {
    for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (!cell) continue;
            cell.innerHTML = '';
            if (state.gameBoard[r][c])
                cell.appendChild(createCardEl(state.gameBoard[r][c], `bc-${r}-${c}`));
        }
    }
}

// ─── Render tray ──────────────────────────────────────────────────────────────
function renderTray(state) {
    const box = document.querySelector('.box');
    if (!box) return;
    box.innerHTML = '';
    state.playerCards.forEach((card, i) =>
        box.appendChild(createCardEl(card, `tc-${i}`))
    );
}

export function render(state) {
    renderBoard(state);
    renderTray(state);
    updateCardCounts(state);
}
