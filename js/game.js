// ─── Constants ────────────────────────────────────────────────────────────────
const COLOR_HEX = { red: '#FF0000', black: '#000000', blue: '#0000FF', orange: '#FFA500' };
const COLORS    = ['red', 'black', 'blue', 'orange'];

// ─── Deck ─────────────────────────────────────────────────────────────────────
const FULL_DECK = [];
for (const color of COLORS)
    for (let copy = 0; copy < 2; copy++)
        for (let num = 1; num <= 13; num++)
            FULL_DECK.push([color, num]);

// ─── Game state ───────────────────────────────────────────────────────────────
let remainingDeck = [];
let playerCards   = [];
let computerCards = [];
let gameBoard     = Array(5).fill(null).map(() => Array(22).fill(null));
let savedBoard    = null;
let savedPlayer   = null;
let isPlayerTurn  = true;

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

// ─── Save / Restore state ─────────────────────────────────────────────────────
function saveState() {
    savedBoard  = gameBoard.map(row => [...row]);
    savedPlayer = [...playerCards];
}

function restoreState() {
    gameBoard   = savedBoard.map(row => [...row]);
    playerCards = [...savedPlayer];
    render();
}

// ─── Card element ─────────────────────────────────────────────────────────────
function createCardEl(card, id) {
    const el = document.createElement('div');
    el.className = 'card';
    el.id = id;
    el.draggable = true;

    const numSpan = document.createElement('span');
    numSpan.textContent = card[1];
    numSpan.style.color = COLOR_HEX[card[0]] || '#000';

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

// ─── Render ───────────────────────────────────────────────────────────────────
function renderBoard() {
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 22; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (!cell) continue;
            cell.innerHTML = '';
            if (gameBoard[r][c])
                cell.appendChild(createCardEl(gameBoard[r][c], `bc-${r}-${c}`));
        }
    }
}

function renderTray() {
    const box = document.querySelector('.box');
    if (!box) return;
    box.innerHTML = '';
    playerCards.forEach((card, i) =>
        box.appendChild(createCardEl(card, `tc-${i}`))
    );
}

function render() { renderBoard(); renderTray(); }

// ─── Parse card ID ────────────────────────────────────────────────────────────
// Tray cards: "tc-{index}"
// Board cards: "bc-{row}-{col}"
function parseCardId(id) {
    if (id.startsWith('tc-')) {
        const i = parseInt(id.slice(3));
        return { src: 'tray', i, card: playerCards[i] };
    }
    if (id.startsWith('bc-')) {
        const parts = id.slice(3).split('-').map(Number);
        const [r, c] = parts;
        return { src: 'board', r, c, card: gameBoard[r][c] };
    }
    return null;
}

// ─── Board setup ──────────────────────────────────────────────────────────────
function makeCellDroppable(cell, row, col) {
    cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('dragover'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('dragover'));
    cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('dragover');
        if (!isPlayerTurn) return;

        const info = parseCardId(e.dataTransfer.getData('text/plain'));
        if (!info || !info.card) return;

        // Cell already occupied by a different card
        if (gameBoard[row][col] && !(info.src === 'board' && info.r === row && info.c === col)) return;

        if (info.src === 'tray') {
            gameBoard[row][col] = info.card;
            playerCards.splice(info.i, 1);
        } else {
            gameBoard[row][col] = info.card;
            gameBoard[info.r][info.c] = null;
        }
        render();
    });
}

function setupBoard() {
    const existing = document.querySelector('.game-board');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'game-board';

    for (let r = 0; r < 5; r++)
        for (let c = 0; c < 22; c++) {
            const cell = document.createElement('div');
            cell.className  = 'board-cell';
            cell.id         = `cell-${r}-${c}`;
            makeCellDroppable(cell, r, c);
            container.appendChild(cell);
        }

    document.querySelector('.players').insertAdjacentElement('afterend', container);
}

function setupTrayDrop() {
    const box = document.querySelector('.box');
    box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('dragover'); });
    box.addEventListener('dragleave', () => box.classList.remove('dragover'));
    box.addEventListener('drop', e => {
        e.preventDefault();
        box.classList.remove('dragover');
        if (!isPlayerTurn) return;

        const info = parseCardId(e.dataTransfer.getData('text/plain'));
        if (!info || info.src !== 'board') return;

        playerCards.push(info.card);
        gameBoard[info.r][info.c] = null;
        render();
    });
}

// ─── Validation ───────────────────────────────────────────────────────────────
function isValidGroup(tiles) {
    if (tiles.length < 3 || tiles.length > 4) return false;
    const num    = tiles[0][1];
    const colors = new Set(tiles.map(t => t[0]));
    return tiles.every(t => t[1] === num) && colors.size === tiles.length;
}

function isValidRun(tiles) {
    if (tiles.length < 3) return false;
    const color  = tiles[0][0];
    const sorted = [...tiles].sort((a, b) => a[1] - b[1]);
    return sorted.every((t, i) =>
        t[0] === color && (i === 0 || t[1] === sorted[i - 1][1] + 1)
    );
}

function isValidSet(tiles) {
    return isValidGroup(tiles) || isValidRun(tiles);
}

function isBoardValid() {
    for (let r = 0; r < 5; r++) {
        let run = [];
        for (let c = 0; c <= 22; c++) {
            const tile = c < 22 ? gameBoard[r][c] : null;
            if (tile) {
                run.push(tile);
            } else if (run.length > 0) {
                if (!isValidSet(run)) return false;
                run = [];
            }
        }
    }
    return true;
}

// ─── Python server URL ────────────────────────────────────────────────────────
const PYTHON_SERVER = 'http://localhost:5000';

// ─── Computer AI — Greedy O(n) ────────────────────────────────────────────────
//
// Strategy:
//   1. Pool = computer hand + board cards (all can be rearranged).
//   2. Pass 1: find groups (same number, 3-4 different colors).
//   3. Pass 2: find runs  (same color, consecutive numbers ≥ 3).
//   4. Remaining hand = hand cards not used in any set.
//
// This same algorithm runs in Python (rummy_algorithm.py) when the server
// is available. The JS version is the fallback.
//
function greedyFindSets(hand, boardCards) {
    // Each item tracks whether it has been assigned to a set
    const pool = [
        ...hand.map(c      => ({ card: c, fromHand: true,  used: false })),
        ...boardCards.map(c => ({ card: c, fromHand: false, used: false }))
    ];

    const sets = [];

    // Pass 1 — Groups ──────────────────────────────────────────────────────────
    for (let num = 1; num <= 13; num++) {
        const byColor = {};
        for (const item of pool) {
            if (!item.used && item.card[1] === num) {
                const color = item.card[0];
                if (!byColor[color]) byColor[color] = item;
            }
        }
        const chosen = Object.values(byColor).slice(0, 4);
        if (chosen.length >= 3) {
            chosen.forEach(item => { item.used = true; });
            sets.push(chosen.map(item => item.card));
        }
    }

    // Pass 2 — Runs ────────────────────────────────────────────────────────────
    for (const color of COLORS) {
        let runItems = [];

        for (let num = 1; num <= 14; num++) {   // 14 is a sentinel to flush
            if (num <= 13) {
                const item = pool.find(p => !p.used && p.card[0] === color && p.card[1] === num);
                if (item) {
                    item.used = true;
                    runItems.push(item);
                    continue;
                }
            }
            // Gap or end
            if (runItems.length >= 3) {
                sets.push(runItems.map(item => item.card));
            } else {
                runItems.forEach(item => { item.used = false; }); // return short runs
            }
            runItems = [];
        }
    }

    const remainingHand = pool.filter(p => p.fromHand && !p.used).map(p => p.card);
    return { sets, remainingHand };
}

function placeSetsOnBoard(sets) {
    const board = Array(5).fill(null).map(() => Array(22).fill(null));
    let r = 0, c = 0;
    for (const s of sets) {
        if (c + s.length > 22) { r++; c = 0; }
        if (r >= 5) break;
        s.forEach(card => { board[r][c++] = card; });
        if (c < 22) c++; // gap between sets
    }
    return board;
}

async function computerTurn() {
    const boardCards = [];
    for (let r = 0; r < 5; r++)
        for (let c = 0; c < 22; c++)
            if (gameBoard[r][c]) boardCards.push(gameBoard[r][c]);

    let sets, remainingHand;

    try {
        // ── Try Python server first ────────────────────────────────────────────
        const res = await fetch(`${PYTHON_SERVER}/computer-turn`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ hand: computerCards, boardCards })
        });
        if (!res.ok) throw new Error('server error');

        const data = await res.json();
        sets          = data.sets;
        remainingHand = data.remainingHand;

        if (sets.length > 0) {
            // Board already computed by Python — convert nested arrays
            gameBoard = data.board.map(row => row.map(cell => cell || null));
            computerCards = remainingHand;
        } else {
            computerCards.push(...drawCards(1));
        }

        setServerStatus(true);

    } catch {
        // ── Fallback: JS algorithm (Python server not running) ─────────────────
        setServerStatus(false);
        const result = greedyFindSets(computerCards, boardCards);

        if (result.sets.length > 0) {
            gameBoard     = placeSetsOnBoard(result.sets);
            computerCards = result.remainingHand;
        } else {
            computerCards.push(...drawCards(1));
        }
    }

    if (computerCards.length === 0) {
        setTimeout(() => { window.location.href = '../html/fail.html'; }, 400);
        return;
    }

    render();
    isPlayerTurn = true;
    saveState();
}

// ─── Server status indicator ──────────────────────────────────────────────────
function setServerStatus(online) {
    let indicator = document.getElementById('server-status');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'server-status';
        indicator.style.cssText =
            'position:fixed;bottom:10px;right:14px;font-size:12px;' +
            'padding:3px 8px;border-radius:10px;color:#fff;z-index:9999;opacity:0.85';
        document.body.appendChild(indicator);
    }
    indicator.textContent = online ? '🐍 Python' : '⚡ JS';
    indicator.style.background = online ? '#2a6' : '#555';
}

// ─── Message box ──────────────────────────────────────────────────────────────
function showMessageBox(text, yesLabel, noLabel, onYes, onNo) {
    const overlay = document.getElementById('overlay');
    document.getElementById('message-text').textContent = text;

    // Clone buttons to remove any old listeners
    ['right', 'left'].forEach(id => {
        const old  = document.getElementById(id);
        const fresh = old.cloneNode(true);
        old.parentNode.replaceChild(fresh, old);
    });

    const btnYes = document.getElementById('right');
    const btnNo  = document.getElementById('left');
    btnYes.textContent = yesLabel;
    btnNo.textContent  = noLabel;

    btnYes.addEventListener('click', () => { overlay.classList.remove('show'); onYes(); });
    btnNo.addEventListener('click',  () => { overlay.classList.remove('show'); onNo();  });

    overlay.classList.add('show');
}

// ─── Turn management ──────────────────────────────────────────────────────────
function endPlayerTurn() {
    if (!isBoardValid()) {
        showMessageBox(
            'המהלך שלך לא תקין :(',
            'נסה שוב',
            'קח קלף',
            () => restoreState(),
            () => { restoreState(); drawAndEndTurn(); }
        );
        return;
    }

    if (playerCards.length === 0) {
        window.location.href = '../html/win.html';
        return;
    }

    isPlayerTurn = false;
    setTimeout(async () => await computerTurn(), 800);
}

function drawAndEndTurn() {
    if (remainingDeck.length === 0) {
        alert('אין עוד קלפים בערימה!');
        return;
    }
    playerCards.push(...drawCards(1));
    isPlayerTurn = false;
    render();
    setTimeout(async () => await computerTurn(), 800);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function initGame() {
    remainingDeck = shuffledDeck();
    playerCards   = drawCards(14);
    computerCards = drawCards(14);
    gameBoard     = Array(5).fill(null).map(() => Array(22).fill(null));
    isPlayerTurn  = true;

    setupBoard();
    setupTrayDrop();
    render();
    saveState();
}

// ─── Event listeners ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initGame);

document.getElementById('addCard').addEventListener('click', () => {
    if (!isPlayerTurn) return;
    drawAndEndTurn();
});

document.getElementById('finishTurn').addEventListener('click', () => {
    if (!isPlayerTurn) return;
    endPlayerTurn();
});
