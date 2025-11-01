// --- UTILITY AND SETUP ---
const AUTH_SECTION = document.getElementById('auth-section');
const DASHBOARD_SECTION = document.getElementById('dashboard-section');
const USER_DISPLAY = document.getElementById('user-display');
const HABITS_LIST_DIV = document.getElementById('habits-list');

// Form Elements
const REGISTER_FORM = document.getElementById('register-form');
const LOGIN_FORM = document.getElementById('login-form');
const NEW_HABIT_FORM = document.getElementById('new-habit-form');

// Gamification Elements (Ensure these IDs are in your index.html)
const USER_LEVEL = document.getElementById('user-level');
const USER_XP_TOTAL = document.getElementById('user-xp-total');
const XP_BAR_FILL = document.getElementById('xp-bar-fill');
const XP_NEEDED = document.getElementById('xp-needed');


const BASE_URL = 'http://localhost:5000'; // Flask runs on port 5000

// Helper function to send data and manage sessions
async function apiFetch(url, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : null,
        credentials: 'include', // CRITICAL: Sends and receives the secure session cookie
    };

    try {
        const response = await fetch(BASE_URL + url, options);
        const jsonResponse = await response.json();

        // Check for 401 Unauthorized errors from the server
        if (response.status === 401) {
             alert("Session expired. Please log in again.");
             logoutUser(false);
             return null;
        }
        return jsonResponse;
    } catch (error) {
        console.error('API Fetch Error:', error);
        alert("Server connection error. Check if backend is running on port 5000.");
        return null;
    }
}

// --- UI MANAGEMENT ---
function showDashboard(username) {
    AUTH_SECTION.style.display = 'none';
    DASHBOARD_SECTION.style.display = 'block';
    USER_DISPLAY.textContent = username;
}

function logoutUser(redirect = true) {
    // Clear session and refresh UI
    AUTH_SECTION.style.display = 'block';
    DASHBOARD_SECTION.style.display = 'none';
    if (redirect) location.reload();
}


// --- INITIAL AUTHENTICATION CHECK ---
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

// --- AUTHENTICATION HANDLERS ---

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;

    const data = await apiFetch('/api/register', 'POST', { username, password });

    if (data) {
        alert(data.message);
        if (data.message === "Registration successful") {
            // Automatically log in the new user after successful registration
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
    // Uses the /api/status endpoint which now returns XP and Level
    const userData = await apiFetch('/api/status');

    if (userData && userData.logged_in) {
        const xp = userData.xp || 0;
        const level = userData.level || 1;
        const xpNeeded = level * 100; // Example formula: 100 XP per level

        // These elements MUST exist in index.html for the gamification to show
        if (USER_LEVEL && USER_XP_TOTAL && XP_BAR_FILL) {
            USER_LEVEL.textContent = level;
            USER_XP_TOTAL.textContent = xp;
            XP_NEEDED.textContent = xpNeeded;

            const progressPercent = Math.min(100, (xp / xpNeeded) * 100);
            XP_BAR_FILL.style.width = `${progressPercent}%`;
        }
    }
}


// --- HABIT CRUD LOGIC ---

// Handler for New Habit Form Submission (POST)
async function handleCreateHabit(e) {
    e.preventDefault();
    const name = document.getElementById('new-habit-name').value;

    const data = await apiFetch('/api/habits', 'POST', { name });

    if (data && data.message.includes("created successfully")) {
        document.getElementById('new-habit-form').reset();
        fetchAndRenderHabits(); // Reload list
    } else if (data) {
        alert("Error adding habit: " + data.message);
    }
}

// Handler for Habit Logging (POST)
async function handleLogHabit(habitId) {
    const data = await apiFetch('/api/log', 'POST', { habit_id: habitId });

    if (data && data.message.includes("logged successfully")) {
        alert("Habit checked off! Keep the streak going! +10 XP");
        fetchAndRenderHabits();
        fetchAndUpdateGamificationStats(); // Update XP
    } else if (data && data.message.includes("already logged today")) {
        alert("You already checked this off today.");
    } else if (data) {
        alert("Error logging habit: " + data.message);
    }
}

// Handler for Habit Deletion (DELETE)
async function handleDeleteHabit(habitId, habitName) {
    if (!confirm(`Are you sure you want to delete the habit: ${habitName}? This cannot be undone.`)) return;

    const data = await apiFetch(`/api/habits/${habitId}`, 'DELETE');

    if (data && data.message.includes("deleted successfully")) {
        alert(data.message);
        fetchAndRenderHabits(); // Reload list
    } else if (data) {
        alert("Error deleting habit: " + data.message);
    }
}

// Handler for Displaying Habits (GET)
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

        // Attach event listeners to the dynamically created buttons
        card.querySelector('.check-btn').addEventListener('click', () => handleLogHabit(habit.id));
        card.querySelector('.delete-btn').addEventListener('click', () => handleDeleteHabit(habit.id, habit.name));

        HABITS_LIST_DIV.appendChild(card);
    });
}


// --- SLEEP LOG LOGIC (Bonus Feature) ---
// Note: Requires sleep log form and modal to be present in index.html
async function handleSleepLog(e) {
    e.preventDefault();
    const bedtime = document.getElementById('bedtime').value;
    const wake_up = document.getElementById('wake-up').value;
    const quality = document.getElementById('quality').value; // Assuming a 1-5 rating or similar

    const data = await apiFetch('/api/sleep', 'POST', { bedtime, wake_up, quality });

    if (data && data.message.includes("logged successfully")) {
        alert(data.message);
        // Assuming SLEEP_MODAL is defined
        const SLEEP_MODAL = document.getElementById('sleep-modal');
        if (SLEEP_MODAL) SLEEP_MODAL.style.display = 'none';

        fetchAndUpdateGamificationStats();
        document.getElementById('sleep-log-form').reset();
    } else if (data) {
        alert("Error: " + data.message);
    }
}


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Core Status Check
    checkLoginStatus();

    // 2. Attach Event Listeners to Forms
    REGISTER_FORM.addEventListener('submit', handleRegister);
    LOGIN_FORM.addEventListener('submit', handleLogin);
    NEW_HABIT_FORM.addEventListener('submit', handleCreateHabit);

    // Assuming you have a Logout button and Sleep Form:
    const LOGOUT_BTN = document.getElementById('logout-btn');
    if (LOGOUT_BTN) LOGOUT_BTN.addEventListener('click', logoutUser);

    const SLEEP_LOG_FORM = document.getElementById('sleep-log-form');
    if (SLEEP_LOG_FORM) SLEEP_LOG_FORM.addEventListener('submit', handleSleepLog);
});