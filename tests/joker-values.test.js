// Tests for joker values: 30 in the hand at the end, the value it stands for in the opening
// Run: node --test "tests/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as logic from '../js/game-logic.js';
import { tiles, playerTurn, drag } from './helpers.js';

const { createGame, handValue, playerDraw, applyComputerMove, finishComputerTurn, boardCardsOf, endPlayerTurn } = logic;

// ─── Joker in the hand = 30 ───────────────────────────────────────────────────

test('a joker in the hand is worth 30', () => {
    assert.equal(handValue(tiles('J')), 30);
    assert.equal(handValue(tiles('R5 J j')), 65);
});

test('blocked game: a joker left in the hand counts 30 for the winner', () => {
    const state = createGame();
    state.remainingDeck = [];
    state.playerCards   = tiles('J');            // 30
    state.computerCards = tiles('R9 K13');       // 22
    playerDraw(state);                           // player passes
    applyComputerMove(state, boardCardsOf(state.gameBoard));   // computer passes
    assert.equal(finishComputerTurn(state), 'game-over');
    assert.equal(state.winner, 'computer');
});

// ─── Joker in the opening = the tile it stands for ───────────────────────────

test('opening: a joker counts as the tile it stands for (R9 J R11 = 30)', () => {
    const state = playerTurn('R9 J R11 K1');
    drag(state, 0, 0, 'R9 J R11');
    assert.equal(logic.openingMeldPoints(state), 30);
    assert.equal(endPlayerTurn(state), 'ok');
});

test('opening: a joker at the end of a run counts as the next number', () => {
    const state = playerTurn('R7 R8 J K1');
    drag(state, 0, 0, 'R7 R8 J');                // 7 + 8 + 9 = 24
    assert.equal(logic.openingMeldPoints(state), 24);
    assert.equal(endPlayerTurn(state), 'opening-too-low');
});

test('opening: a set that is both run and group counts the higher value', () => {
    const state = playerTurn('J j R10 K1');
    drag(state, 0, 0, 'J j R10');                // group 10+10+10 = 30 (run 8+9+10 = 27)
    assert.equal(logic.openingMeldPoints(state), 30);
    assert.equal(endPlayerTurn(state), 'ok');
});
