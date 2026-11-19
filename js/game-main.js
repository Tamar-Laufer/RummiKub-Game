// ─── Entry point: connects the game logic to the page ───────────────────────
// Turn decisions live in game-logic.js; this file does only DOM, timing and the server call.
import {
    createGame, restoreState, boardCardsOf,
    endPlayerTurn, playerDraw, applyServerMove, applyComputerMove, finishComputerTurn
} from './game-logic.js';
import { render } from './game-render.js';
import { setupBoard, setupTrayDrop } from './game-board.js';
import { updateTurnIndicator, updateCardCounts, showMessageBox, setServerStatus } from './game-ui.js';

const PYTHON_SERVER = 'http://localhost:5000';

let state = null;   // created in initGame

function restoreAndRender() {
    restoreState(state);
    render(state);
}

// ─── Show win / lose screen ───────────────────────────────────────────────────
function showEndScreen(playerWon) {
    const target = playerWon ? 'win.html' : 'fail.html';
    try { window.location.href = target; } catch { /* ignored */ }

    // Fallback overlay (works in file:// mode)
    const overlay = document.getElementById('end-overlay');
    const title   = document.getElementById('end-title');
    const sub     = document.getElementById('end-sub');
    if (overlay) {
        title.textContent = playerWon ? '🏆 YOU WON!'  : '🤖 Bob Wins!';
        sub.textContent   = playerWon ? 'Congratulations!' : 'Better luck next time.';
        overlay.classList.add('show');
    }
}

// ─── Computer turn ────────────────────────────────────────────────────────────
async function computerTurn() {
    updateTurnIndicator(false);

    const boardCards = boardCardsOf(state.gameBoard);

    try {
        // ── Python server (optional) ───────────────────────────────────────────
        const res = await fetch(`${PYTHON_SERVER}/computer-turn`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ hand: state.computerCards, boardCards })
        });
        if (!res.ok) throw new Error('server error');

        const data = await res.json();
        applyServerMove(state, data, boardCards);
        setServerStatus(true);

    } catch {
        // ── JS fallback (original algorithm) ──────────────────────────────────
        setServerStatus(false);
        applyComputerMove(state, boardCards);
    }

    if (finishComputerTurn(state) === 'computer-won') {
        render(state);
        setTimeout(() => showEndScreen(false), 400);
        return;
    }

    render(state);
    updateCardCounts(state);
    updateTurnIndicator(true);
}

// ─── End of player's turn ─────────────────────────────────────────────────────
function onFinishTurn() {
    const result = endPlayerTurn(state);

    if (result === 'no-move') {
        // Player must do something: either move a tile or draw
        showMessageBox(
            'You must play a tile or draw a card!',
            'OK', 'OK', () => {}, () => {}
        );
        return;
    }

    if (result === 'invalid') {
        showMessageBox(
            'Invalid move — the board is not valid.',
            'Try Again', 'Take a Card',
            () => restoreAndRender(),
            () => { restoreAndRender(); drawAndEndTurn(); }
        );
        return;
    }

    if (result === 'player-won') { showEndScreen(true); return; }

    updateCardCounts(state);
    setTimeout(async () => await computerTurn(), 800);
}

// ─── Player draws and ends turn ───────────────────────────────────────────────
function drawAndEndTurn() {
    if (playerDraw(state) === 'deck-empty') {
        showMessageBox('The deck is empty!', 'OK', 'OK', () => {}, () => {});
        return;
    }
    render(state);
    updateCardCounts(state);
    setTimeout(async () => await computerTurn(), 800);
}

// ─── Initialise game ──────────────────────────────────────────────────────────
function initGame() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && currentUser.username) {
        const nameEl = document.getElementById('human-name');
        if (nameEl) nameEl.textContent = currentUser.username;
    }

    state = createGame();

    setupBoard(state);
    setupTrayDrop(state);
    render(state);
    updateTurnIndicator(true);
    updateCardCounts(state);
}

// ─── Event listeners ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initGame);

document.getElementById('addCard').addEventListener('click', () => {
    if (!state || !state.isPlayerTurn) return;
    drawAndEndTurn();
});

document.getElementById('finishTurn').addEventListener('click', () => {
    if (!state || !state.isPlayerTurn) return;
    onFinishTurn();
});
