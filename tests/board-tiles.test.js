// Tests for the rule: tiles that were on the board at the start of a turn stay on the board.
// Run: node --test "tests/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as logic from '../js/game-logic.js';
import { tiles, show, put, playerTurn, drag, dragToTray, moveOnBoard } from './helpers.js';

const { createGame, emptyBoard, endPlayerTurn, applyComputerMove, boardCardsOf } = logic;

// ─── Player ───────────────────────────────────────────────────────────────────

test('after opening: taking a board tile back to the tray is rejected', () => {
    const state = playerTurn('K1', [[0, 0, 'R5 K5 B5 O5']]);
    state.playerOpened = true;
    dragToTray(state, 0, 3);                       // O5 back to the tray; R5 K5 B5 is still a valid group
    assert.equal(endPlayerTurn(state), 'board-tile-taken');
    assert.equal(show(logic.boardTilesTaken(state)), 'O5', 'the message can name the tile');
    assert.equal(state.isPlayerTurn, true, 'turn does not pass');
});

test('after opening: taking a board tile back while also playing other tiles is rejected', () => {
    const state = playerTurn('R10 R11 R12 K1', [[0, 0, 'R5 K5 B5 O5']]);
    state.playerOpened = true;
    dragToTray(state, 0, 3);
    drag(state, 1, 0, 'R10 R11 R12');
    assert.equal(endPlayerTurn(state), 'board-tile-taken');
});

test('before opening: taking a board tile back gets the same clear rejection', () => {
    const state = playerTurn('R10 R11 R12 K1', [[0, 0, 'R5 K5 B5 O5']]);
    dragToTray(state, 0, 3);
    drag(state, 1, 0, 'R10 R11 R12');              // 33 points, would be a valid opening
    assert.equal(endPlayerTurn(state), 'board-tile-taken');
});

test('returning a tile placed in the same turn is still allowed', () => {
    const state = playerTurn('R6 R7 K1', [[0, 0, 'R3 R4 R5']]);
    state.playerOpened = true;
    drag(state, 0, 3, 'R6 R7');                    // R3..R7
    dragToTray(state, 0, 4);                       // changed my mind: R7 back to the tray
    assert.equal(endPlayerTurn(state), 'ok');
    assert.ok(show(state.playerCards).includes('R7'));
});

test('after opening: moving a board tile to another set on the board is allowed', () => {
    const state = playerTurn('O6 O7 K1', [[0, 0, 'R5 K5 B5 O5']]);
    state.playerOpened = true;
    moveOnBoard(state, 0, 3, 1, 0);                // O5 to a new row
    drag(state, 1, 1, 'O6 O7');                    // O5 O6 O7
    assert.equal(endPlayerTurn(state), 'ok');
});

// ─── Computer ─────────────────────────────────────────────────────────────────

test('computer: after opening, every board tile stays on the board', () => {
    const state = createGame();
    state.gameBoard = emptyBoard();
    put(state.gameBoard, 0, 0, 'R4 R5 R6');
    put(state.gameBoard, 1, 0, 'K9 B9 O9');
    state.computerCards = tiles('R7 K2 O13 B9');
    state.computerOpened = true;
    const before = boardCardsOf(state.gameBoard).map(t => t.join('')).sort();
    applyComputerMove(state, boardCardsOf(state.gameBoard));
    const after = boardCardsOf(state.gameBoard).map(t => t.join(''));
    for (const k of before) {
        const i = after.indexOf(k);
        assert.ok(i >= 0, `${k} must still be on the board`);
        after.splice(i, 1);
    }
});
