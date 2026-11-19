// ─── Tiles: deck creation, shuffle and draw (logic only, no DOM) ─────────────
export const COLORS = ['red', 'black', 'blue', 'orange'];

// ─── Full deck (2 copies × 4 colors × 13 numbers) ────────────────────────────
// No jokers yet (known issue in CLAUDE.md)
export const FULL_DECK = [];
for (const color of COLORS)
    for (let copy = 0; copy < 2; copy++)
        for (let num = 1; num <= 13; num++)
            FULL_DECK.push([color, num]);

// random: a function returning a number in [0, 1).
// The browser uses Math.random; the tests pass a seeded one so games can be replayed.
export function shuffledDeck(random = Math.random) {
    const d = [...FULL_DECK];
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
}

// Removes up to n cards from the top of the deck and returns them
export function drawCards(deck, n) {
    return deck.splice(0, Math.min(n, deck.length));
}
