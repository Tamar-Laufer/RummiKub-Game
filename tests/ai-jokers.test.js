// Tests for how the computer uses jokers (js/ai.js + game-logic.js)
// Run: node --test "tests/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, emptyBoard, applyComputerMove, finishComputerTurn, boardCardsOf } from '../js/game-logic.js';
import { tiles, show, put } from './helpers.js';

// Computer's turn with a given hand and board sets [row, col, text]
function computerTurn(hand, boardSets = [], opened = true) {
    const state = createGame();
    state.computerCards = tiles(hand);
    state.gameBoard = emptyBoard();
    for (const [row, col, text] of boardSets) put(state.gameBoard, row, col, text);
    state.computerOpened = opened;
    state.isPlayerTurn = false;
    applyComputerMove(state, boardCardsOf(state.gameBoard));
    return state;
}
const hand = state => show(state.computerCards).split(' ').filter(Boolean).sort().join(' ');
const boardSets = state => state.gameBoard.map(row => {
    const sets = []; let cur = [];
    for (const cell of [...row, null]) { if (cell) cur.push(cell); else if (cur.length) { sets.push(show(cur)); cur = []; } }
    return sets;
}).flat();

test('a joker completes a pair from the hand into a set', () => {
    const state = computerTurn('R5 K5 J O13 B1');
    assert.ok(boardSets(state).includes('R5 K5 J'), boardSets(state).join(' | '));
    assert.equal(hand(state), 'B1 O13');
});

test('the joker goes to the most valuable pair', () => {
    const state = computerTurn('R2 K2 R11 R12 J B7');
    assert.ok(boardSets(state).includes('R11 R12 J'), 'run 11-12-13 (36) beats group of 2s (6)');
    assert.equal(hand(state), 'B7 K2 R2');
});

test('a joker in a gap of a run', () => {
    const state = computerTurn('R8 R10 J K1');
    assert.ok(boardSets(state).includes('R8 J R10'));
});

test('a joker is not wasted when it does not help play more tiles', () => {
    const state = computerTurn('R5 R6 R7 J K1 B9');
    assert.ok(boardSets(state).includes('R5 R6 R7'));
    assert.ok(hand(state).includes('J'), 'the joker stays in the hand');
});

test('a leftover joker is added to a set when that empties the hand (win)', () => {
    const state = computerTurn('R5 R6 R7 J');
    assert.equal(state.computerCards.length, 0);
    assert.equal(finishComputerTurn(state), 'computer-won');
});

test('two jokers and one tile: one set, the hand is empty (win)', () => {
    const state = computerTurn('J j R9');
    assert.equal(state.computerCards.length, 0);
    assert.equal(finishComputerTurn(state), 'computer-won');
});

test('opening: a joker helps reach 30 (R9 J R11)', () => {
    const state = computerTurn('R9 R11 J K1 B2', [], false);
    assert.ok(boardSets(state).includes('R9 J R11'));
    assert.equal(state.computerOpened, true);
});

test('opening: with a joker but still under 30, the computer draws', () => {
    const state = computerTurn('R1 R2 J K13', [], false);
    assert.equal(boardCardsOf(state.gameBoard).length, 0);
    assert.equal(state.computerCards.length, 5, 'drew one tile');
});

test('a set with a joker on the board stays locked; the rest is still played', () => {
    const state = computerTurn('R7 K9 B9 O9', [[0, 0, 'R4 J R6']]);
    assert.ok(boardSets(state).includes('R4 J R6'), 'the joker set is unchanged');
    assert.ok(boardSets(state).includes('K9 B9 O9') || boardSets(state).includes('B9 K9 O9') ||
              boardSets(state).some(s => s.split(' ').sort().join(' ') === 'B9 K9 O9'), 'the 9s were played');
    assert.ok(hand(state).includes('R7'), 'R7 was not added to the locked joker set');
});

test('a joker set on the board does not stop the computer from rearranging the rest', () => {
    // free board set R4 R5 R6 + hand R7: the AI extends it; the joker set stays as is
    const state = computerTurn('R7 K1', [[0, 0, 'K8 J K10'], [1, 0, 'R4 R5 R6']]);
    assert.ok(boardSets(state).includes('K8 J K10'));
    assert.ok(boardSets(state).includes('R4 R5 R6 R7'));
});
