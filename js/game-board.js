// ─── Parse card ID ────────────────────────────────────────────────────────────
// Tray cards:  "tc-{index}"
// Board cards: "bc-{row}-{col}"
function parseCardId(id) {
    if (id.startsWith('tc-')) {
        const i = parseInt(id.slice(3));
        return { src: 'tray', i, card: playerCards[i] };
    }
    if (id.startsWith('bc-')) {
        const [r, c] = id.slice(3).split('-').map(Number);
        return { src: 'board', r, c, card: gameBoard[r][c] };
    }
    return null;
}

// ─── Drop handler for a board cell ───────────────────────────────────────────
function makeCellDroppable(cell, row, col) {
    cell.addEventListener('dragover', e => {
        e.preventDefault();
        cell.classList.add('dragover');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('dragover'));

    cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('dragover');
        if (!isPlayerTurn) return;

        const info = parseCardId(e.dataTransfer.getData('text/plain'));
        if (!info || !info.card) return;

        // Reject if target cell is occupied by a different card
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

// ─── Build the 5×22 game board ────────────────────────────────────────────────
function setupBoard() {
    const existing = document.querySelector('.game-board');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'game-board';

    for (let r = 0; r < 5; r++)
        for (let c = 0; c < 22; c++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.id = `cell-${r}-${c}`;
            makeCellDroppable(cell, r, c);
            container.appendChild(cell);
        }

    document.getElementById('board-area').appendChild(container);
}

// ─── Drop handler for the player's tray ──────────────────────────────────────
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
