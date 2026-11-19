document.addEventListener('DOMContentLoaded', () => {
    const confettiContainer = document.getElementById('confetti');
    const homeBtn = document.getElementById('home-btn');
    const newGameBtn = document.getElementById('new-game-btn');

    // Create confetti
    function createConfetti() {
        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 50%, 50%)`;
            confetti.style.animationDelay = `${Math.random() * 2}s`;
            confettiContainer.appendChild(confetti);
        }
    }

    // Button click handlers
    homeBtn.addEventListener('click', () => {
        window.location.href = '../html/home.html'; // Replace with your home page URL
    });

    newGameBtn.addEventListener('click', () => {
        window.location.href = '../html/game.html'; // Replace with your game page URL
    });

    // Initialize confetti
    createConfetti();
});
