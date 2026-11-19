// ─── Constants ────────────────────────────────────────────────────────────────
const COLOR_HEX = { red: '#FF0000', black: '#000000', blue: '#0000FF', orange: '#FFA500' };
const COLORS    = ['red', 'black', 'blue', 'orange'];

const PYTHON_SERVER = 'http://localhost:5000';

// ─── Full deck (2 copies × 4 colors × 13 numbers + 2 jokers) ─────────────────
const FULL_DECK = [];
for (const color of COLORS)
    for (let copy = 0; copy < 2; copy++)
        for (let num = 1; num <= 13; num++)
            FULL_DECK.push([color, num]);
// No jokers

// ─── Game state ───────────────────────────────────────────────────────────────
let remainingDeck = [];
let playerCards   = [];   // cards in the human player's tray
let computerCards = [];
let gameBoard     = Array(5).fill(null).map(() => Array(22).fill(null));
let isPlayerTurn  = true;

// Saved state — restored when the player's move is invalid
let savedBoard  = null;
let savedPlayer = null;

// ─── Deck helpers ─────────────────────────────────────────────────────────────
function shuffledDeck() {
    const d = [...FULL_DECK];
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
}

function drawCards(n) {
    return remainingDeck.splice(0, Math.min(n, remainingDeck.length));
}

// ─── Save / Restore ───────────────────────────────────────────────────────────
function saveState() {
    savedBoard  = gameBoard.map(row => [...row]);
    savedPlayer = [...playerCards];
}

function restoreState() {
    gameBoard   = savedBoard.map(row => [...row]);
    playerCards = [...savedPlayer];
    render();
}
