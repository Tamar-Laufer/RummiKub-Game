// ─── Set validation (original isValidSet logic) ───────────────────────────────

function isValidGroup(tiles) {
    if (tiles.length < 3 || tiles.length > 4) return false;
    const num    = tiles[0][1];
    const colors = new Set(tiles.map(t => t[0]));
    return tiles.every(t => t[1] === num) && colors.size === tiles.length;
}

function isValidRun(tiles) {
    if (tiles.length < 3) return false;
    const color  = tiles[0][0];
    const sorted = [...tiles].sort((a, b) => a[1] - b[1]);
    return sorted.every((t, i) =>
        t[0] === color && (i === 0 || t[1] === sorted[i - 1][1] + 1)
    );
}

function isValidSet(tiles) {
    return isValidGroup(tiles) || isValidRun(tiles);
}

// ─── Full board validation (original isValidRummikubSeriesMatrix logic) ───────
function isBoardValid() {
    for (let r = 0; r < 5; r++) {
        let run = [];
        for (let c = 0; c <= 22; c++) {
            const tile = c < 22 ? gameBoard[r][c] : null;
            if (tile) {
                run.push(tile);
            } else if (run.length > 0) {
                if (!isValidSet(run)) return false;
                run = [];
            }
        }
    }
    return true;
}
