// ─── Game state and turn logic (logic only, no DOM) ──────────────────────────
import { shuffledDeck, drawCards } from './tiles.js';
import { isBoardValid } from './rules.js';
import { matrixGreedyFindSets, countHandUsed, allBoardCardsPresent, placeSetsOnBoard } from './ai.js';

export const BOARD_ROWS = 5;
export const BOARD_COLS = 22;

export function emptyBoard() {
    return Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));
}

// ─── The whole game state, in one object ─────────────────────────────────────
export function createGame(random = Math.random) {
    const remainingDeck = shuffledDeck(random);
    const state = {
        remainingDeck,
        playerCards:   drawCards(remainingDeck, 14),   // the human player's tray
        computerCards: drawCards(remainingDeck, 14),
        gameBoard:     emptyBoard(),                    // 5×22, null = empty cell
        isPlayerTurn:  true,
        // Snapshot from the start of the player's turn — restored when the move is invalid
        savedBoard:  null,
        savedPlayer: null,
    };
    saveState(state);
    return state;
}

// ─── Save / Restore ───────────────────────────────────────────────────────────
export function saveState(state) {
    state.savedBoard  = state.gameBoard.map(row => [...row]);
    state.savedPlayer = [...state.playerCards];
}

export function restoreState(state) {
    state.gameBoard   = state.savedBoard.map(row => [...row]);
    state.playerCards = [...state.savedPlayer];
}

// ─── Check if board is identical to the saved snapshot ───────────────────────
export function boardMatchesSaved(state) {
    for (let r = 0; r < BOARD_ROWS; r++)
        for (let c = 0; c < BOARD_COLS; c++)
            if (JSON.stringify(state.gameBoard[r][c]) !== JSON.stringify(state.savedBoard[r][c]))
                return false;
    return true;
}

// ─── All cards on the board, row by row ──────────────────────────────────────
export function boardCardsOf(board) {
    const cards = [];
    for (const row of board)
        for (const cell of row)
            if (cell) cards.push(cell);
    return cards;
}

// ═══ Turn logic ═══════════════════════════════════════════════════════════════
// Moved from game-main.js. Same decisions; each function returns a result string
// and game-main.js shows the matching message / screen.

// ─── End of player's turn ─────────────────────────────────────────────────────
// 'no-move'    — nothing changed; player must play a tile or draw
// 'invalid'    — the board is not valid (UI offers Try Again / Take a Card)
// 'player-won' — player's tray is empty
// 'ok'         — turn passes to the computer
export function endPlayerTurn(state) {
    if (boardMatchesSaved(state) && state.playerCards.length >= state.savedPlayer.length)
        return 'no-move';
    if (!isBoardValid(state.gameBoard))
        return 'invalid';
    if (state.playerCards.length === 0)
        return 'player-won';
    state.isPlayerTurn = false;
    return 'ok';
}

// ─── Player draws and ends turn ───────────────────────────────────────────────
// 'deck-empty' — nothing drawn, still the player's turn
// 'ok'         — drew one card, turn passes to the computer
export function playerDraw(state) {
    if (state.remainingDeck.length === 0) return 'deck-empty';
    state.playerCards.push(...drawCards(state.remainingDeck, 1));
    state.isPlayerTurn = false;
    return 'ok';
}

// ─── Draw one card safely (computer) ─────────────────────────────────────────
function drawOneCard(state) {
    if (state.remainingDeck.length > 0) state.computerCards.push(...drawCards(state.remainingDeck, 1));
}

// ─── Apply the Python server's answer ─────────────────────────────────────────
// boardCards = the board cards that were sent to the server
export function applyServerMove(state, data, boardCards) {
    const handPlayed = countHandUsed(state.computerCards, boardCards, data.sets || []);

    if (data.sets.length > 0 && handPlayed > 0 && allBoardCardsPresent(boardCards, data.sets)) {
        state.gameBoard     = data.board.map(row => row.map(cell => cell || null));
        state.computerCards = data.remainingHand;
    } else {
        drawOneCard(state);
    }
}

// ─── Computer move with the JS algorithm (original) ──────────────────────────
export function applyComputerMove(state, boardCards) {
    const result = matrixGreedyFindSets(state.computerCards, boardCards);

    if (result.sets.length > 0) {
        state.gameBoard     = placeSetsOnBoard(result.sets);
        state.computerCards = result.remainingHand;
    } else {
        drawOneCard(state);
    }
}

// ─── After the computer moved ────────────────────────────────────────────────
// 'computer-won' — computer's hand is empty
// 'ok'           — turn passes to the player (and the board is saved for Try Again)
export function finishComputerTurn(state) {
    if (state.computerCards.length === 0) return 'computer-won';
    state.isPlayerTurn = true;
    saveState(state);
    return 'ok';
}
