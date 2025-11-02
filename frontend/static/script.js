// --- UTILITY AND SETUP ---
const AUTH_SECTION = document.getElementById('auth-section');
const DASHBOARD_SECTION = document.getElementById('dashboard-section');
const USER_DISPLAY = document.getElementById('user-display');
const HABITS_LIST_DIV = document.getElementById('habits-list');

// Gamification Elements
const USER_LEVEL = document.getElementById('user-level');
const USER_XP_TOTAL = document.getElementById('user-xp-total');
const XP_BAR_FILL = document.getElementById('xp-bar-fill');
const XP_NEEDED = document.getElementById('xp-needed');

// Sleep Modal Elements
const SLEEP_MODAL = document.getElementById('sleep-modal');
const OPEN_SLEEP_LOG_BTN = document.getElementById('open-sleep-log-btn');
const CLOSE_MODAL_BTN = document.querySelector('.modal-content .close-btn');

const BASE_URL = 'https://smart-habit-tracker-api-303d.onrender.com'; // Change to DEPLOYED URL later!

// Helper function to send data and include session cookies
async function apiFetch(url, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : null,
        credentials: 'include', // CRITICAL for Flask sessions
    };

    try {
        const response = await fetch(BASE_URL + url, options);
        if (response.status === 401) {
             alert("Session expired. Please log in again.");
             logoutUser(false);
             return null;
        }
        return response.json();
    } catch (error) {
        console.error('API Fetch Error:', error);
        alert("Server connection error. Check if backend is running.");
        return null;
    }
}

// --- AUTHENTICATION HANDLERS ---
function showDashboard(username) {
    AUTH_SECTION.style.display = 'none';
    DASHBOARD_SECTION.style.display = 'block';
    USER_DISPLAY.textContent = username;
}

function logoutUser(redirect = true) {
    // Note: Flask clears the session on its own when the cookie expires/changes.
    // We just update the UI and refresh.
    AUTH_SECTION.style.display = 'block';
    DASHBOARD_SECTION.style.display = 'none';
    if (redirect) location.reload();
}

async function checkLoginStatus() {
    const data = await apiFetch('/api/status');
    if (data && data.logged_in) {
        showDashboard(data.username);
        fetchAndRenderHabits();
        fetchAndUpdateGamificationStats();
    } else {
        logoutUser(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;

    const data = await apiFetch('/api/register', 'POST', { username, password });

    if (data) {
        alert(data.message);
        if (data.message === "Registration successful") {
            document.getElementById('register-form').reset();
            // Automatically log the new user in (optional, but good UX)
            handleLogin(new Event('submit'), username, password);
        }
    }
}

async function handleLogin(e, initialUsername = null, initialPassword = null) {
    if (e) e.preventDefault();
    const username = initialUsername || document.getElementById('login-username').value;
    const password = initialPassword || document.getElementById('login-password').value;

    const data = await apiFetch('/api/login', 'POST', { username, password });

    if (data && data.message === "Login successful") {
        showDashboard(data.username);
        fetchAndRenderHabits();
        fetchAndUpdateGamificationStats();
    } else if (data) {
        alert("Login Failed: " + data.message);
    }
}

// --- GAMIFICATION LOGIC ---
async function fetchAndUpdateGamificationStats() {
    const userData = await apiFetch('/api/status');
    if (userData && userData.logged_in) {
        // NOTE: You need to modify app.py's /api/status to return xp and level from User model
        const xp = userData.xp || 0;
        const level = userData.level || 1;
        const xpNeeded = level * 100; // Example formula: 100 XP per level

        USER_LEVEL.textContent = level;
        USER_XP_TOTAL.textContent = xp;
        XP_NEEDED.textContent = xpNeeded;

        // Calculate and set the width of the XP bar
        const progressPercent = Math.min(100, (xp / xpNeeded) * 100);
        XP_BAR_FILL.style.width = `${progressPercent}%`;
    }
}


// --- HABIT CRUD LOGIC ---
async function handleCreateHabit(e) {
    e.preventDefault();
    const name = document.getElementById('new-habit-name').value;

    const data = await apiFetch('/api/habits', 'POST', { name });

    if (data && data.message.includes("created successfully")) {
        document.getElementById('new-habit-form').reset();
        fetchAndRenderHabits();
    } else if (data) {
        alert("Error adding habit: " + data.message);
    }
}

async function handleLogHabit(habitId) {
    const data = await apiFetch('/api/log', 'POST', { habit_id: habitId });

    if (data && data.message.includes("logged successfully")) {
        alert("Habit checked off! Keep the streak going!");
        fetchAndRenderHabits(); // Re-render to show checkmark/new streak
        fetchAndUpdateGamificationStats(); // Update XP
    } else if (data && data.message.includes("already logged today")) {
        alert("You already checked this off today.");
    } else if (data) {
        alert("Error logging habit: " + data.message);
    }
}

async function handleDeleteHabit(habitId, habitName) {
    if (!confirm(`Are you sure you want to delete the habit: ${habitName}?`)) return;

    const data = await apiFetch(`/api/habits/${habitId}`, 'DELETE');

    if (data && data.message.includes("deleted successfully")) {
        alert(data.message);
        fetchAndRenderHabits();
    } else if (data) {
        alert("Error deleting habit: " + data.message);
    }
}

async function fetchAndRenderHabits() {
    HABITS_LIST_DIV.innerHTML = '<p>Loading habits...</p>';
    const habits = await apiFetch('/api/habits');

    if (!habits || habits.length === 0) {
        HABITS_LIST_DIV.innerHTML = '<p>No habits yet! Click "Add Habit" to start your first streak.</p>';
        return;
    }

    HABITS_LIST_DIV.innerHTML = '';

    habits.forEach(habit => {
        const buttonDisabled = habit.logged_today ? 'disabled' : '';
        const checkOffClass = habit.logged_today ? 'checked-off' : '';
        const buttonText = habit.logged_today ? '✅ DONE' : '🎯 Check Off';

        const card = document.createElement('div');
        card.className = `habit-card ${checkOffClass}`;

        card.innerHTML = `
            <p><strong>${habit.name}</strong></p>
            <p class="streak-count">🔥 Streak: ${habit.streak} days</p>
            <div>
                <button class="check-btn" ${buttonDisabled} data-id="${habit.id}">${buttonText}</button>
                <button class="delete-btn" data-id="${habit.id}">🗑️</button>
            </div>
        `;

        // Attach event listeners
        card.querySelector('.check-btn').addEventListener('click', () => handleLogHabit(habit.id));
        card.querySelector('.delete-btn').addEventListener('click', () => handleDeleteHabit(habit.id, habit.name));

        HABITS_LIST_DIV.appendChild(card);
    });
}


// --- SLEEP LOG LOGIC ---
async function handleSleepLog(e) {
    e.preventDefault();
    const bedtime = document.getElementById('bedtime').value;
    const wake_up = document.getElementById('wake-up').value;
    const quality = document.getElementById('quality').value;

    const data = await apiFetch('/api/sleep', 'POST', { bedtime, wake_up, quality });

    if (data && data.message.includes("logged successfully")) {
        alert(data.message);
        SLEEP_MODAL.style.display = 'none';
        // Update the XP display
        fetchAndUpdateGamificationStats();
        document.getElementById('sleep-log-form').reset();
    } else if (data) {
        alert("Error: " + data.message);
    }
}

// --- DARK MODE LOGIC (Accessibility) ---
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('dark-mode', document.body.classList.contains('dark-mode'));
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Load Dark Mode preference
    if (localStorage.getItem('dark-mode') === 'true') {
        document.body.classList.add('dark-mode');
    }

    // Core Status Check
    checkLoginStatus();

    // Attach Event Listeners
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('new-habit-form').addEventListener('submit', handleCreateHabit);
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);

    // Modal Listeners
    OPEN_SLEEP_LOG_BTN.addEventListener('click', () => { SLEEP_MODAL.style.display = 'block'; });
    CLOSE_MODAL_BTN.addEventListener('click', () => { SLEEP_MODAL.style.display = 'none'; });
    document.getElementById('sleep-log-form').addEventListener('submit', handleSleepLog);
    window.addEventListener('click', (event) => {
        if (event.target === SLEEP_MODAL) {
            SLEEP_MODAL.style.display = 'none';
        }
    });
});