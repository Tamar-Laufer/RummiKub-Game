// Tests for computer turns where it drew although it could play from its hand.
// Positions taken from the playtest bot (node tests/playtest.js --games 1 --seed N --dump-turn T).
// Run: node --test "tests/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, emptyBoard, applyComputerMove, boardCardsOf, handValue } from '../js/game-logic.js';
import { isBoardValid } from '../js/rules.js';
import { matrixGreedyFindSets } from '../js/ai.js';
import { tiles, show, put } from './helpers.js';

function computerTurn(hand, boardSets, opened) {
    const state = createGame();
    state.computerCards = tiles(hand);
    state.gameBoard = emptyBoard();
    for (const [row, col, text] of boardSets) put(state.gameBoard, row, col, text);
    state.computerOpened = opened;
    state.isPlayerTurn = false;
    const boardBefore = boardCardsOf(state.gameBoard).map(t => t.join('-')).sort();
    const handBefore = state.computerCards.length;
    applyComputerMove(state, boardCardsOf(state.gameBoard));
    return { state, boardBefore, handBefore };
}

// Bug A — seed 1, turn 20: after its first meld the computer drew, although K2 O2 R2
// from its hand could simply be put on the board.
test('after its first meld: a set from the hand is played even if the AI cannot rebuild the whole board', () => {
    const { state, boardBefore, handBefore } = computerTurn(
        'B7 B13 R13 O12 K2 R9 O6 O2 R5 O2 K1 R7 R2',
        [[0, 0, 'R6 R7 R8'], [0, 4, 'O12 K12 B12'], [0, 8, 'B9 B10 J'], [0, 12, 'B1 O1 K1'], [0, 16, 'R5 K5 B5'],
         [1, 0, 'K4 B4 O4'], [1, 4, 'O8 O9 O10']],
        true);
    assert.ok(state.computerCards.length < handBefore,
        `the computer should play, but it kept ${state.computerCards.length} tiles: ${show(state.computerCards)}`);
    assert.ok(isBoardValid(state.gameBoard), 'the board stays valid');
    const after = boardCardsOf(state.gameBoard).map(t => t.join('-'));
    for (const k of boardBefore) {
        const i = after.indexOf(k);
        assert.ok(i >= 0, `${k} must stay on the board`);
        after.splice(i, 1);
    }
});

// Bug B — seed 12, turn 24: before its first meld the computer drew with 25 tiles,
// although B3 B4 B5 B6 + O3 O4 O5 (+ R1 B1 O1) are worth 33.
test('first meld: the computer opens when its hand has sets worth 30+', () => {
    const { state } = computerTurn(
        'K9 O11 K10 R1 K2 B6 O9 O3 R6 B11 O3 B1 B4 O1 O13 B10 K13 B3 B5 B8 R5 O4 O8 R1 O5',
        [[0, 0, 'K3 K4 K5'], [0, 4, 'O2 B2 R2'], [0, 8, 'O13 R13 J']],
        false);
    assert.equal(state.computerOpened, true,
        `the computer should open, but it drew; hand ${state.computerCards.length} tiles`);
    assert.ok(isBoardValid(state.gameBoard));
});

// Fix A: after the first meld the computer compares two moves — rebuilding the board,
// and putting sets from its hand only into free space — and plays the one that removes
// more points from its hand.
test('after its first meld: the move removes at least as many points as the hand-only option', () => {
    // hand-only: K10 B10 O10 (30) + R11 R12 R13 (36) = 66; any rebuild must not do worse
    const { state, handBefore } = computerTurn('K10 B10 O10 R11 R12 R13 K1', [[0, 0, 'R1 R2 R3'], [0, 4, 'K5 B5 O5']], true);
    const removed = handValue(tiles('K10 B10 O10 R11 R12 R13 K1')) - handValue(state.computerCards);
    assert.ok(removed >= 66, `removed only ${removed} points; hand now ${show(state.computerCards)} (was ${handBefore} tiles)`);
    assert.ok(isBoardValid(state.gameBoard));
});

// Fix B: the algorithm runs with all 24 color orders and both preferences, and keeps
// the result that removes the most points. The seed-12 hand: with red first it locks
// R5 B5 O5 and finds 18 points; another order finds B3-B6 + O3-O5 (+ R1 B1 O1).
test('the algorithm keeps the color order that removes the most points', () => {
    const hand = tiles('K9 O11 K10 R1 K2 B6 O9 O3 R6 B11 O3 B1 B4 O1 O13 B10 K13 B3 B5 B8 R5 O4 O8 R1 O5');
    const { sets, remainingHand } = matrixGreedyFindSets(hand, []);
    const removed = handValue(hand) - handValue(remainingHand);
    assert.ok(removed >= 33, `only ${removed} points: ${sets.map(s => show(s)).join(' | ')}`);
});
