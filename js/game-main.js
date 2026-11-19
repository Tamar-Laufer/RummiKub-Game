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

// ─── Check if board is identical to the saved snapshot ───────────────────────
function boardMatchesSaved() {
    for (let r = 0; r < 5; r++)
        for (let c = 0; c < 22; c++)
            if (JSON.stringify(gameBoard[r][c]) !== JSON.stringify(savedBoard[r][c]))
                return false;
    return true;
}

// ─── Computer turn ────────────────────────────────────────────────────────────
async function computerTurn() {
    updateTurnIndicator(false);

    const boardCards = [];
    for (let r = 0; r < 5; r++)
        for (let c = 0; c < 22; c++)
            if (gameBoard[r][c]) boardCards.push(gameBoard[r][c]);

    try {
        // ── Python server (optional) ───────────────────────────────────────────
        const res = await fetch(`${PYTHON_SERVER}/computer-turn`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ hand: computerCards, boardCards })
        });
        if (!res.ok) throw new Error('server error');

        const data = await res.json();
        const handPlayed = countHandUsed(computerCards, boardCards, data.sets || []);

        if (data.sets.length > 0 && handPlayed > 0 && allBoardCardsPresent(boardCards, data.sets)) {
            gameBoard     = data.board.map(row => row.map(cell => cell || null));
            computerCards = data.remainingHand;
        } else {
            drawOneCard();
        }
        setServerStatus(true);

    } catch {
        // ── JS fallback (original algorithm) ──────────────────────────────────
        setServerStatus(false);
        const result = matrixGreedyFindSets(computerCards, boardCards);

        if (result.sets.length > 0) {
            gameBoard     = placeSetsOnBoard(result.sets);
            computerCards = result.remainingHand;
        } else {
            drawOneCard();
        }
    }

    if (computerCards.length === 0) {
        render();
        setTimeout(() => showEndScreen(false), 400);
        return;
    }

    render();
    updateCardCounts();
    isPlayerTurn = true;
    saveState();
    updateTurnIndicator(true);
}

// ─── Draw one card safely ─────────────────────────────────────────────────────
function drawOneCard() {
    if (remainingDeck.length > 0) computerCards.push(...drawCards(1));
}

// ─── End of player's turn ─────────────────────────────────────────────────────
function endPlayerTurn() {
    // Player must do something: either move a tile or draw
    if (boardMatchesSaved() && playerCards.length >= savedPlayer.length) {
        showMessageBox(
            'You must play a tile or draw a card!',
            'OK', 'OK', () => {}, () => {}
        );
        return;
    }

    if (!isBoardValid()) {
        showMessageBox(
            'Invalid move — the board is not valid.',
            'Try Again', 'Take a Card',
            () => restoreState(),
            () => { restoreState(); drawAndEndTurn(); }
        );
        return;
    }

    if (playerCards.length === 0) { showEndScreen(true); return; }

    isPlayerTurn = false;
    updateCardCounts();
    setTimeout(async () => await computerTurn(), 800);
}

// ─── Player draws and ends turn ───────────────────────────────────────────────
function drawAndEndTurn() {
    if (remainingDeck.length === 0) {
        showMessageBox('The deck is empty!', 'OK', 'OK', () => {}, () => {});
        return;
    }
    playerCards.push(...drawCards(1));
    isPlayerTurn = false;
    render();
    updateCardCounts();
    setTimeout(async () => await computerTurn(), 800);
}

// ─── Initialise game ──────────────────────────────────────────────────────────
function initGame() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && currentUser.username) {
        const nameEl = document.getElementById('human-name');
        if (nameEl) nameEl.textContent = currentUser.username;
    }

    remainingDeck = shuffledDeck();
    playerCards   = drawCards(14);
    computerCards = drawCards(14);
    gameBoard     = Array(5).fill(null).map(() => Array(22).fill(null));
    isPlayerTurn  = true;

    setupBoard();
    setupTrayDrop();
    render();
    saveState();
    updateTurnIndicator(true);
    updateCardCounts();
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
