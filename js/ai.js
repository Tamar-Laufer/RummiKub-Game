// ─── Computer AI (logic only, no DOM) ────────────────────────────────────────
// Moved as-is from game-algorithm.js. Additions at the end of the file: the safety
// net for the board size, and the joker pass (the original algorithm works on a
// 4×13 matrix and does not know jokers, so they are handled around it).
import { COLORS } from './tiles.js';
import { isJoker, isValidSet, setPoints } from './rules.js';

// ─── Based exactly on the original algorithm — 3 bugs fixed ──────────────────
//
// ORIGINAL FUNCTIONS (unchanged logic):
//   checkColumnSet, checkRowSet, findSetsOfThree,
//   findRowSets, findColumnSets, loopSetsOfThree, findAllSets
//
// BUG FIXES:
//   1. findSetsOfThree — "both possible" (group + run):
//      original did nothing → card never played.
//      Fix: mark based on preference parameter.
//
//   2. findRowSets Pass A — backward loop:
//      original only broke when count==0, so non-'r' cards with count>0
//      were silently skipped, producing non-consecutive "runs".
//      Fix: break on any card that is not 'r'-marked.
//
//   3. pushColumnSet / pushRowSet — decrementing tm1:
//      original did tempMat1[x]-- which turns 'r'/'c' into NaN.
//      Fix: only reset tm1 to 0 when count drops to 0.
//
// OPTIMISATION:
//   Run twice (prefer-group, prefer-run) → pick the result that plays more
//   hand cards while keeping every board card.

export function runOnePass(allCards, preference) {

    // ── Build matrices (same as copyTempMatrix + addCardsToMatrix) ────────────
    const tm  = Array(4).fill(null).map(() => Array(13).fill(0));  // counts
    const tm1 = Array(4).fill(null).map(() => Array(13).fill(0));  // markers
    const sets = [];

    for (const [color, num] of allCards) {
        const ci = COLORS.indexOf(color);
        if (ci >= 0 && num >= 1 && num <= 13) tm[ci][num - 1]++;
    }
    // tm1 starts as numeric copy of tm (original copyTempMatrix behaviour)
    for (let ci = 0; ci < 4; ci++)
        for (let ni = 0; ni < 13; ni++)
            tm1[ci][ni] = tm[ci][ni];

    // ── checkColumnSet (original, unchanged) ─────────────────────────────────
    function checkColumnSet(row, column) {
        let cnt = 0; const arr = [];
        for (let i = 0; i < 4; i++) {
            if (tm[i][column] > 0 && tm1[i][column] !== 'r') { arr.push(i); cnt++; }
        }
        return cnt > 2 ? arr : [];
    }

    // ── checkRowSet (original, unchanged) ────────────────────────────────────
    function checkRowSet(row, column) {
        let cnt = 0; let arr = [];
        for (let i = column - 3; i < column; i++) {
            if (i >= 0) {
                if (tm[row][i] > 0 && tm1[row][i] !== 'c') { arr.push(i); cnt++; }
                else { arr = []; cnt = 0; }
            }
        }
        for (let i = column; i <= column + 3 && i < 13; i++) {
            if (tm[row][i] > 0 && tm1[row][i] !== 'c') { arr.push(i); cnt++; }
            else break;
        }
        return cnt > 2 ? arr : [];
    }

    // ── pushColumnSet — FIX: don't decrement tm1 if it's a string ────────────
    function pushColumnSet(arrColors, column) {
        sets.push(arrColors.map(ci => [COLORS[ci], column + 1]));
        for (const ci of arrColors) {
            tm[ci][column]--;
            if (tm[ci][column] === 0) tm1[ci][column] = 0;
        }
    }

    // ── pushRowSet — FIX: don't decrement tm1 if it's a string ───────────────
    function pushRowSet(arrNums, row) {
        sets.push(arrNums.map(ni => [COLORS[row], ni + 1]));
        for (const ni of arrNums) {
            tm[row][ni]--;
            if (tm[row][ni] === 0) tm1[row][ni] = 0;
        }
    }

    // ── findSetsOfThree — FIX: resolve "both possible" by preference ──────────
    function findSetsOfThree() {
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 13; j++) {
                if (!tm[i][j]) continue;

                const colSet = checkColumnSet(i, j);
                if (colSet.length) {
                    const rowSet = checkRowSet(i, j);
                    if (!rowSet.length) {
                        // Only group possible (original logic)
                        if (colSet.length === 3) pushColumnSet(colSet, j);
                        else                      tm1[i][j] = 'c';
                    } else {
                        // ── BOTH possible — original left this unmarked (bug) ──
                        // Fix: mark by preference so the card is never stranded
                        tm1[i][j] = (preference === 'run') ? 'r' : 'c';
                    }
                } else {
                    const rowSet = checkRowSet(i, j);
                    if (rowSet.length === 3) pushRowSet(rowSet, i);
                    else if (rowSet.length > 0) tm1[i][j] = 'r';
                    // else: neither possible → leave unmarked (same as original)
                }
            }
        }
    }

    // ── findRowSets — FIX in Pass A backward loop ────────────────────────────
    function findRowSets() {
        // Pass A: cards with 2 copies
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 13; j++) {
                if (tm1[i][j] !== 'r' || tm[i][j] < 2) continue;

                const arr = [];
                // Backward from j — FIX: break on any non-'r' card
                for (let k = j; k >= 0; k--) {
                    if (tm1[i][k] === 'r' && tm[i][k] > 0) arr.unshift(k);
                    else break;
                }
                // Forward from j+1 (doubles only, original behaviour)
                for (let k = j + 1; k < 13; k++) {
                    if (tm1[i][k] === 'r' && tm[i][k] >= 2) arr.push(k);
                    else break;
                }
                if (arr.length > 2) pushRowSet(arr, i);
            }
        }

        // Pass B: cards with 1 copy — FIX: break on non-'r' (not just on count=0)
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 13; j++) {
                if (tm1[i][j] !== 'r' || tm[i][j] !== 1) continue;
                const arr = [];
                for (let k = j; k < 13; k++) {
                    if (tm1[i][k] === 'r' && tm[i][k] === 1) arr.push(k);
                    else break;
                }
                if (arr.length > 2) pushRowSet(arr, i);
            }
        }
    }

    // ── findColumnSets (original, unchanged) ─────────────────────────────────
    function findColumnSets() {
        for (let i = 0; i < 13; i++) {
            let cnt1 = 0, cnt2 = 0;
            const arr1 = [], arr2 = [];

            for (let j = 0; j < 4; j++) {
                if (tm1[j][i] === 'c' && tm[j][i] === 2) {
                    arr1.push(j); cnt1++;
                    arr2.push(j); cnt2++;
                }
            }
            for (let j = 0; j < 4; j++) {
                if (tm1[j][i] === 'c' && tm[j][i] === 1) {
                    if (cnt1 < 3)              { arr1.push(j); cnt1++; }
                    else if (cnt2 < 3 && cnt2 > 0) { arr2.push(j); cnt2++; }
                    else                       { arr1.push(j); cnt1++; }
                }
            }
            if (cnt1 > 2) pushColumnSet(arr1, i);
            if (cnt2 > 2) pushColumnSet(arr2, i);
        }
    }

    // ── loopSetsOfThree (original, unchanged) ────────────────────────────────
    function loopSetsOfThree() {
        let prev = -1;
        while (sets.length > prev) {
            prev = sets.length;
            findSetsOfThree();
        }
    }

    // ── findAllSets (original, unchanged) ────────────────────────────────────
    function findAllSets() {
        let prev = -1;
        while (sets.length > prev) {
            prev = sets.length;
            loopSetsOfThree();
            findRowSets();
            findColumnSets();
        }
    }

    findAllSets();
    return sets.filter(s => s.length >= 3);
}

// ─── Count how many hand cards appear in the result sets ─────────────────────
export function countHandUsed(hand, boardCards, sets) {
    const used = {}, board = {};
    for (const s of sets)
        for (const [c, n] of s) { const k = `${c}-${n}`; used[k] = (used[k] || 0) + 1; }
    for (const [c, n] of boardCards) { const k = `${c}-${n}`; board[k] = (board[k] || 0) + 1; }
    let total = 0;
    for (const [k, cnt] of Object.entries(used))
        total += Math.max(0, cnt - (board[k] || 0));
    return total;
}

// ─── Work out which hand cards are still unused ───────────────────────────────
export function computeRemainingHand(hand, boardCards, sets) {
    const used = {}, board = {};
    for (const s of sets)
        for (const [c, n] of s) { const k = `${c}-${n}`; used[k] = (used[k] || 0) + 1; }
    for (const [c, n] of boardCards) { const k = `${c}-${n}`; board[k] = (board[k] || 0) + 1; }

    const handUsed = {};
    for (const [k, cnt] of Object.entries(used))
        handUsed[k] = Math.max(0, cnt - (board[k] || 0));

    const remaining = [];
    for (const card of hand) {
        const k = `${card[0]}-${card[1]}`;
        if (handUsed[k] > 0) handUsed[k]--;
        else remaining.push(card);
    }
    return remaining;
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export function matrixGreedyFindSets(hand, boardCards) {
    const allCards = [...boardCards, ...hand];

    // Run twice — once preferring groups, once preferring runs
    const setsG = runOnePass(allCards, 'group');
    const setsR = runOnePass(allCards, 'run');

    const usedG = countHandUsed(hand, boardCards, setsG);
    const usedR = countHandUsed(hand, boardCards, setsR);

    // Valid = preserves board cards AND plays at least 1 hand card
    const validG = usedG > 0 && allBoardCardsPresent(boardCards, setsG);
    const validR = usedR > 0 && allBoardCardsPresent(boardCards, setsR);

    let bestSets;
    if      (validG && validR) bestSets = usedG >= usedR ? setsG : setsR;
    else if (validG)           bestSets = setsG;
    else if (validR)           bestSets = setsR;
    else                       bestSets = [];   // can't play → draw

    return { sets: bestSets, remainingHand: computeRemainingHand(hand, boardCards, bestSets) };
}

// ─── Verify no board card was removed ────────────────────────────────────────
export function allBoardCardsPresent(boardCards, sets) {
    const needed = {}, have = {};
    for (const [c, n] of boardCards) { const k = `${c}-${n}`; needed[k] = (needed[k] || 0) + 1; }
    for (const s of sets) for (const [c, n] of s) { const k = `${c}-${n}`; have[k] = (have[k] || 0) + 1; }
    for (const [k, cnt] of Object.entries(needed)) if ((have[k] || 0) < cnt) return false;
    return true;
}

// ─── Do the sets fit on a rows×cols board? ───────────────────────────────────
// Same packing as placeSetsOnBoard: sets in order, an empty cell between sets,
// a new row when the next set does not fit in the current one.
export function setsFit(sets, rows, cols) {
    let r = 0, c = 0;
    for (const s of sets) {
        if (c + s.length > cols) { r++; c = 0; }
        if (r >= rows) return false;
        c += s.length;
        if (c < cols) c++;
    }
    return true;
}

// ─── Place sets onto the rows×cols board ─────────────────────────────────────
// Only call with sets that fit (see setsFit / fitMoveOnBoard). It used to skip the
// sets that did not fit, and their tiles disappeared from the game.
export function placeSetsOnBoard(sets, rows, cols) {
    const board = Array(rows).fill(null).map(() => Array(cols).fill(null));
    let r = 0, c = 0;
    for (const s of sets) {
        if (c + s.length > cols) { r++; c = 0; }
        if (r >= rows) throw new Error('placeSetsOnBoard: the sets do not fit on the board');
        s.forEach(card => { board[r][c++] = card; });
        if (c < cols) c++;
    }
    return board;
}

// ─── Safety net: make the AI's move fit on the board ─────────────────────────
// The AI rebuilds the whole board (board tiles + its own tiles). If its sets do not
// fit, drop sets from the end of its list — but never a set that is needed to keep
// every board tile on the board. Hand tiles of dropped sets stay in the hand.
// Returns { sets, board, remainingHand }, or null when there is no move that fits
// (then the computer draws / passes). When everything fits, nothing changes.
export function fitMoveOnBoard(hand, boardCards, sets, rows, cols) {
    const kept = [...sets];
    while (!setsFit(kept, rows, cols)) {
        let i = kept.length - 1;
        while (i >= 0 && !allBoardCardsPresent(boardCards, kept.filter((_, j) => j !== i))) i--;
        if (i < 0) return null;           // even the sets with board tiles do not fit
        kept.splice(i, 1);
    }
    if (countHandUsed(hand, boardCards, kept) === 0) return null;   // nothing left to play from the hand
    return {
        sets: kept,
        board: placeSetsOnBoard(kept, rows, cols),
        remainingHand: computeRemainingHand(hand, boardCards, kept),
    };
}

// ═══ Jokers ═══════════════════════════════════════════════════════════════════
// The original algorithm runs exactly as before, on the hand without jokers.
// Then the joker pass:
//   1. Each joker completes the most valuable "almost set" left in the hand: a pair
//      of the same number (→ group) or of the same color 1–2 apart (→ run).
//   2. Two jokers + one last tile → one set (the hand is empty: win).
//   3. Only jokers left → add them to this move's sets (the hand is empty: win).
// Otherwise jokers stay in the hand (they are not wasted on sets that are complete).
// Returns { boardSets: the algorithm's sets, jokerSets: new sets with a joker }.
export function findSetsWithJokers(hand, boardCards) {
    const jokers = hand.filter(isJoker);
    const { sets: boardSets } = matrixGreedyFindSets(hand.filter(t => !isJoker(t)), boardCards);
    const rest = computeRemainingHand(hand.filter(t => !isJoker(t)), boardCards, boardSets);
    const jokerSets = [];

    // 1. Complete the most valuable pair
    while (jokers.length > 0) {
        const best = bestPairForJoker(rest, jokers[0]);
        if (!best) break;
        jokerSets.push(best.set);
        for (const t of best.pair) rest.splice(rest.indexOf(t), 1);
        jokers.shift();
    }

    // 2. Two jokers and one tile left
    if (jokers.length === 2 && rest.length === 1)
        jokerSets.push([rest.pop(), ...jokers.splice(0, 2)]);

    // 3. Only jokers left: add each one to a set of this move
    if (rest.length === 0) {
        const sets = [...boardSets, ...jokerSets];
        for (let k = jokers.length - 1; k >= 0; k--) {
            for (const s of sets) {
                const longer = [[...s, jokers[k]], [jokers[k], ...s]].find(isValidSet);
                if (longer) { s.splice(0, s.length, ...longer); jokers.splice(k, 1); break; }
            }
        }
    }
    return { boardSets, jokerSets };
}

// The pair (a, b) from `tiles` that makes the most valuable valid set with the joker
function bestPairForJoker(tiles, joker) {
    let best = null;
    for (let i = 0; i < tiles.length; i++)
        for (let j = i + 1; j < tiles.length; j++) {
            const [lo, hi] = tiles[i][1] <= tiles[j][1] ? [tiles[i], tiles[j]] : [tiles[j], tiles[i]];
            for (const set of [[lo, hi, joker], [joker, lo, hi], [lo, joker, hi]]) {
                if (!isValidSet(set)) continue;
                const points = setPoints(set);
                if (!best || points > best.points) best = { set, pair: [lo, hi], points };
            }
        }
    return best;
}
