// Tests for taking a joker from the board (player). There is no special code for it:
// after the first meld the player may rearrange the board, every set must be valid at
// the end of the turn, and a tile from the board may not go back to the hand. These
// tests show that those rules together give the real joker-replacement rule.
// Run: node --test "tests/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endPlayerTurn } from '../js/game-logic.js';
import { playerTurn, drag, dragToTray, moveOnBoard } from './helpers.js';

test('replace a joker with the tile it stands for, and use the joker in a new set', () => {
    const state = playerTurn('R5 K9 B9 O1', [[0, 0, 'R4 J R6']]);
    state.playerOpened = true;
    moveOnBoard(state, 0, 1, 1, 2);                // the joker goes to row 1
    drag(state, 0, 1, 'R5');                       // R5 takes its place: R4 R5 R6
    drag(state, 1, 0, 'K9 B9');                    // K9 B9 J: a group of 9s
    assert.equal(endPlayerTurn(state), 'ok');
});

test('replace a joker in a group, and use it to extend a run', () => {
    const state = playerTurn('O7 R10 R11 K1', [[0, 0, 'K7 B7 J']]);
    state.playerOpened = true;
    moveOnBoard(state, 0, 2, 1, 2);                // joker → row 1, col 2
    drag(state, 0, 2, 'O7');                       // K7 B7 O7
    drag(state, 1, 0, 'R10 R11');                  // R10 R11 J: the joker is 12
    assert.equal(endPlayerTurn(state), 'ok');
});

test('the joker taken from the board may not go to the hand', () => {
    const state = playerTurn('R5 K1', [[0, 0, 'R4 J R6']]);
    state.playerOpened = true;
    dragToTray(state, 0, 1);                       // joker to the tray
    drag(state, 0, 1, 'R5');                       // the board itself is valid: R4 R5 R6
    assert.equal(endPlayerTurn(state), 'board-tile-taken');
});

test('replacing the joker with the wrong tile is rejected', () => {
    const state = playerTurn('R7 K9 B9 O1', [[0, 0, 'R4 J R6']]);
    state.playerOpened = true;
    moveOnBoard(state, 0, 1, 1, 2);
    drag(state, 0, 1, 'R7');                       // R4 R7 R6: not a run
    drag(state, 1, 0, 'K9 B9');
    assert.equal(endPlayerTurn(state), 'invalid');
});

test('taking the joker without putting anything in its place is rejected', () => {
    const state = playerTurn('K9 B9 O1', [[0, 0, 'R4 J R6']]);
    state.playerOpened = true;
    moveOnBoard(state, 0, 1, 1, 2);                // R4 _ R6 is left: two sets that are too short
    drag(state, 1, 0, 'K9 B9');
    assert.equal(endPlayerTurn(state), 'invalid');
});

test('before the first meld a joker cannot be taken from the board', () => {
    const state = playerTurn('R5 K10 B10 O10', [[0, 0, 'R4 J R6']]);
    moveOnBoard(state, 0, 1, 1, 3);
    drag(state, 0, 1, 'R5');
    drag(state, 1, 0, 'K10 B10 O10');              // 30 points, but the board was touched
    assert.equal(endPlayerTurn(state), 'opening-touched-board');
});
