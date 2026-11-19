let currentUser = JSON.parse(localStorage.getItem('currentUser'));

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    window.location.href = '../html/contat.html';
}

window.addEventListener('load', function () {
    if (!currentUser) {
        window.location.href = '../html/contat.html';
        return;
    }

    // Show username in both possible elements
    const display  = document.getElementById('username-display');
    const legacyEl = document.querySelector('#user span');
    const name     = currentUser.username || '';

    if (display)  display.textContent  = name;
    if (legacyEl) legacyEl.textContent = `Hello ${name}`;
});

document.addEventListener('DOMContentLoaded', function () {
    const card1 = document.getElementById('card1');
    const card2 = document.getElementById('card2');
    const card3 = document.getElementById('card3');

    if (card1) card1.addEventListener('click', () =>
        alert('Solitaire is coming soon!'));

    if (card2) card2.addEventListener('click', () =>
        alert('Chess is coming soon!'));

    if (card3) card3.addEventListener('click', () =>
        window.location.href = '../html/game.html');
});
