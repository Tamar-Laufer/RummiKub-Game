// ─── UI widgets (DOM) ─────────────────────────────────────────────────────────

// ─── Turn indicator ───────────────────────────────────────────────────────────
export function updateTurnIndicator(isPlayer) {
    const banner       = document.getElementById('turn-banner');
    const turnText     = document.getElementById('turn-text');
    const turnIcon     = document.getElementById('turn-icon');
    const slotHuman    = document.getElementById('slot-human');
    const slotComputer = document.getElementById('slot-computer');

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const playerName  = (currentUser && currentUser.username) ? currentUser.username : 'Your';

    if (isPlayer) {
        banner.classList.remove('computer-turn');
        turnIcon.textContent = '✦';
        turnText.textContent  = `${playerName}'s Turn`;
        slotHuman.classList.add('active-turn');
        slotComputer.classList.remove('active-turn');
    } else {
        banner.classList.add('computer-turn');
        turnIcon.textContent = '🤖';
        turnText.textContent = "Bob's Turn";
        slotComputer.classList.add('active-turn');
        slotHuman.classList.remove('active-turn');
    }

    // Re-trigger the icon spin animation
    turnIcon.style.animation = 'none';
    void turnIcon.offsetWidth;
    turnIcon.style.animation = '';
}

// ─── Status text in the turn banner (during the computer's turn) ────────────
export function setTurnStatus(text) {
    document.getElementById('turn-text').textContent = text;
}

// ─── Lock / unlock the player's input (tiles and buttons) ────────────────────
// Locked during the computer's turn: tiles cannot be dragged, buttons are disabled.
export function setInputEnabled(enabled) {
    document.body.classList.toggle('input-locked', !enabled);
    for (const id of ['addCard', 'finishTurn']) {
        const button = document.getElementById(id);
        if (button) button.disabled = !enabled;
    }
}

// ─── ?debug: the computer's hand, always visible ─────────────────────────────
const DEBUG_COLORS = { red: '#ff5a5a', black: '#dddddd', blue: '#6aa8ff', orange: '#ffb340', joker: '#f0d060' };

export function showDebugHand(tiles) {
    let panel = document.getElementById('debug-hand');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'debug-hand';
        document.body.appendChild(panel);
    }
    const sorted = [...tiles].sort((a, b) => a[0].localeCompare(b[0]) || (a[1] > b[1] ? 1 : -1));
    panel.innerHTML = `<b>DEBUG — Bob's hand (${tiles.length})</b><br>` + sorted.map(([color, num]) =>
        `<span style="color:${DEBUG_COLORS[color] || '#fff'}">${color === 'joker' ? 'J' : num}</span>`).join(' ');
}

// ─── Card counts ─────────────────────────────────────────────────────────────
export function updateCardCounts(state) {
    const hc = document.getElementById('human-count');
    const cc = document.getElementById('computer-count');
    const dc = document.getElementById('deck-count');
    if (hc) hc.textContent = `${state.playerCards.length} cards`;
    if (cc) cc.textContent = `${state.computerCards.length} cards`;
    if (dc) dc.textContent = state.remainingDeck.length;
}

// ─── Message box ──────────────────────────────────────────────────────────────
export function showMessageBox(text, yesLabel, noLabel, onYes, onNo) {
    const overlay = document.getElementById('overlay');
    document.getElementById('message-text').textContent = text;

    // Clone to remove any previous event listeners
    ['right', 'left'].forEach(id => {
        const old   = document.getElementById(id);
        const fresh = old.cloneNode(true);
        old.parentNode.replaceChild(fresh, old);
    });

    const btnYes = document.getElementById('right');
    const btnNo  = document.getElementById('left');
    btnYes.textContent = yesLabel;
    btnNo.textContent  = noLabel;

    btnYes.addEventListener('click', () => { overlay.classList.remove('show'); onYes(); });
    btnNo.addEventListener('click',  () => { overlay.classList.remove('show'); onNo();  });

    overlay.classList.add('show');
}
