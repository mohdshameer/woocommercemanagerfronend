// Auth Functions

export function initLoginPage() {
    const container = document.getElementById('login-screen');
    if (!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 slide-in-right">
            <div class="text-center mb-8">
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 drop-shadow-lg">
                    <img src="https://images.sheshoponline.in/Products/logo.webp" alt="Site Logo"
                        class="w-full h-full object-contain">
                </div>
                <h1 class="text-2xl font-bold text-slate-800">SheShop Product Manager</h1>
                <p class="text-slate-500">Sign in to manage your inventory</p>
            </div>

            <form id="login-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Username</label>
                    <input type="text" id="login-username" required
                        class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                        placeholder="admin">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div class="relative">
                        <input type="password" id="login-password" required
                            class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                            placeholder="••••••••">
                        <button type="button" onclick="togglePassword()"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <i class="fas fa-eye" id="toggle-icon"></i>
                        </button>
                    </div>
                </div>
                <div class="flex items-center justify-between text-sm">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox"
                            class="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500">
                        <span class="text-slate-600">Remember me</span>
                    </label>
                    <a href="#" class="text-brand-600 hover:text-brand-700 font-medium">Forgot password?</a>
                </div>
                <button type="submit" id="login-btn"
                    class="w-full py-3 bg-brand-600 hover:bg-brand-700 text-slate-900 font-semibold rounded-xl shadow-lg shadow-brand-500/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <span>Sign In</span>
                    <i class="fas fa-arrow-right"></i>
                </button>
            </form>

        </div>
    `;

    // Attach event listeners after rendering HTML
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
}


async function initAuth() {
    if (window.authToken && window.currentUser) {
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
    if (userNameEl) userNameEl.textContent = window.currentUser.username;

    const userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl) userAvatarEl.textContent = window.currentUser.username[0].toUpperCase();

    const settingsUsernameEl = document.getElementById('settings-username');
    if (settingsUsernameEl) settingsUsernameEl.value = window.currentUser.username;

    const settingsEmailEl = document.getElementById('settings-email');
    if (settingsEmailEl) settingsEmailEl.value = window.currentUser.email || '';
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

    try {
        const data = await api.post('/auth/login', {
            username: document.getElementById('login-username').value,
            password: document.getElementById('login-password').value
        });

        window.authToken = data.token;
        window.currentUser = data.user;
        localStorage.setItem('token', window.authToken);
        localStorage.setItem('user', JSON.stringify(window.currentUser));

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
}

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
    window.authToken = null;
    window.currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (typeof socket !== 'undefined' && socket) socket.disconnect();
    showLoginScreen();
}

// Expose global functions
window.togglePassword = togglePassword;
window.logout = logout;
window.initAuth = initAuth;
