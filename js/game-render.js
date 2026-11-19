// ─── Card element ─────────────────────────────────────────────────────────────
function createCardEl(card, id) {
    const el = document.createElement('div');
    el.className = 'card';
    el.id = id;
    el.draggable = true;

    const numSpan = document.createElement('span');
    numSpan.textContent = card[1];
    numSpan.style.color = COLOR_HEX[card[0]] || '#000';

    const hiddenColor = document.createElement('span');
    hiddenColor.textContent = card[0];
    hiddenColor.style.display = 'none';

    const logo = document.createElement('p');
    logo.textContent = 'Rummikub';

    el.append(numSpan, hiddenColor, logo);

    el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', id);
        el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));

    return el;
}

// ─── Render board ─────────────────────────────────────────────────────────────
function renderBoard() {
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 22; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (!cell) continue;
            cell.innerHTML = '';
            if (gameBoard[r][c])
                cell.appendChild(createCardEl(gameBoard[r][c], `bc-${r}-${c}`));
        }
    }
}

// ─── Render tray ──────────────────────────────────────────────────────────────
function renderTray() {
    const box = document.querySelector('.box');
    if (!box) return;
    box.innerHTML = '';
    playerCards.forEach((card, i) =>
        box.appendChild(createCardEl(card, `tc-${i}`))
    );
}

function render() {
    renderBoard();
    renderTray();
    if (typeof updateCardCounts === 'function') updateCardCounts();
}
