// ─── Game state and turn logic (logic only, no DOM) ──────────────────────────
import { shuffledDeck, drawCards } from './tiles.js';
import { isBoardValid } from './rules.js';
import { matrixGreedyFindSets, fitMoveOnBoard, computeRemainingHand } from './ai.js';

// 7 rows: measured with the bot, the AI never needs more (even with all 104 tiles on
// the board). Must match grid-template-rows in css/game.css.
export const BOARD_ROWS = 7;
export const BOARD_COLS = 22;

export function emptyBoard() {
    return Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));
}

// ─── The whole game state, in one object ─────────────────────────────────────
// options.deckSize (test mode only): after dealing, keep only this many tiles in
// the deck, so the end of the game is reached quickly. The other tiles leave the game.
export function createGame(random = Math.random, options = {}) {
    const remainingDeck = shuffledDeck(random);
    const state = {
        remainingDeck,
        playerCards:   drawCards(remainingDeck, 14),   // the human player's tray
        computerCards: drawCards(remainingDeck, 14),
        gameBoard:     emptyBoard(),                    // 7×22, null = empty cell
        isPlayerTurn:  true,
        // Snapshot from the start of the player's turn — restored when the move is invalid
        savedBoard:  null,
        savedPlayer: null,
        // Turns in a row that ended without placing tiles while the deck was empty.
        // Two in a row = nobody can play → the game ends (see endIfBlocked).
        passesInRow: 0,
        winner: null,   // set when a blocked game ends: 'player' | 'computer' | 'tie'
        // First meld done? Before it: 30+ points from the hand, and no touching the board.
        playerOpened:   false,
        computerOpened: false,
    };
    if (options.deckSize !== undefined) remainingDeck.splice(options.deckSize);
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

// ═══ First meld (opening) ═════════════════════════════════════════════════════
// Before a player's first meld, every set that was on the board at the start of
// the turn must stay exactly as it was (same tiles, same place), and the new sets
// must be worth at least 30 points.
export const OPENING_POINTS = 30;

// Sets on the board = row segments of adjacent tiles (same rule as isBoardValid)
function segmentsOf(board) {
    const segments = [];
    board.forEach((row, r) => {
        let cur = null;
        for (let c = 0; c <= row.length; c++) {
            const tile = c < row.length ? row[c] : null;
            if (tile) {
                if (!cur) cur = { row: r, col: c, tiles: [] };
                cur.tiles.push(tile);
            } else if (cur) {
                segments.push(cur);
                cur = null;
            }
        }
    });
    return segments;
}
const segmentKey = s => `${s.row}:${s.col}:` + s.tiles.map(t => t.join('')).join(',');

// Did any set from the start of the turn change, move or disappear?
function touchedBoardSets(state) {
    const now = new Set(segmentsOf(state.gameBoard).map(segmentKey));
    return segmentsOf(state.savedBoard).some(s => !now.has(segmentKey(s)));
}

// Points of the sets the player added this turn (the sets already on the board don't count)
export function openingMeldPoints(state) {
    const before = new Set(segmentsOf(state.savedBoard).map(segmentKey));
    const added = segmentsOf(state.gameBoard).filter(s => !before.has(segmentKey(s)));
    return handValue(added.flatMap(s => s.tiles));
}

// ═══ Turn logic ═══════════════════════════════════════════════════════════════
// Moved from game-main.js. Same decisions; each function returns a result string
// and game-main.js shows the matching message / screen.

// ─── End of player's turn ─────────────────────────────────────────────────────
// 'no-move'               — nothing changed; player must play a tile or draw
// 'invalid'               — the board is not valid (UI offers Try Again / Take a Card)
// 'opening-touched-board' — first meld, but a set already on the board was changed/moved
// 'opening-too-low'       — first meld worth less than 30 (see openingMeldPoints)
// 'player-won'            — player's tray is empty
// 'ok'                    — turn passes to the computer
export function endPlayerTurn(state) {
    if (boardMatchesSaved(state) && state.playerCards.length >= state.savedPlayer.length)
        return 'no-move';
    if (!isBoardValid(state.gameBoard))
        return 'invalid';
    if (!state.playerOpened) {
        if (touchedBoardSets(state)) return 'opening-touched-board';
        if (openingMeldPoints(state) < OPENING_POINTS) return 'opening-too-low';
        state.playerOpened = true;
    }
    if (state.playerCards.length === 0)
        return 'player-won';
    state.passesInRow  = 0;
    state.isPlayerTurn = false;
    return 'ok';
}

// ─── Player draws and ends turn ───────────────────────────────────────────────
// 'ok'        — drew one card, turn passes to the computer
// 'passed'    — deck is empty: the player passes, turn passes to the computer
// 'game-over' — deck is empty and both players passed in a row (see state.winner)
export function playerDraw(state) {
    state.isPlayerTurn = false;
    if (state.remainingDeck.length === 0) {
        state.passesInRow++;
        return endIfBlocked(state) ? 'game-over' : 'passed';
    }
    state.playerCards.push(...drawCards(state.remainingDeck, 1));
    state.passesInRow = 0;
    return 'ok';
}

// ─── Draw one card, or pass if the deck is empty (computer) ──────────────────
function drawOneCard(state) {
    if (state.remainingDeck.length > 0) {
        state.computerCards.push(...drawCards(state.remainingDeck, 1));
        state.passesInRow = 0;
    } else {
        state.passesInRow++;
    }
}

// ─── Blocked game: deck empty and nobody can play ────────────────────────────
// Rule: the player with the lowest sum of tiles in hand wins.
export function handValue(tiles) {
    return tiles.reduce((sum, t) => sum + t[1], 0);
}

// Passes are only counted while the deck is empty, so two in a row means both
// players passed one after the other.
function endIfBlocked(state) {
    if (state.remainingDeck.length > 0 || state.passesInRow < 2) return false;
    const player = handValue(state.playerCards), computer = handValue(state.computerCards);
    state.winner = player < computer ? 'player' : computer < player ? 'computer' : 'tie';
    return true;
}

// ─── Computer move (the AI in ai.js) ─────────────────────────────────────────
export function applyComputerMove(state, boardCards) {
    const move = state.computerOpened ? fullMove(state, boardCards) : openingMove(state);

    if (move) {
        state.gameBoard      = move.board;
        state.computerCards  = move.remainingHand;
        state.passesInRow    = 0;
        state.computerOpened = true;
    } else {
        drawOneCard(state);
    }
}

// After the first meld: the AI rebuilds the whole board from board tiles + its hand.
function fullMove(state, boardCards) {
    const result = matrixGreedyFindSets(state.computerCards, boardCards);
    // Safety net: only the part of the move that fits on the board (null = nothing fits)
    return result.sets.length > 0
        ? fitMoveOnBoard(state.computerCards, boardCards, result.sets, BOARD_ROWS, BOARD_COLS)
        : null;
}

// Before the first meld: the same AI, but it sees only its own hand (so it cannot
// touch the board). Its sets go into free space next to the existing sets, and the
// move counts only if the placed sets are worth 30+ points.
function openingMove(state) {
    const { sets } = matrixGreedyFindSets(state.computerCards, []);
    const placed = addSetsInFreeSpace(state.gameBoard, sets);
    if (handValue(placed.sets.flat()) < OPENING_POINTS) return null;
    return { board: placed.board, remainingHand: computeRemainingHand(state.computerCards, [], placed.sets) };
}

// Puts each set into the first empty space with an empty cell (or the edge) on both
// sides, so it does not join an existing set. Sets with no room are skipped.
function addSetsInFreeSpace(board, sets) {
    const out = board.map(row => [...row]);
    const placedSets = [];
    for (const set of sets) {
        const pos = findFreeSpace(out, set.length);
        if (!pos) continue;
        set.forEach((tile, i) => { out[pos.r][pos.c + i] = tile; });
        placedSets.push(set);
    }
    return { board: out, sets: placedSets };
}

function findFreeSpace(board, len) {
    for (let r = 0; r < board.length; r++) {
        const cols = board[r].length;
        for (let c = 0; c + len <= cols; c++) {
            let ok = (c === 0 || !board[r][c - 1]) && (c + len === cols || !board[r][c + len]);
            for (let i = 0; ok && i < len; i++) if (board[r][c + i]) ok = false;
            if (ok) return { r, c };
        }
    }
    return null;
}

// ─── After the computer moved ────────────────────────────────────────────────
// 'computer-won' — computer's hand is empty
// 'game-over'    — deck is empty and both players passed in a row (see state.winner)
// 'ok'           — turn passes to the player (and the board is saved for Try Again)
export function finishComputerTurn(state) {
    if (state.computerCards.length === 0) return 'computer-won';
    if (endIfBlocked(state)) return 'game-over';
    state.isPlayerTurn = true;
    saveState(state);
    return 'ok';
}
