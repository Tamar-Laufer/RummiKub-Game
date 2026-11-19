document.addEventListener('DOMContentLoaded', () => {
    const homeBtn = document.getElementById('home-btn');
    const newGameBtn = document.getElementById('new-game-btn');

    // Button click handlers
    homeBtn.addEventListener('click', () => {
        window.location.href = '../html/home.html'; // Replace with your home page URL
    });

    newGameBtn.addEventListener('click', () => {
        window.location.href = '../html/game.html'; // Replace with your game page URL
    });
});
