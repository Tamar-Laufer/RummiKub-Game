// ─── Rules: set and board validation (logic only, no DOM) ───────────────────
// A set is valid if it is a group or a run. Jokers can stand for any tile.
// setValues() tells which number each tile stands for (needed for jokers in the
// opening sum); the validity checks are built on it.

// ─── Jokers ───────────────────────────────────────────────────────────────────
// A joker is ['joker', 'red'] or ['joker', 'black'] (two in the game).
export const isJoker = tile => tile[0] === 'joker';

const sum = values => values.reduce((a, b) => a + b, 0);

// ─── Group: 3–4 tiles, same number, different colors ─────────────────────────
// Jokers fill the missing colors. Returns the number of every tile, or null.
export function groupValues(tiles) {
    if (tiles.length < 3 || tiles.length > 4) return null;
    const real = tiles.filter(t => !isJoker(t));
    if (real.length === 0) return null;
    const num = real[0][1];
    if (!real.every(t => t[1] === num)) return null;
    if (new Set(real.map(t => t[0])).size !== real.length) return null;
    return tiles.map(() => num);
}

// ─── Run: 3+ tiles, same color, consecutive, increasing from left to right ───
// Each joker stands for the number its position needs. No number below 1 or
// above 13 (1 does not follow 13). Returns the number of every tile, or null.
export function runValues(tiles) {
    if (tiles.length < 3) return null;
    const first = tiles.findIndex(t => !isJoker(t));
    if (first < 0) return null;
    const color = tiles[first][0];
    const start = tiles[first][1] - first;                 // number of the leftmost tile
    const values = tiles.map((_, i) => start + i);
    if (values[0] < 1 || values[values.length - 1] > 13) return null;
    const ok = tiles.every((t, i) => isJoker(t) || (t[0] === color && t[1] === values[i]));
    return ok ? values : null;
}

// ─── Any set ──────────────────────────────────────────────────────────────────
// The numbers the tiles stand for, or null if the set is not valid.
// A set can be both (e.g. J J R5 = run 3,4,5 or group 5,5,5): the higher total counts.
export function setValues(tiles) {
    const group = groupValues(tiles), run = runValues(tiles);
    if (group && run) return sum(group) >= sum(run) ? group : run;
    return group || run;
}

// Points of a valid set (jokers count as the tile they stand for); 0 if not valid
export function setPoints(tiles) {
    const values = setValues(tiles);
    return values ? sum(values) : 0;
}

export function isValidGroup(tiles) { return groupValues(tiles) !== null; }
export function isValidRun(tiles)   { return runValues(tiles) !== null; }
export function isValidSet(tiles)   { return setValues(tiles) !== null; }

// Same color, different numbers, close enough together: a valid run in some other order
function couldBeRunInAnotherOrder(tiles) {
    const real = tiles.filter(t => !isJoker(t));
    if (real.length === 0 || tiles.length < 3 || tiles.length > 13) return false;
    if (!real.every(t => t[0] === real[0][0])) return false;
    const nums = real.map(t => t[1]);
    if (new Set(nums).size !== nums.length) return false;
    return Math.max(...nums) - Math.min(...nums) + 1 <= tiles.length;
}

// ─── Full board validation ────────────────────────────────────────────────────
// A set is a row segment of adjacent tiles; an empty cell separates sets.
// Returns the first invalid set and why ('run-order' = would be a run in increasing
// order from left to right; 'invalid' = anything else), or null if the board is valid.
export function findInvalidSet(board) {
    for (let r = 0; r < board.length; r++) {
        const cols = board[r].length;
        let run = [];
        for (let c = 0; c <= cols; c++) {
            const tile = c < cols ? board[r][c] : null;
            if (tile) {
                run.push(tile);
            } else if (run.length > 0) {
                if (!isValidSet(run))
                    return { tiles: run, reason: couldBeRunInAnotherOrder(run) ? 'run-order' : 'invalid' };
                run = [];
            }
        }
    }
    return null;
}

// Sets on the board = row segments of adjacent tiles (same rule as findInvalidSet):
// [{ row, col (of the first tile), tiles }]
export function segmentsOf(board) {
    const segments = [];
    board.forEach((row, r) => {
        let cur = null;
        for (let c = 0; c <= row.length; c++) {
            const tile = c < row.length ? row[c] : null;
            if (tile) {
                if (!cur) cur = { row: r, col: c, tiles: [] };
                cur.tiles.push(tile);
            } else if (cur) {
                segments.push(cur);
                cur = null;
            }
        }
    });
    return segments;
}

export function isBoardValid(board) {
    return findInvalidSet(board) === null;
}
