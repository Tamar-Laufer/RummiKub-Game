// Tests for the turn logic in js/game-logic.js
// Run: node --test "tests/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createGame, playerDraw, applyComputerMove, finishComputerTurn, boardCardsOf
} from '../js/game-logic.js';

// Deck is empty and nobody has a valid set in hand
function blockedGame(playerCards, computerCards) {
    const state = createGame();
    state.remainingDeck = [];
    state.playerCards   = playerCards;
    state.computerCards = computerCards;
    return state;
}

function computerTurn(state) {
    applyComputerMove(state, boardCardsOf(state.gameBoard));
    return finishComputerTurn(state);
}

test('a normal game deals 14 + 14 and leaves 76 tiles in the deck', () => {
    const state = createGame();
    assert.equal(state.playerCards.length, 14);
    assert.equal(state.computerCards.length, 14);
    assert.equal(state.remainingDeck.length, 76);
});

test('test mode deckSize: 5 keeps only 5 tiles in the deck, hands unchanged', () => {
    const state = createGame(Math.random, { deckSize: 5 });
    assert.equal(state.playerCards.length, 14);
    assert.equal(state.computerCards.length, 14);
    assert.equal(state.remainingDeck.length, 5);
});

test('player draws one tile while the deck has tiles', () => {
    const state = createGame();
    const before = state.playerCards.length;
    assert.equal(playerDraw(state), 'ok');
    assert.equal(state.playerCards.length, before + 1);
    assert.equal(state.isPlayerTurn, false);
});

test('deck empty and no move: the player can pass, the turn goes to the computer', () => {
    const state = blockedGame([['red', 1], ['blue', 5]], [['red', 9], ['black', 13]]);
    assert.equal(playerDraw(state), 'passed');
    assert.equal(state.isPlayerTurn, false);
});

test('deck empty and both players pass: the game ends, the lower hand wins (player)', () => {
    const state = blockedGame([['red', 1], ['blue', 5]], [['red', 9], ['black', 13]]);
    playerDraw(state);                              // player passes (6 points)
    assert.equal(computerTurn(state), 'game-over'); // computer passes (22 points)
    assert.equal(state.winner, 'player');
});

test('deck empty and both players pass: the lower hand wins (computer)', () => {
    const state = blockedGame([['red', 11], ['blue', 12]], [['red', 2], ['black', 3]]);
    playerDraw(state);
    assert.equal(computerTurn(state), 'game-over');
    assert.equal(state.winner, 'computer');
});

test('deck empty and both players pass with equal hands: tie', () => {
    const state = blockedGame([['red', 4], ['blue', 6]], [['red', 2], ['black', 8]]);
    playerDraw(state);
    assert.equal(computerTurn(state), 'game-over');
    assert.equal(state.winner, 'tie');
});

test('the game does not end while someone still places tiles', () => {
    // Computer can play a group of 7s, so its turn is not a pass
    const state = blockedGame([['red', 1], ['blue', 5]],
                              [['red', 7], ['blue', 7], ['black', 7], ['orange', 2]]);
    assert.equal(playerDraw(state), 'passed');
    assert.equal(computerTurn(state), 'ok');
    assert.equal(state.isPlayerTurn, true);
    // Player passes again: only one pass in a row since the computer played
    assert.equal(playerDraw(state), 'passed');
});

test('the computer passing first, then the player passing, also ends the game', () => {
    const state = blockedGame([['red', 1], ['blue', 5]], [['red', 9], ['black', 13]]);
    state.isPlayerTurn = false;
    assert.equal(computerTurn(state), 'ok');        // computer passes, turn to player
    assert.equal(playerDraw(state), 'game-over');   // player passes → game over
    assert.equal(state.winner, 'player');
});
