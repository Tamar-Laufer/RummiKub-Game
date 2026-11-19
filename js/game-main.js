// ─── Entry point: connects the game logic to the page ───────────────────────
// Turn decisions live in game-logic.js; this file does only DOM and timing.
import {
    createGame, restoreState, boardCardsOf, handValue, openingMeldPoints, OPENING_POINTS, boardTilesTaken,
    endPlayerTurn, playerDraw, applyComputerMove, finishComputerTurn
} from './game-logic.js';
import { render } from './game-render.js';
import { setupBoard, setupTrayDrop } from './game-board.js';
import { updateTurnIndicator, updateCardCounts, showMessageBox, setTurnStatus, setInputEnabled, showDebugHand } from './game-ui.js';
import { explainPasses } from './ai.js';
import { setPoints } from './rules.js';

// ─── Computer turn timing (milliseconds) — change freely ─────────────────────
// Only the display waits; the game logic (and the tests / bot) do not.
const THINKING_DELAY_MS   = 1000;   // "Computer is thinking..." before it plays
const SET_REVEAL_DELAY_MS = 600;    // between the computer's new sets appearing on the board
const AFTER_MOVE_DELAY_MS = 1500;   // its new tiles stay highlighted this long, then your turn starts
const MESSAGE_DELAY_MS    = 1500;   // how long "Computer drew a tile" / "... passes" is shown

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Test modes (can be combined, e.g. game.html?smallDeck&jokers&debug):
//   ?smallDeck  the deck starts with only 5 tiles
//   ?jokers     the player gets both jokers
//   ?debug      shows the computer's hand, and logs every computer decision to the Console
const SMALL_DECK_SIZE = 5;
const DEBUG = new URLSearchParams(window.location.search).has('debug');

let state = null;   // created in initGame

// Every redraw goes through here, so ?debug can also show the computer's hand
function draw(view) {
    render(state, view);
    if (DEBUG) showDebugHand(state.computerCards);
}

function restoreAndRender() {
    restoreState(state);
    draw();
}

// ─── ?debug: what the computer considered this turn ──────────────────────────
const tileText = t => t[0] === 'joker' ? `J(${t[1]})` : `${t[0][0].toUpperCase()}${t[1]}`;
const setsText = sets => sets.length ? sets.map(s => `[${s.map(tileText).join(' ')}]=${setPoints(s)}`).join(' ') : '(none)';

function logComputerDecision(d) {
    console.group(`[debug] Computer ${d.result}: ${d.reason}`);
    console.log(`Hand (${d.hand.length}):`, d.hand.map(tileText).join(' '));
    const hand = d.hand.filter(t => t[0] !== 'joker');
    if (d.phase === 'first-meld') {
        console.log('Before its first meld: the AI looks only at its hand.');
        logPasses(explainPasses(hand, []));
        console.log('Sets it found:', setsText(d.found), `→ ${d.points} points (needs 30)`);
    } else {
        console.log('After its first meld: option 1 = rebuild the board from board tiles + hand, ' +
                    'option 2 = sets from the hand only, next to the others. The one that removes more points wins.');
        if (d.locked.length) console.log('Locked sets (with a joker):', setsText(d.locked));
        console.log('Option 1 (rebuild):');
        logPasses(explainPasses(hand, d.freeBoardCards));
        if (d.jokerSets.length) console.log('  sets with a joker from its hand:', setsText(d.jokerSets));
        console.log(`  → removes ${d.options.rebuild} points`);
        console.log('Option 2 (hand only):', setsText(d.handOnlySets), `→ removes ${d.options.handOnly} points`);
    }
    console.log('Played:', setsText(d.played));
    console.groupEnd();
}

function logPasses(x) {
    const order = colors => colors.map(c => c[0].toUpperCase()).join('');
    console.log(`  algorithm: ${x.total} passes (2 preferences × 24 color orders), ${x.valid} valid`);
    if (x.best) {
        console.log(`  best: prefers ${x.best.preference}s, color order ${order(x.best.colors)}:`,
                    setsText(x.best.sets), `(removes ${x.best.points} points)`);
    } else {
        for (const p of x.originalPasses)
            console.log(`  pass preferring ${p.preference}s (order RKBO):`, setsText(p.sets),
                        `| hand tiles used: ${p.handTilesUsed} | keeps every board tile: ${p.keepsBoardTiles}`);
    }
}

// ─── Show win / lose screen ───────────────────────────────────────────────────
function showEndScreen(playerWon) {
    const target = playerWon ? 'win.html' : 'fail.html';
    try { window.location.href = target; } catch { /* ignored */ }

    // Fallback overlay (works in file:// mode)
    const overlay = document.getElementById('end-overlay');
    const title   = document.getElementById('end-title');
    const sub     = document.getElementById('end-sub');
    if (overlay) {
        title.textContent = playerWon ? '🏆 YOU WON!'  : '🤖 Bob Wins!';
        sub.textContent   = playerWon ? 'Congratulations!' : 'Better luck next time.';
        overlay.classList.add('show');
    }
}

// ─── Blocked game: deck empty and nobody can play → lowest hand wins ─────────
function showBlockedGameEnd() {
    const mine = handValue(state.playerCards), bobs = handValue(state.computerCards);
    const text = `The deck is empty and nobody can play. Your tiles: ${mine} points, ` +
                 `Bob's tiles: ${bobs} points. The lowest total wins.`;
    showMessageBox(text, 'OK', 'OK', showBlockedResult, showBlockedResult);
}

function showBlockedResult() {
    if (state.winner !== 'tie') { showEndScreen(state.winner === 'player'); return; }
    document.getElementById('end-title').textContent = "🤝 It's a tie!";
    document.getElementById('end-sub').textContent   = 'Both hands have the same total.';
    document.getElementById('end-overlay').classList.add('show');
}

function startComputerTurn() {
    computerTurn();
}

// ─── Computer turn (the AI in ai.js) ──────────────────────────────────────────
// The move itself is applied at once (applyComputerMove); only the display is slowed
// down so the player can follow it. Input stays locked until the player's turn.
async function computerTurn() {
    setInputEnabled(false);
    updateTurnIndicator(false);
    setTurnStatus('Computer is thinking...');
    await wait(THINKING_DELAY_MS);

    const before = {
        board: state.gameBoard.map(row => [...row]),
        hand:  state.computerCards.length,
        deck:  state.remainingDeck.length,
    };
    const decision = applyComputerMove(state, boardCardsOf(state.gameBoard));
    if (DEBUG) logComputerDecision(decision);

    const played = before.hand - state.computerCards.length;
    if (played > 0) {
        await showComputerSets(before.board, played);
    } else {
        draw();
        setTurnStatus(state.remainingDeck.length < before.deck
            ? 'Computer drew a tile'
            : 'Computer passes — the deck is empty');
        await wait(MESSAGE_DELAY_MS);
    }

    const result = finishComputerTurn(state);
    draw();                                    // also removes the highlight
    if (result === 'computer-won') { showEndScreen(false); return; }
    if (result === 'game-over')    { showBlockedGameEnd(); return; }

    updateTurnIndicator(true);
    setInputEnabled(true);
}

// The computer's new tiles appear set by set, highlighted
async function showComputerSets(beforeBoard, played) {
    const groups = newTileGroups(beforeBoard, state.gameBoard);
    const hidden = new Set(groups.flat());
    const highlighted = new Set();
    setTurnStatus(`Computer played ${played} tile${played === 1 ? '' : 's'}`);
    draw({ hidden, highlighted });
    for (const group of groups) {
        await wait(SET_REVEAL_DELAY_MS);
        for (const cell of group) { hidden.delete(cell); highlighted.add(cell); }
        draw({ hidden, highlighted });
    }
    await wait(AFTER_MOVE_DELAY_MS);
}

// Board cells ("row-col") that hold tiles the computer just added, grouped by set
// (left to right, top to bottom). The AI may rearrange the board, so tiles are
// matched by color+number: a tile counts as old if the same tile was on the board
// before (preferably in the same cell); the rest are new.
function newTileGroups(before, after) {
    const key = t => t.join('-');
    const oldLeft = new Map();
    for (const row of before) for (const t of row) if (t) oldLeft.set(key(t), (oldLeft.get(key(t)) || 0) + 1);

    const takeOld = k => {
        if (!(oldLeft.get(k) > 0)) return false;
        oldLeft.set(k, oldLeft.get(k) - 1);
        return true;
    };
    const status = after.map(row => row.map(() => null));          // 'old' | 'new'
    // pass 1: a tile in the same cell as before is old
    after.forEach((row, r) => row.forEach((t, c) => {
        if (t && before[r][c] && key(before[r][c]) === key(t) && takeOld(key(t))) status[r][c] = 'old';
    }));
    // pass 2: the other tiles are old while such tiles were on the board, else new
    after.forEach((row, r) => row.forEach((t, c) => {
        if (t && !status[r][c]) status[r][c] = takeOld(key(t)) ? 'old' : 'new';
    }));

    const groups = [];
    after.forEach((row, r) => {
        let group = [];
        for (let c = 0; c <= row.length; c++) {
            if (c < row.length && row[c]) {                         // still inside a set
                if (status[r][c] === 'new') group.push(`${r}-${c}`);
                continue;
            }
            if (group.length) groups.push(group);                  // end of a set
            group = [];
        }
    });
    return groups;
}

// ─── End of player's turn ─────────────────────────────────────────────────────
function onFinishTurn() {
    const result = endPlayerTurn(state);

    if (result === 'no-move') {
        // Player must do something: either move a tile or draw
        showMessageBox(
            'You must play a tile or draw a card!',
            'OK', 'OK', () => {}, () => {}
        );
        return;
    }

    const rejected = {
        'board-tile-taken':
            'Tiles that were on the board when your turn started must stay on the board. You took: ' +
            boardTilesTaken(state).map(([color, num]) => `${color} ${num}`).join(', ') + '.',
        'invalid':
            'Invalid move — the board is not valid.',
        'invalid-run-order':
            'Runs must go in increasing order from left to right.',
        'opening-too-low':
            `Your first meld must be worth at least ${OPENING_POINTS} points. You placed ${openingMeldPoints(state)}.`,
        'opening-touched-board':
            "Before your first meld you can't move or add to tiles that are already on the board.",
    };
    if (rejected[result]) {
        showMessageBox(
            rejected[result],
            'Try Again', 'Take a Card',
            () => restoreAndRender(),
            () => { restoreAndRender(); drawAndEndTurn(); }
        );
        return;
    }

    if (result === 'player-won') { showEndScreen(true); return; }

    updateCardCounts(state);
    startComputerTurn();
}

// ─── Player draws (or passes, if the deck is empty) and ends turn ───────────
function drawAndEndTurn() {
    const result = playerDraw(state);
    draw();
    updateCardCounts(state);

    if (result === 'game-over') { showBlockedGameEnd(); return; }
    if (result === 'passed') {
        showMessageBox('The deck is empty — you pass this turn.', 'OK', 'OK',
                       startComputerTurn, startComputerTurn);
        return;
    }
    startComputerTurn();
}

// ─── Initialise game ──────────────────────────────────────────────────────────
function initGame() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && currentUser.username) {
        const nameEl = document.getElementById('human-name');
        if (nameEl) nameEl.textContent = currentUser.username;
    }

    const params = new URLSearchParams(window.location.search);
    const options = {};
    if (params.has('smallDeck')) options.deckSize = SMALL_DECK_SIZE;
    if (params.has('jokers'))    options.playerJokers = true;
    state = createGame(Math.random, options);

    setupBoard(state);
    setupTrayDrop(state);
    draw();
    updateTurnIndicator(true);
    updateCardCounts(state);
    setInputEnabled(true);
}

// ─── Event listeners ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initGame);

document.getElementById('addCard').addEventListener('click', () => {
    if (!state || !state.isPlayerTurn) return;
    drawAndEndTurn();
});

document.getElementById('finishTurn').addEventListener('click', () => {
    if (!state || !state.isPlayerTurn) return;
    onFinishTurn();
});
