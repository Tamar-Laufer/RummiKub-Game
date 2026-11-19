document.addEventListener('DOMContentLoaded', () => {
    const instructionsDisplay = document.getElementById('instructions-display');
    const playBtn = document.getElementById('play-btn');

    const instructions = [
        "Welcome to Rummikub!",
        "Objective: Be the first to play all your tiles.",
        "Setup: Each player gets 14 tiles.",
        "Players take turns doing one of these actions:",
        "1. Place sets (groups or runs)",
        "2. Add to existing sets",
        "3. Replace a joker",
        "4. Draw a tile if no move is possible",
        "First meld must total at least 30 points.",
        "Runs: 3+ consecutive numbers in same color",
        "Groups: 3-4 same number in different colors",
        "Strategy is key! Plan your moves carefully.",
        "Good luck and have fun!"
    ];

    let currentLine = 0;
    let currentChar = 0;

    function displayInstructions() {
        if (currentLine < instructions.length) {
            if (currentChar < instructions[currentLine].length) {
                instructionsDisplay.innerHTML += instructions[currentLine][currentChar];
                currentChar++;
                setTimeout(displayInstructions, 35); // Faster animation (reduced from 50 to 35)
            } else {
                instructionsDisplay.innerHTML += '<br>';
                currentLine++;
                currentChar = 0;
                setTimeout(displayInstructions, 35);
            }
        }
    }

    playBtn.addEventListener('click', () => {
        // Add game start logic here
        window.location.href = '../html/game.html';
    });

    // Show play button immediately
    playBtn.classList.remove('hidden');

    displayInstructions();
});
