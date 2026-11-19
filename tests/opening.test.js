// Tests for the first meld (opening) rule: 30+ points, and no touching the board before it.
// Run: node --test "tests/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as logic from '../js/game-logic.js';

const { createGame, emptyBoard, saveState, endPlayerTurn, applyComputerMove, boardCardsOf } = logic;

// Short tile notation: R=red K=black B=blue O=orange
const COLOR = { R: 'red', K: 'black', B: 'blue', O: 'orange' };
const tiles = text => text.split(' ').map(t => [COLOR[t[0]], Number(t.slice(1))]);
const show = list => list.map(t => Object.keys(COLOR).find(k => COLOR[k] === t[0]) + t[1]).join(' ');

function put(board, row, col, text) {
    tiles(text).forEach((t, i) => { board[row][col + i] = t; });
}
const rowText = (board, row, from, to) => show(board[row].slice(from, to).filter(Boolean));

// Player's turn: given hand, given board sets [row, col, text]; snapshot = start of turn
function playerTurn(hand, boardSets = []) {
    const state = createGame();
    state.playerCards = tiles(hand);
    state.gameBoard = emptyBoard();
    for (const [row, col, text] of boardSets) put(state.gameBoard, row, col, text);
    state.isPlayerTurn = true;
    saveState(state);
    return state;
}

// Same as dragging tiles from the tray to board cells (row, col), (row, col+1), ...
function drag(state, row, col, text) {
    for (const t of tiles(text)) {
        const i = state.playerCards.findIndex(x => x[0] === t[0] && x[1] === t[1]);
        assert.ok(i >= 0, `tile ${t} must be in the hand`);
        state.gameBoard[row][col++] = state.playerCards.splice(i, 1)[0];
    }
}

// ─── Player ───────────────────────────────────────────────────────────────────

test('player: first meld under 30 is rejected, and the message can show the points', () => {
    const state = playerTurn('R1 R2 R3 K13 B9');
    drag(state, 0, 0, 'R1 R2 R3');
    assert.equal(endPlayerTurn(state), 'opening-too-low');
    assert.equal(logic.openingMeldPoints(state), 6);
    assert.equal(state.isPlayerTurn, true, 'turn does not pass');
});

test('player: first meld of exactly 30 is accepted', () => {
    const state = playerTurn('R9 R10 R11 K1');
    drag(state, 0, 0, 'R9 R10 R11');
    assert.equal(endPlayerTurn(state), 'ok');
    assert.equal(state.playerOpened, true);
});

test('player: two sets that together reach 30 are accepted', () => {
    const state = playerTurn('R1 R2 R3 K8 B8 O8 K1');
    drag(state, 0, 0, 'R1 R2 R3');
    drag(state, 1, 0, 'K8 B8 O8');                 // 6 + 24 = 30
    assert.equal(endPlayerTurn(state), 'ok');
});

test('player: only the new tiles count, not the sets already on the board', () => {
    const state = playerTurn('R1 R2 R3 K1', [[0, 0, 'K11 B11 O11']]);
    drag(state, 2, 0, 'R1 R2 R3');
    assert.equal(endPlayerTurn(state), 'opening-too-low');
    assert.equal(logic.openingMeldPoints(state), 6);
});

test('player: before the first meld, adding to a set on the board is rejected', () => {
    const state = playerTurn('R5 R10 R11 R12', [[0, 0, 'K5 B5 O5']]);
    drag(state, 0, 3, 'R5');                       // K5 B5 O5 + R5: a valid group, but touches the board
    drag(state, 1, 0, 'R10 R11 R12');              // 33 points
    assert.equal(endPlayerTurn(state), 'opening-touched-board');
});

test('player: before the first meld, moving a set on the board is rejected', () => {
    const state = playerTurn('R10 R11 R12', [[0, 0, 'K5 B5 O5']]);
    const moved = state.gameBoard[0].slice(0, 3);
    state.gameBoard[0].fill(null, 0, 3);
    moved.forEach((t, i) => { state.gameBoard[2][5 + i] = t; });
    drag(state, 1, 0, 'R10 R11 R12');
    assert.equal(endPlayerTurn(state), 'opening-touched-board');
});

test('player: after the first meld, adding to a set on the board is allowed', () => {
    const state = playerTurn('R5 K1', [[0, 0, 'K5 B5 O5']]);
    state.playerOpened = true;
    drag(state, 0, 3, 'R5');
    assert.equal(endPlayerTurn(state), 'ok');
});

// ─── Computer ─────────────────────────────────────────────────────────────────

function computerTurn(hand, boardSets = [], opened = false) {
    const state = createGame();
    state.computerCards = tiles(hand);
    state.gameBoard = emptyBoard();
    for (const [row, col, text] of boardSets) put(state.gameBoard, row, col, text);
    state.computerOpened = opened;
    state.isPlayerTurn = false;
    return state;
}

test('computer: does not open with less than 30 (draws instead)', () => {
    const state = computerTurn('R1 R2 R3 K13 B9 O11');
    applyComputerMove(state, boardCardsOf(state.gameBoard));
    assert.equal(boardCardsOf(state.gameBoard).length, 0, 'nothing placed');
    assert.equal(state.computerCards.length, 7, 'drew one tile');
});

test('computer: opens with 30+ from its hand and leaves the board sets untouched', () => {
    const state = computerTurn('K10 B10 O10 R7 K2', [[0, 0, 'R4 R5 R6']]);
    applyComputerMove(state, boardCardsOf(state.gameBoard));
    assert.equal(rowText(state.gameBoard, 0, 0, 3), 'R4 R5 R6', 'the player set stays where it was');
    assert.equal(state.gameBoard[0][3], null, 'nothing added to the player set');
    assert.ok(show(boardCardsOf(state.gameBoard)).includes('K10'), 'the 10s group is on the board');
    assert.ok(show(state.computerCards).includes('R7'), 'R7 stays in the hand (no board tiles before opening)');
    assert.equal(state.computerOpened, true);
});

test('computer: after opening, it may use tiles on the board again', () => {
    const state = computerTurn('K10 B10 O10 R7 K2', [[0, 0, 'R4 R5 R6']], true);
    applyComputerMove(state, boardCardsOf(state.gameBoard));
    assert.ok(!show(state.computerCards).includes('R7'), 'R7 joined the run on the board');
});
