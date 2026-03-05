// Auth Functions

async function initAuth() {
    if (authToken && currentUser) {
        try {
            await api.get('/auth/verify');
            showMainApp();
            if (typeof initializeSocket === 'function') initializeSocket();
            if (typeof loadInitialData === 'function') loadInitialData();
        } catch (error) {
            showLoginScreen();
        }
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.textContent = currentUser.username;

    const userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl) userAvatarEl.textContent = currentUser.username[0].toUpperCase();

    const settingsUsernameEl = document.getElementById('settings-username');
    if (settingsUsernameEl) settingsUsernameEl.value = currentUser.username;

    const settingsEmailEl = document.getElementById('settings-email');
    if (settingsEmailEl) settingsEmailEl.value = currentUser.email || '';
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

            try {
                const data = await api.post('/auth/login', {
                    username: document.getElementById('login-username').value,
                    password: document.getElementById('login-password').value
                });

                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('token', authToken);
                localStorage.setItem('user', JSON.stringify(currentUser));

                showMainApp();
                if (typeof initializeSocket === 'function') initializeSocket();
                if (typeof loadInitialData === 'function') loadInitialData();
            } catch (error) {
                if (typeof showToast === 'function') showToast(error.message, 'error');
                else alert(error.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
            }
        });
    }
});

function togglePassword() {
    const input = document.getElementById('login-password');
    const icon = document.getElementById('toggle-icon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (typeof socket !== 'undefined' && socket) socket.disconnect();
    showLoginScreen();
}
