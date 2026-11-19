// Tests for the computer's move (js/ai.js through game-logic.js)
// Run: node --test "tests/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyComputerMove, boardCardsOf, BOARD_ROWS, BOARD_COLS } from '../js/game-logic.js';
import { fitMoveOnBoard, matrixGreedyFindSets } from '../js/ai.js';
import { FULL_DECK } from '../js/tiles.js';

// Short tile notation, same as the playtest report: R=red K=black B=blue O=orange
const COLOR = { R: 'red', K: 'black', B: 'blue', O: 'orange' };
const tiles = text => text.split(' ').map(t => [COLOR[t[0]], Number(t.slice(1))]);
const sortedKeys = list => list.map(t => `${t[0]}${t[1]}`).sort();

// Put the cards on the board one after another (the AI only looks at the list of
// board cards, so the layout does not matter for this test)
function boardWith(cards) {
    const board = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));
    cards.forEach((card, i) => { board[Math.floor(i / BOARD_COLS)][i % BOARD_COLS] = card; });
    return board;
}

// State before turn 86 of playtest seed 2 (node tests/playtest.js --games 1 --seed 2 --dump-turn 86).
// The board is almost full: the computer's sets do not fit in 5 rows.
const SEED2_TURN86 = {
    computerCards: 'O12 O8 B6 O3 B13 R1 B2 B8 K3 B6 K13 B4 K2 K7 R5 O2 B1 B7 K12 R13 O6 O13 K10 R1 O4 O13 O6 K6 R13 O5 K1 B9 B11 K9 B11 B3',
    boardCards:    'K3 K4 K5 K5 B5 O5 K9 B9 O9 K11 K12 K13 R4 B4 O4 O1 O2 O3 R7 R8 R9 O8 O9 O10 O11 O12 R8 R9 R10 R11 K6 K7 K8 R2 K2 B2 B7 R7 O7 R2 R3 R4 R5 R6 K1 O1 B1 R10 R11 R12 B10 K10 O10',
    remainingDeck: 'K4 K8 B12',
};

test('computer move never loses tiles (playtest seed 2, turn 86: board almost full)', () => {
    const state = createGame();
    const boardCards    = tiles(SEED2_TURN86.boardCards);
    state.gameBoard     = boardWith(boardCards);
    state.computerCards = tiles(SEED2_TURN86.computerCards);
    state.remainingDeck = tiles(SEED2_TURN86.remainingDeck);

    const before = sortedKeys([...state.computerCards, ...boardCards, ...state.remainingDeck]);
    applyComputerMove(state, boardCards);
    const after = sortedKeys([...state.computerCards, ...boardCardsOf(state.gameBoard), ...state.remainingDeck]);

    assert.equal(after.length, before.length,
        `${before.length - after.length} tiles disappeared (computer hand + board + deck)`);
    assert.deepEqual(after, before);
});

test('the board is big enough for the AI to lay out all 104 tiles', () => {
    // Measured: the AI needs at most 7 rows, even with every tile on the board
    const deck = [...FULL_DECK];
    const move = fitMoveOnBoard(deck, [], matrixGreedyFindSets(deck, []).sets, BOARD_ROWS, BOARD_COLS);
    assert.deepEqual(move.remainingHand, [], 'every tile should be placed, none held back for lack of room');
});

// ─── Safety net (fitMoveOnBoard) on a tiny 1×22 board: 5 sets of 3 fit in a row, 6 do not ──
const SIX_SETS = ['R1 R2 R3', 'B5 K5 O5', 'R7 R8 R9', 'B10 K10 O10', 'K1 K2 K3', 'B1 B2 B3'].map(tiles);

test('safety net: everything fits → the move is unchanged', () => {
    const sets = SIX_SETS.slice(0, 5);
    const move = fitMoveOnBoard(sets.flat(), [], sets, 1, 22);
    assert.equal(move.sets.length, 5);
    assert.deepEqual(move.remainingHand, []);
});

test('safety net: a hand-only set that does not fit stays in the hand', () => {
    const move = fitMoveOnBoard(SIX_SETS.flat(), [], SIX_SETS, 1, 22);
    assert.equal(move.sets.length, 5);
    assert.deepEqual(sortedKeys(move.remainingHand), sortedKeys(tiles('B1 B2 B3')));
    assert.equal(boardCardsOf(move.board).length, 15);
});

test('safety net: a set with board tiles is never dropped', () => {
    const boardCards = tiles('B1 B2 B3');            // the last set uses tiles already on the board
    const hand = SIX_SETS.slice(0, 5).flat();
    const move = fitMoveOnBoard(hand, boardCards, SIX_SETS, 1, 22);
    const onBoard = sortedKeys(boardCardsOf(move.board));
    for (const k of sortedKeys(boardCards)) assert.ok(onBoard.includes(k), `${k} must stay on the board`);
    assert.deepEqual(sortedKeys(move.remainingHand), sortedKeys(tiles('K1 K2 K3')));   // dropped instead
});

test('safety net: no room even for the board tiles → no move (computer draws)', () => {
    const boardCards = SIX_SETS.flat();               // 6 sets already "on the board" need 2 rows
    const hand = tiles('O7 O8 O9');
    assert.equal(fitMoveOnBoard(hand, boardCards, [...SIX_SETS, hand], 1, 22), null);
});
