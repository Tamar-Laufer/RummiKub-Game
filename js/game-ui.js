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

// ─── Server status indicator ──────────────────────────────────────────────────
export function setServerStatus(online) {
    let el = document.getElementById('server-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'server-status';
        el.style.cssText =
            'position:fixed;bottom:10px;right:14px;font-size:11px;' +
            'padding:3px 9px;border-radius:10px;color:#fff;z-index:9999;opacity:0.75';
        document.body.appendChild(el);
    }
    el.textContent = online ? '🐍 Python' : '⚡ JS';
    el.style.background = online ? '#2a6' : '#444';
}
