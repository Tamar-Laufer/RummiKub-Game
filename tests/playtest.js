// ─── Playtest bot ─────────────────────────────────────────────────────────────
// Plays many full games without a browser and reports problems.
//
//   node tests/playtest.js --games 500 --seed 1
//   node tests/playtest.js --games 1 --seed 37 --verbose     (replay one game)
//
// Game number i uses seed (seed + i), so every reported game can be replayed alone.
// The human player is replaced by a simple bot; the computer is the real JS AI
// (the same game-logic.js functions the browser calls). The Python AI is not tested.
//
// Options: --games N  --seed S  --max-turns T (300)  --slow-ms (1000)  --hang-ms (5000)  --verbose
//          --dump-turn N   print the state before turn N as JSON (for writing a regression test)

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { COLORS, FULL_DECK } from '../js/tiles.js';
import { isBoardValid } from '../js/rules.js';
import {
    createGame, restoreState, boardCardsOf,
    endPlayerTurn, playerDraw, applyComputerMove, finishComputerTurn
} from '../js/game-logic.js';

// ═══ Helpers ══════════════════════════════════════════════════════════════════

// Small seeded random generator (mulberry32) — same seed, same shuffle
function seededRandom(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const SHORT = { red: 'R', black: 'K', blue: 'B', orange: 'O' };
const tileKey  = t => `${t[0]}-${t[1]}`;
const isJ = t => t[0] === 'joker';
const showTile = t => isJ(t) ? (t[1] === 'red' ? 'J' : 'j') : `${SHORT[t[0]] ?? t[0]}${t[1]}`;
const showTiles = tiles => tiles.map(showTile).join(' ');
// Hand value at the end of a blocked game: a joker counts 30
const handPoints = tiles => tiles.reduce((sum, t) => sum + (isJ(t) ? 30 : t[1]), 0);

// Tiles of a that are not matched by tiles of b (multiset difference, by color+number)
function minus(a, b) {
    const left = new Map();
    for (const t of b) left.set(tileKey(t), (left.get(tileKey(t)) || 0) + 1);
    const out = [];
    for (const t of a) {
        const k = tileKey(t);
        if (left.get(k) > 0) left.set(k, left.get(k) - 1);
        else out.push(t);
    }
    return out;
}

// Sets on the board = row segments of adjacent tiles (same rule as the game)
function segmentsOf(board) {
    const segs = [];
    board.forEach((row, r) => {
        let cur = null;
        for (let c = 0; c <= row.length; c++) {
            const t = c < row.length ? row[c] : null;
            if (t) {
                if (!cur) cur = { row: r, col: c, tiles: [] };
                cur.tiles.push(t);
            } else if (cur) {
                segs.push(cur);
                cur = null;
            }
        }
    });
    return segs;
}
const setKey = tiles => tiles.map(tileKey).sort().join(',');
const showSeg = s => `[${showTiles(s.tiles)}]@r${s.row}c${s.col}`;

// ─── Independent set check (written separately from js/rules.js on purpose) ──
// Brute force: every way the set could be read — a group of number n (n = 1..13),
// or a run starting at s (left to right) — with jokers standing for anything.
// Returns the list of readings, each one the numbers the tiles stand for.
function readings(tiles) {
    const out = [];
    const real = tiles.filter(t => !isJ(t));
    if (real.length === 0) return out;
    if (tiles.length >= 3 && tiles.length <= 4 && new Set(real.map(t => t[0])).size === real.length)
        for (let n = 1; n <= 13; n++)
            if (real.every(t => t[1] === n)) out.push(tiles.map(() => n));
    if (tiles.length >= 3 && real.every(t => t[0] === real[0][0]))
        for (let s = 1; s + tiles.length - 1 <= 13; s++)
            if (tiles.every((t, i) => isJ(t) || t[1] === s + i)) out.push(tiles.map((_, i) => s + i));
    return out;
}

// Points of a set: the highest reading (jokers count as the tile they stand for); 0 if not valid
function setValue(tiles) {
    const sums = readings(tiles).map(r => r.reduce((a, b) => a + b, 0));
    return sums.length ? Math.max(...sums) : 0;
}

function setProblem(tiles) {
    if (tiles.length < 3) return 'fewer than 3 tiles';
    if (readings(tiles).length > 0) return null;
    if (tiles.some(isJ)) return 'not a valid group or run (left to right), even with the joker';
    if (tiles.every(t => t[1] === tiles[0][1])) {
        if (tiles.length > 4) return 'group of more than 4 tiles';
        if (new Set(tiles.map(t => t[0])).size !== tiles.length) return 'group with a repeated color';
        return null;
    }
    if (!tiles.every(t => t[0] === tiles[0][0])) return 'neither one number (group) nor one color (run)';
    return 'run is not consecutive left to right';
}

function snapshot(state) {
    return {
        player:   `${state.playerCards.length} tiles: ${showTiles(state.playerCards)}`,
        computer: `${state.computerCards.length} tiles: ${showTiles(state.computerCards)}`,
        board:    segmentsOf(state.gameBoard).map(showSeg).join(' ') || '(empty)',
        deck:     `${state.remainingDeck.length} tiles: ${showTiles(state.remainingDeck)}`,
    };
}

// ═══ The bot (plays instead of the human) ═════════════════════════════════════
// Each turn: find runs/groups in its own hand and put them in empty board space,
// like dragging tiles from the tray. A joker completes a pair left in the hand.
// Obeys the 30-point opening. Otherwise draws.

function removeTiles(list, tiles) {
    for (const t of tiles) list.splice(list.indexOf(t), 1);
}

function takeGroups(free, sets) {
    for (let n = 1; n <= 13; n++) {
        const byColor = new Map();
        for (const t of free) if (t[1] === n && !byColor.has(t[0])) byColor.set(t[0], t);
        if (byColor.size >= 3) {
            const group = [...byColor.values()];
            sets.push(group);
            removeTiles(free, group);
        }
    }
}

function takeRuns(free, sets) {
    for (const color of COLORS) {
        let run = [];
        for (let n = 1; n <= 14; n++) {            // 14 = flush the last run
            const t = n <= 13 ? free.find(x => x[0] === color && x[1] === n) : null;
            if (t) { run.push(t); continue; }
            if (run.length >= 3) { sets.push(run); removeTiles(free, run); }
            run = [];
        }
    }
}

// Each joker in the hand completes the most valuable pair left over (tries every pair
// and every joker position, keeps what setValue accepts)
function takeJokerSets(free, sets) {
    for (const joker of free.filter(isJ)) {
        const others = free.filter(t => !isJ(t));
        let best = null;
        for (let i = 0; i < others.length; i++)
            for (let k = i + 1; k < others.length; k++) {
                const [a, b] = others[i][1] <= others[k][1] ? [others[i], others[k]] : [others[k], others[i]];
                for (const set of [[a, b, joker], [joker, a, b], [a, joker, b]]) {
                    const v = setValue(set);
                    if (v > 0 && (!best || v > best.v)) best = { set, v };
                }
            }
        if (!best) break;
        sets.push(best.set);
        removeTiles(free, best.set);
    }
}

function findHandSets(hand) {
    const options = [['runs', 'groups'], ['groups', 'runs']].map(order => {
        const free = hand.filter(t => !isJ(t)), sets = [];
        for (const kind of order) (kind === 'runs' ? takeRuns : takeGroups)(free, sets);
        free.push(...hand.filter(isJ));
        takeJokerSets(free, sets);
        return sets;
    });
    const value = sets => sets.reduce((sum, s) => sum + setValue(s), 0);
    return value(options[0]) >= value(options[1]) ? options[0] : options[1];
}

// Empty space for a set of `len` tiles, with an empty cell (or the edge) on both sides
function findSpace(board, len) {
    for (let r = 0; r < board.length; r++) {
        const cols = board[r].length;
        for (let c = 0; c + len <= cols; c++) {
            let ok = (c === 0 || !board[r][c - 1]) && (c + len === cols || !board[r][c + len]);
            for (let i = 0; ok && i < len; i++) if (board[r][c + i]) ok = false;
            if (ok) return { r, c };
        }
    }
    return null;
}

function botMove(state, hasOpened) {
    const sets = findHandSets(state.playerCards);
    const board = state.gameBoard.map(row => [...row]);   // plan on a copy first
    const placements = [];
    for (const set of sets) {
        const pos = findSpace(board, set.length);
        if (!pos) continue;
        set.forEach((t, i) => { board[pos.r][pos.c + i] = t; });
        placements.push({ set, ...pos });
    }
    const noRoom = placements.length < sets.length;
    const value = placements.reduce((sum, p) => sum + setValue(p.set), 0);
    if (placements.length === 0 || (!hasOpened && value < 30)) return { placed: 0, noRoom };

    // Same effect as dragging each tile from the tray to the board
    for (const p of placements)
        p.set.forEach((t, i) => {
            state.gameBoard[p.r][p.c + i] = t;
            state.playerCards.splice(state.playerCards.indexOf(t), 1);
        });
    return { placed: placements.reduce((n, p) => n + p.set.length, 0), noRoom };
}

// ═══ Checks after every turn (invariants) ═════════════════════════════════════

function checkTurn(before, state, actor, outcome, opened, report) {
    // 1. Every tile exists exactly once: hands + board + deck = full deck
    const all = [...state.playerCards, ...state.computerCards, ...state.remainingDeck,
                 ...boardCardsOf(state.gameBoard)];
    const missing = minus(FULL_DECK, all), extra = minus(all, FULL_DECK);
    if (missing.length || extra.length)
        report('tiles-lost-or-duplicated',
            `total ${all.length}/${FULL_DECK.length}. missing: ${showTiles(missing) || '-'}; extra: ${showTiles(extra) || '-'}`);

    // 2. Every set on the board is valid
    for (const seg of segmentsOf(state.gameBoard)) {
        const why = setProblem(seg.tiles);
        if (why) report('invalid-set-on-board',
            `${showSeg(seg)}: ${why}. (the game's isBoardValid() says: ${isBoardValid(state.gameBoard) ? 'valid' : 'invalid'})`);
    }

    // 3. Opening rule: before the first meld, the board is not touched, and the meld is >= 30
    const handKey = actor === 'player' ? 'playerCards' : 'computerCards';
    const segsBefore = segmentsOf(before.board), segsAfter = segmentsOf(state.gameBoard);
    const keysBefore = segsBefore.map(s => setKey(s.tiles)).sort().join('|');
    const keysAfter  = segsAfter.map(s => setKey(s.tiles)).sort().join('|');
    if (!opened[actor] && keysBefore !== keysAfter) {
        opened[actor] = true;
        const remaining = [...segsAfter];
        const touched = [];
        for (const seg of segsBefore) {
            const i = remaining.findIndex(s => setKey(s.tiles) === setKey(seg.tiles));
            if (i >= 0) remaining.splice(i, 1);
            else touched.push(seg);
        }
        if (touched.length)
            report('opening-touched-board',
                `first meld changed existing board sets: ${touched.map(showSeg).join(' ')}`);
        // value of the new sets (a joker counts as the tile it stands for)
        const meldValue = remaining.reduce((sum, s) => sum + setValue(s.tiles), 0);
        if (meldValue < 30)
            report('opening-under-30',
                `first meld is worth ${meldValue} points: ${remaining.map(showSeg).join(' ')}`);
    }

    // 4. Board tiles never go back to a hand; a hand only gains drawn tiles
    const drawn = minus(before.deck, state.remainingDeck);
    const gained = minus(state[handKey], before[handKey]);
    const notDrawn = minus(gained, drawn);
    if (notDrawn.length)
        report('board-tile-to-hand', `${actor} hand gained tiles that were not drawn: ${showTiles(notDrawn)}`);
    const otherKey = actor === 'player' ? 'computerCards' : 'playerCards';
    if (minus(state[otherKey], before[otherKey]).length || minus(before[otherKey], state[otherKey]).length)
        report('other-hand-changed', `the ${actor}'s turn changed the other player's hand`);

    // 5. Every tile that was on the board at the start of the turn is still on the board
    const removed = minus(boardCardsOf(before.board), boardCardsOf(state.gameBoard));
    if (removed.length)
        report('board-tile-removed', `the ${actor}'s turn removed tiles from the board: ${showTiles(removed)}`);

    // 6. The turn really passed to the other player
    if ((outcome === 'ok' || outcome === 'passed') && state.isPlayerTurn !== (actor === 'computer'))
        report('turn-not-passed', `after the ${actor}'s turn, isPlayerTurn is ${state.isPlayerTurn}`);
}

// A blocked game may end only with an empty deck, and the lowest hand must win
function checkBlockedEnd(state, report) {
    const player = handPoints(state.playerCards), computer = handPoints(state.computerCards);
    const expected = player < computer ? 'player' : computer < player ? 'computer' : 'tie';
    if (state.remainingDeck.length > 0)
        report('wrong-game-over', `blocked game ended with ${state.remainingDeck.length} tiles still in the deck`);
    if (state.winner !== expected)
        report('wrong-game-over', `winner is '${state.winner}' but hands are player ${player} / computer ${computer}`);
}

// ═══ One full game ════════════════════════════════════════════════════════════

function playGame(seed, opts, heartbeat) {
    const state  = createGame(seededRandom(seed));
    const opened = { player: false, computer: false };
    const problems = {};   // type → { count, turns, first }
    const stats = { aiCalls: 0, aiMsTotal: 0, aiMsMax: 0, botPlays: 0, botDraws: 0, botPasses: 0, botNoRoom: 0,
                    computerPlays: 0, computerDraws: 0, computerPasses: 0,
                    botJokersPlayed: 0, computerJokersPlayed: 0 };
    const jokersIn = tiles => tiles.filter(isJ).length;

    const finish = (outcome, turns, message = null) =>
        ({ seed, outcome, turns, message, finalState: snapshot(state), problems, stats });

    for (let turn = 1; turn <= opts.maxTurns; turn++) {
        const actor = state.isPlayerTurn ? 'player' : 'computer';
        const report = (type, message) => {
            const p = problems[type] ??= { count: 0, turns: [], first: null };
            p.count++;
            p.turns.push(turn);
            if (!p.first) p.first = { turn, actor, message, state: snapshot(state) };
        };
        const before = {
            playerCards: [...state.playerCards], computerCards: [...state.computerCards],
            deck: [...state.remainingDeck], board: state.gameBoard.map(row => [...row]),
        };
        heartbeat(turn, actor, state);
        if (opts.dumpTurn === turn)
            console.log(`DUMP seed ${seed}, state before turn ${turn} (${actor}):\n` + JSON.stringify({
                playerCards: state.playerCards.map(showTile).join(' '),
                computerCards: state.computerCards.map(showTile).join(' '),
                boardCards: boardCardsOf(state.gameBoard).map(showTile).join(' '),
                remainingDeck: state.remainingDeck.map(showTile).join(' '),
            }, null, 1));

        let outcome;
        if (actor === 'player') {
            const move = botMove(state, opened.player);
            if (move.noRoom) stats.botNoRoom++;
            if (move.placed > 0) {
                stats.botPlays++;
                outcome = endPlayerTurn(state);
                if (outcome !== 'ok' && outcome !== 'player-won') {
                    // any rejection (invalid, opening-too-low, invalid-run-order, ...)
                    report('bot-move-rejected', `endPlayerTurn() returned '${outcome}' for the bot's move`);
                    restoreState(state);              // same as clicking "Take a Card"
                    outcome = playerDraw(state);
                }
            } else {
                outcome = playerDraw(state);
                if (outcome === 'ok') stats.botDraws++;
                else stats.botPasses++;
            }
            if (outcome === 'deck-empty')
                return finish('stuck-player-cannot-move', turn,
                    'The deck is empty and the player has no valid move. In the browser: "Draw" shows ' +
                    '"The deck is empty!", "Done" shows "You must play a tile or draw a card!", and the ' +
                    'turn never passes. The game has no ending for this case.');
        } else {
            const handBefore = state.computerCards.length, deckBefore = state.remainingDeck.length;
            const t0 = performance.now();
            applyComputerMove(state, boardCardsOf(state.gameBoard));
            const ms = performance.now() - t0;
            stats.aiCalls++;
            stats.aiMsTotal += ms;
            stats.aiMsMax = Math.max(stats.aiMsMax, ms);
            if (ms > opts.slowMs) report('ai-slow', `the AI took ${ms.toFixed(0)} ms`);
            if (state.computerCards.length < handBefore) stats.computerPlays++;
            else if (state.remainingDeck.length < deckBefore) stats.computerDraws++;
            else stats.computerPasses++;
            outcome = finishComputerTurn(state);
        }

        const jokersPlayed = jokersIn(before[actor === 'player' ? 'playerCards' : 'computerCards']) -
                             jokersIn(actor === 'player' ? state.playerCards : state.computerCards);
        if (jokersPlayed > 0) stats[actor === 'player' ? 'botJokersPlayed' : 'computerJokersPlayed'] += jokersPlayed;

        checkTurn(before, state, actor, outcome, opened, report);
        if (outcome === 'player-won' || outcome === 'computer-won') return finish(outcome, turn);
        if (outcome === 'game-over') {
            checkBlockedEnd(state, report);
            return finish(`game-over-${state.winner}`, turn);
        }
    }
    return finish('stuck-max-turns', opts.maxTurns, `The game did not end after ${opts.maxTurns} turns.`);
}

// ═══ Worker: plays games and sends results to the main thread ═══════════════

function workerMain() {
    const { opts, from } = workerData;
    for (let i = from; i < opts.games; i++) {
        const seed = opts.seed + i;
        let last = null;
        try {
            const result = playGame(seed, opts, (turn, actor, state) => {
                last = { turn, actor, state: snapshot(state) };
                parentPort.postMessage({ type: 'heartbeat', index: i, seed, ...last });
            });
            parentPort.postMessage({ type: 'result', result });
        } catch (err) {
            parentPort.postMessage({ type: 'result', result: {
                seed, outcome: 'crash', turns: last?.turn ?? 0,
                message: `Exception during the ${last?.actor ?? '?'}'s turn ` +
                         `(in the browser this leaves the game frozen):\n${err.stack}`,
                finalState: last?.state ?? null, problems: {}, stats: null,
            } });
        }
    }
    parentPort.postMessage({ type: 'done' });
}

// ═══ Main thread: runs the worker, watches for hangs, prints the report ═════

function parseArgs(argv) {
    const opts = { games: 500, seed: 1, maxTurns: 300, slowMs: 1000, hangMs: 5000, verbose: false, dumpTurn: null };
    const numeric = { '--games': 'games', '--seed': 'seed', '--max-turns': 'maxTurns',
                      '--slow-ms': 'slowMs', '--hang-ms': 'hangMs',
                      '--dump-turn': 'dumpTurn' };   // print the state before turn N (use with --games 1)
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--verbose') opts.verbose = true;
        else if (numeric[argv[i]] && Number.isFinite(Number(argv[i + 1]))) opts[numeric[argv[i]]] = Number(argv[++i]);
        else { console.error(`Unknown or incomplete argument: ${argv[i]}`); process.exit(2); }
    }
    return opts;
}

// Runs games [from, games) in a worker. Resolves with the index to continue from.
function runWorker(opts, from, results) {
    return new Promise(resolve => {
        const worker = new Worker(new URL(import.meta.url), { workerData: { opts, from } });
        let last = null, lastTime = performance.now(), finished = false;
        const stop = next => {
            if (finished) return;
            finished = true;
            clearInterval(timer);
            worker.terminate();
            resolve(next);
        };
        const timer = setInterval(() => {
            if (last && performance.now() - lastTime > opts.hangMs) {
                results.push({
                    seed: last.seed, outcome: 'hang', turns: last.turn,
                    message: `No answer for ${opts.hangMs} ms during the ${last.actor}'s turn ` +
                             `— probably an infinite loop. State at the start of that turn is below.`,
                    finalState: last.state, problems: {}, stats: null,
                });
                stop(last.index + 1);
            }
        }, 100);
        worker.on('message', m => {
            lastTime = performance.now();
            if (m.type === 'heartbeat') last = m;
            else if (m.type === 'result') { results.push(m.result); last = null; }
            else if (m.type === 'done') stop(opts.games);
        });
        worker.on('error', err => {
            results.push({ seed: last?.seed ?? opts.seed + from, outcome: 'crash', turns: last?.turn ?? 0,
                           message: err.stack, finalState: last?.state ?? null, problems: {}, stats: null });
            stop((last?.index ?? from) + 1);
        });
    });
}

const OUTCOMES = {
    'computer-won':             'Computer won',
    'player-won':               'Bot (player) won',
    'game-over-computer':       'Blocked game (deck empty), computer had the lower hand',
    'game-over-player':         'Blocked game (deck empty), bot had the lower hand',
    'game-over-tie':            'Blocked game (deck empty), tie',
    'stuck-player-cannot-move': 'STUCK: deck empty, player cannot move',
    'stuck-max-turns':          'STUCK: no winner after max turns',
    'hang':                     'HANG: AI did not answer (infinite loop?)',
    'crash':                    'CRASH: exception in game code',
};
const PROBLEMS = {
    'tiles-lost-or-duplicated': 'Tiles lost or duplicated (hands+board+deck != full deck)',
    'invalid-set-on-board':     'Invalid set on the board after a turn',
    'opening-under-30':         'First meld worth less than 30 points',
    'opening-touched-board':    'First meld used/changed tiles already on the board',
    'board-tile-to-hand':       'A board tile went back to a hand',
    'board-tile-removed':       'A tile on the board at turn start was gone at turn end',
    'other-hand-changed':       "A turn changed the other player's hand",
    'turn-not-passed':          'Turn did not pass to the other player',
    'ai-slow':                  'AI took longer than --slow-ms',
    'bot-move-rejected':        "Game rejected the bot's (valid) move",
    'wrong-game-over':          'Blocked game ended wrongly (deck not empty / wrong winner)',
};

// Outcomes where the game reached a proper end
const endedNormally = outcome => outcome.endsWith('-won') || outcome.startsWith('game-over-');

function printState(s, indent = '      ') {
    if (!s) return;
    console.log(`${indent}player:   ${s.player}`);
    console.log(`${indent}computer: ${s.computer}`);
    console.log(`${indent}board:    ${s.board}`);
    console.log(`${indent}deck:     ${s.deck}`);
}

function printReport(opts, results, ms) {
    results.sort((a, b) => a.seed - b.seed);
    const line = (label, value, extra = '') => console.log(`  ${label.padEnd(58, '.')} ${String(value).padStart(5)}${extra}`);

    console.log(`\nRummikub playtest — ${opts.games} games, seeds ${opts.seed}..${opts.seed + opts.games - 1}, ` +
                `max ${opts.maxTurns} turns per game (${(ms / 1000).toFixed(1)} s)`);
    console.log('Tiles: R=red K=black B=blue O=orange. Board sets: [tiles]@r<row>c<col>\n');

    console.log('OUTCOMES');
    for (const [key, label] of Object.entries(OUTCOMES)) {
        const n = results.filter(r => r.outcome === key).length;
        if (n || !key.startsWith('stuck-max')) line(label, n);
    }
    const ok = results.filter(r => endedNormally(r.outcome)).length;
    console.log(`  => ended normally: ${ok}/${results.length}, stuck/hang/crash: ${results.length - ok}/${results.length}\n`);

    console.log('INVARIANT VIOLATIONS                                         games  occurrences');
    let any = false;
    for (const [key, label] of Object.entries(PROBLEMS)) {
        const games = results.filter(r => r.problems[key]);
        if (!games.length) continue;
        any = true;
        line(label, games.length, `  ${String(games.reduce((n, r) => n + r.problems[key].count, 0)).padStart(8)}`);
    }
    if (!any) console.log('  (none)');

    const played = results.filter(r => r.stats);
    const sum = f => played.reduce((n, r) => n + r.stats[f], 0);
    console.log('\nSTATS');
    console.log(`  turns per game: avg ${(results.reduce((n, r) => n + r.turns, 0) / results.length).toFixed(1)}, ` +
                `max ${Math.max(...results.map(r => r.turns))}`);
    console.log(`  AI calls: ${sum('aiCalls')}, avg ${(sum('aiMsTotal') / Math.max(1, sum('aiCalls'))).toFixed(2)} ms, ` +
                `max ${Math.max(0, ...played.map(r => r.stats.aiMsMax)).toFixed(1)} ms`);
    console.log(`  computer turns: played ${sum('computerPlays')}, drew ${sum('computerDraws')}, ` +
                `passed (deck empty, no move) ${sum('computerPasses')}`);
    console.log(`  jokers played: by the bot ${sum('botJokersPlayed')} (in ${played.filter(r => r.stats.botJokersPlayed).length} games), ` +
                `by the computer ${sum('computerJokersPlayed')} (in ${played.filter(r => r.stats.computerJokersPlayed).length} games)`);
    console.log(`  bot turns: played ${sum('botPlays')}, drew ${sum('botDraws')}, passed (deck empty) ${sum('botPasses')}, ` +
                `had a set but no room on the board ${sum('botNoRoom')}`);

    console.log('\nEXAMPLES (first game with each problem' + (opts.verbose ? ', then every game' : '; --verbose lists every game') + ')');
    for (const key of Object.keys(OUTCOMES).filter(k => !endedNormally(k))) {
        const r = results.find(x => x.outcome === key);
        if (!r) continue;
        console.log(`\n  [${key}] seed ${r.seed}, turn ${r.turns}`);
        console.log(`      ${r.message.replace(/\n/g, '\n      ')}`);
        printState(r.finalState);
    }
    for (const key of Object.keys(PROBLEMS)) {
        const r = results.find(x => x.problems[key]);
        if (!r) continue;
        const f = r.problems[key].first;
        console.log(`\n  [${key}] seed ${r.seed}, turn ${f.turn} (${f.actor})`);
        console.log(`      ${f.message}`);
        printState(f.state);
    }

    if (opts.verbose) {
        console.log('\nALL GAMES');
        for (const r of results) {
            const probs = Object.entries(r.problems).map(([k, p]) => `${k}@${p.turns.join(',')}`).join('  ');
            console.log(`  seed ${String(r.seed).padStart(5)}  ${r.outcome.padEnd(25)} turns ${String(r.turns).padStart(3)}  ${probs}`);
        }
    }

    console.log(`\nReplay one game: node tests/playtest.js --games 1 --seed <seed> --verbose\n`);
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const results = [];
    const t0 = performance.now();
    let from = 0;
    while (from < opts.games) from = await runWorker(opts, from, results);
    printReport(opts, results, performance.now() - t0);
    const bad = results.some(r => !endedNormally(r.outcome) || Object.keys(r.problems).length);
    process.exitCode = bad ? 1 : 0;
}

// `node --test tests/` also loads this file. It is a script, not a unit test, so skip it there.
if (process.env.NODE_TEST_CONTEXT) console.log('playtest.js: skipped under node --test (run it directly)');
else if (isMainThread) await main();
else workerMain();
