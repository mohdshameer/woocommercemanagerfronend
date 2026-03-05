// Settings Logic

async function updateSettings() {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const newUsername = document.getElementById('settings-username').value;
    const newEmail = document.getElementById('settings-email').value;

    try {
        // In a real application, there would be an API endpoint here to update profile
        // await api.put('/user/profile', { username: newUsername, email: newEmail });

        if (currentUser) {
            currentUser.username = newUsername;
            currentUser.email = newEmail;
            localStorage.setItem('user', JSON.stringify(currentUser));
        }

        // Update UI
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = newUsername;
        const userAvatarEl = document.getElementById('user-avatar');
        if (userAvatarEl) userAvatarEl.textContent = newUsername[0].toUpperCase();

        if (typeof showToast === 'function') showToast('Settings saved successfully', 'success');
    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message || 'Failed to save settings', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
