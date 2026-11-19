// Tests for js/rules.js: groups, runs and jokers
// Run: node --test "tests/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../js/rules.js';
import * as logic from '../js/game-logic.js';
import { COLOR, playerTurn, drag } from './helpers.js';

// Short notation plus jokers: J = red joker, j = black joker
const t = text => text.split(' ').map(x =>
    x === 'J' ? ['joker', 'red'] : x === 'j' ? ['joker', 'black'] : [COLOR[x[0]], Number(x.slice(1))]);
const values = text => rules.setValues(t(text));
const valid = text => rules.isValidSet(t(text));

// ─── Without jokers (same as before, except that runs must be in order) ──────

test('group: 3 or 4 tiles, same number, different colors', () => {
    assert.ok(valid('R5 K5 B5'));
    assert.ok(valid('R5 K5 B5 O5'));
    assert.ok(!valid('R5 K5'), 'fewer than 3');
    assert.ok(!valid('R5 R5 B5'), 'repeated color');
    assert.ok(!valid('R5 K5 B6'), 'different numbers');
});

test('run: same color, consecutive, increasing from left to right', () => {
    assert.ok(valid('R5 R6 R7'));
    assert.ok(valid('R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13'), 'length 13');
    assert.ok(!valid('R7 R5 R6'), 'not in order');
    assert.ok(!valid('R7 R6 R5'), 'decreasing');
    assert.ok(!valid('R5 R6 R8'), 'gap');
    assert.ok(!valid('R5 K6 R7'), 'two colors');
    assert.ok(!valid('R12 R13 R1'), '1 does not follow 13');
});

// ─── Jokers in runs ──────────────────────────────────────────────────────────

test('run: joker in the middle stands for the missing number', () => {
    assert.deepEqual(values('R4 J R6'), [4, 5, 6]);
});

test('run: joker at the start', () => {
    assert.deepEqual(values('J R2 R3'), [1, 2, 3]);
    assert.ok(!valid('J R1 R2'), 'the joker would have to be 0');
});

test('run: joker at the end', () => {
    assert.deepEqual(values('R11 R12 J'), [11, 12, 13]);
    assert.ok(!valid('R12 R13 J'), 'the joker would have to be 14');
});

test('run: two jokers in the same run', () => {
    assert.deepEqual(values('R1 J j'), [1, 2, 3]);
    assert.deepEqual(values('J R7 j R9'), [6, 7, 8, 9]);
    assert.deepEqual(values('R3 J j R6'), [3, 4, 5, 6]);
    assert.ok(!valid('R3 J j R7'), 'jokers fill 4 and 5, but then R7 should be 6');
});

test('run: a joker cannot take the place of a tile of another color', () => {
    assert.ok(!valid('R4 J K6'));
});

// ─── Jokers in groups ────────────────────────────────────────────────────────

test('group: a joker fills a missing color', () => {
    assert.deepEqual(values('R5 J B5'), [5, 5, 5]);
    assert.deepEqual(values('R5 K5 B5 J'), [5, 5, 5, 5]);
    assert.ok(!valid('R5 K5 B5 O5 J'), 'a group has at most 4 tiles');
    assert.ok(!valid('R5 J R5'), 'repeated color');
    assert.ok(!valid('R5 J K6'), 'different numbers');
});

test('two jokers with one tile: a group even when it cannot be a run', () => {
    assert.deepEqual(values('R12 J j'), [12, 12, 12], 'run would need 13, 14 → group of 12s');
});

// ─── Both a run and a group: count the higher value ──────────────────────────

test('both run and group: the higher value counts', () => {
    assert.equal(rules.setPoints(t('J j R5')), 15, 'group 5+5+5 beats run 3+4+5');
    assert.equal(rules.setPoints(t('R1 J j')), 6, 'run 1+2+3 beats group 1+1+1');
    assert.equal(rules.setPoints(t('J R7 j')), 21, 'run 6+7+8 and group 7+7+7 are equal');
});

// ─── Board and the run-order message ─────────────────────────────────────────

function boardWith(...rows) {
    const board = logic.emptyBoard();
    rows.forEach((text, r) => t(text).forEach((tile, c) => { board[r][c] = tile; }));
    return board;
}

test('board: a run out of order is reported as an order problem', () => {
    const bad = rules.findInvalidSet(boardWith('R5 K5 B5', 'R7 R5 R6'));
    assert.equal(bad.reason, 'run-order');
});

test('board: other invalid sets are reported as invalid', () => {
    assert.equal(rules.findInvalidSet(boardWith('R5 K6 B7')).reason, 'invalid');
    assert.equal(rules.findInvalidSet(boardWith('R5 R6')).reason, 'invalid');
});

test('board: valid sets with jokers', () => {
    assert.equal(rules.findInvalidSet(boardWith('R4 J R6', 'K5 B5 j')), null);
    assert.ok(rules.isBoardValid(boardWith('R4 J R6', 'K5 B5 j')));
});

test('player: a run out of order gets its own message', () => {
    const state = playerTurn('R7 R5 R6 K1');
    state.playerOpened = true;
    drag(state, 0, 0, 'R7 R5 R6');
    assert.equal(logic.endPlayerTurn(state), 'invalid-run-order');
});
