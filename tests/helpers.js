// Shared helpers for the tests (not a test file itself: it does not end in .test.js)
import assert from 'node:assert/strict';
import { createGame, emptyBoard, saveState } from '../js/game-logic.js';

// Short tile notation: R=red K=black B=blue O=orange, J=red joker, j=black joker,
// e.g. tiles('R1 J R3')
export const COLOR = { R: 'red', K: 'black', B: 'blue', O: 'orange' };
export const tiles = text => text.split(' ').map(t =>
    t === 'J' ? ['joker', 'red'] : t === 'j' ? ['joker', 'black'] : [COLOR[t[0]], Number(t.slice(1))]);
export const show = list => list.map(t =>
    t[0] === 'joker' ? (t[1] === 'red' ? 'J' : 'j') : Object.keys(COLOR).find(k => COLOR[k] === t[0]) + t[1]).join(' ');

// Put a set on the board from (row, col) to the right
export function put(board, row, col, text) {
    tiles(text).forEach((t, i) => { board[row][col + i] = t; });
}
export const rowText = (board, row, from, to) => show(board[row].slice(from, to).filter(Boolean));

// Player's turn: given hand, given board sets [row, col, text]; snapshot = start of turn
export function playerTurn(hand, boardSets = []) {
    const state = createGame();
    state.playerCards = tiles(hand);
    state.gameBoard = emptyBoard();
    for (const [row, col, text] of boardSets) put(state.gameBoard, row, col, text);
    state.isPlayerTurn = true;
    saveState(state);
    return state;
}

// Same as dragging tiles from the tray to board cells (row, col), (row, col+1), ...
export function drag(state, row, col, text) {
    for (const t of tiles(text)) {
        const i = state.playerCards.findIndex(x => x[0] === t[0] && x[1] === t[1]);
        assert.ok(i >= 0, `tile ${t} must be in the hand`);
        state.gameBoard[row][col++] = state.playerCards.splice(i, 1)[0];
    }
}

// Same as dragging the tile at board cell (row, col) back to the tray
export function dragToTray(state, row, col) {
    const tile = state.gameBoard[row][col];
    assert.ok(tile, `cell ${row},${col} must have a tile`);
    state.gameBoard[row][col] = null;
    state.playerCards.push(tile);
}

// Same as dragging the tile at board cell (row, col) to another board cell
export function moveOnBoard(state, row, col, toRow, toCol) {
    assert.ok(!state.gameBoard[toRow][toCol], `cell ${toRow},${toCol} must be empty`);
    state.gameBoard[toRow][toCol] = state.gameBoard[row][col];
    state.gameBoard[row][col] = null;
}
