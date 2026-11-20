// Small local moves after the algorithm: add a hand tile to the edge of a board set,
// or borrow an edge tile from a long set to complete a pair from the hand.
// Both cases were found in the browser with ?debug: the computer drew although it could play.
// Run: node --test "tests/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, emptyBoard, applyComputerMove, boardCardsOf, handValue } from '../js/game-logic.js';
import { isBoardValid, segmentsOf } from '../js/rules.js';
import { tiles, show, put } from './helpers.js';

function computerTurn(hand, boardSets) {
    const state = createGame();
    state.computerCards = tiles(hand);
    state.gameBoard = emptyBoard();
    for (const [row, col, text] of boardSets) put(state.gameBoard, row, col, text);
    state.computerOpened = true;
    state.isPlayerTurn = false;
    const boardBefore = boardCardsOf(state.gameBoard).map(t => t.join('-'));
    const report = applyComputerMove(state, boardCardsOf(state.gameBoard));
    return { state, boardBefore, report };
}

function assertBoardKept(state, boardBefore) {
    assert.ok(isBoardValid(state.gameBoard), 'the board stays valid');
    const after = boardCardsOf(state.gameBoard).map(t => t.join('-'));
    for (const k of boardBefore) {
        const i = after.indexOf(k);
        assert.ok(i >= 0, `${k} must stay on the board`);
        after.splice(i, 1);
    }
}
const boardSetsText = board => segmentsOf(board).map(s => show(s.tiles));

// Case 1: a set with a joker was locked for the computer, so it never added to it.
// O6 in the hand, O7 O8 J on the board (J = O9) → O6 O7 O8 J.
test('a hand tile is added to the start of a run with a joker', () => {
    for (const col of [4, 0]) {   // col 0: no room on the left, so the set has to move
        const { state, boardBefore, report } = computerTurn('O6 R12 B1 K3', [[0, col, 'O7 O8 J'], [1, 0, 'R5 B5 K5']]);
        assert.equal(report.result, 'played', `col ${col}: the computer drew (${report.reason})`);
        assert.equal(show(state.computerCards), 'R12 B1 K3');
        assert.ok(boardSetsText(state.gameBoard).includes('O6 O7 O8 J'),
            `col ${col}: expected O6 O7 O8 J on the board, got ${boardSetsText(state.gameBoard).join(' | ')}`);
        assertBoardKept(state, boardBefore);
    }
});

// Case 2: the board from the screenshot. The rebuild of the whole board failed, and there
// was no small move. Possible: O3 → O3-O8, or borrow O4 → R4 B4 O4 (O5-O8 stays a run).
test('the computer plays a small move on a big board (add to an edge / borrow a tile)', () => {
    const hand = 'B4 B5 B5 B8 B10 B12 O3 O6 R3 R4 R7 R8';
    const { state, boardBefore, report } = computerTurn(hand, [
        [0, 4, 'R1 K1 B1'], [0, 8, 'R10 K10 B10'], [0, 13, 'R11 B11 K11'],
        [1, 0, 'R8 B8 O8'], [1, 4, 'K6 K7 K8 K9'], [1, 10, 'R2 K2 B2 O2'], [1, 16, 'R13 O13 K13'],
        [3, 7, 'K9 K10 K11'],
        [4, 1, 'B4 J B6'], [4, 12, 'O10 O11 O12'],
        [5, 6, 'O4 O5 O6 O7 O8'],
    ]);
    assert.equal(report.result, 'played', `the computer drew (${report.reason})`);
    const left = show(state.computerCards).split(' ');
    assert.ok(!left.includes('O3') || (!left.includes('R4') && left.filter(t => t === 'B4').length === 0),
        `expected O3 or R4+B4 to be played; hand now ${show(state.computerCards)}`);
    const removed = handValue(tiles(hand)) - handValue(state.computerCards);
    assert.ok(removed >= 8, `removed only ${removed} points`);
    assertBoardKept(state, boardBefore);
});
