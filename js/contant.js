// Initialize users array from localStorage
let users = JSON.parse(localStorage.getItem('users')) || [];
let currentUser = null;

// Display login modal on page load
window.addEventListener('load', function () {
    document.getElementById('loginModal').style.display = 'block';
});

// Open and close modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Switch between login and signup modals
function switchToSignup() {
    closeModal('loginModal');
    openModal('signupModal');
}

function switchToLogin() {
    closeModal('signupModal');
    openModal('loginModal');
}

// Handle signup form submission
document.getElementById('signupForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const username = this.querySelector('input[type="text"]').value;
    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelectorAll('input[type="password"]')[0].value;
    const confirmPassword = this.querySelectorAll('input[type="password"]')[1].value;

    if (password !== confirmPassword) {
        alert("Passwords don't match!");
        return;
    }

    if (users.some(user => user.email === email)) {
        alert('User already exists!');
        return;
    }

    const newUser = {
        username,
        email,
        password
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    currentUser = newUser;
    localStorage.setItem('currentUser', JSON.stringify(newUser));

    alert('Successfully registered!');
    // אותו נתיב בדיוק כמו בלוגין
    window.location.href = '../html/home.html';
});

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelector('input[type="password"]').value;

    const user = users.find(user => user.email === email && user.password === password);

    if (user) {
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        alert('Successfully logged in!');
        window.location.href = '../html/home.html';
    } else {
        alert('Invalid email or password!');
    }
});