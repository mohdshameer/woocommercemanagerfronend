// Settings Logic

async function updateSettings() {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const newUsername = document.getElementById('settings-username').value;
    const newEmail = document.getElementById('settings-email').value;

    try {
        if (currentUser) {
            currentUser.username = newUsername;
            currentUser.email = newEmail;
            localStorage.setItem('user', JSON.stringify(currentUser));
        }

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

// User Management
let usersList = [];

async function loadUsers() {
    try {
        const users = await api.get('/users');
        usersList = users || [];
        renderUsersTable();
    } catch (error) {
        console.error("Failed to load users:", error);
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    if (usersList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-slate-500">No users found.</td></tr>`;
        return;
    }

    tbody.innerHTML = usersList.map(user => {
        const isSuperAdmin = user.role === 'admin' || user.username === 'admin';
        return `
            <tr class="hover:bg-slate-50/50 transition-colors">
                <td class="px-4 py-3 font-medium text-slate-800 flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                        ${user.username[0].toUpperCase()}
                    </div>
                    ${user.username}
                </td>
                <td class="px-4 py-3">${user.email || '-'}</td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isSuperAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">
                        ${user.role}
                    </span>
                </td>
                <td class="px-4 py-3 text-right">
                    <button onclick="openChangePasswordModal('${user._id}', '${user.username}')" class="text-slate-400 hover:text-brand-600 p-1.5 transition-colors" title="Change Password">
                        <i class="fas fa-key"></i>
                    </button>
                    <button onclick="deleteUserAccount('${user._id}', '${user.username}')" class="text-slate-400 hover:text-red-600 p-1.5 transition-colors ${isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}" title="Delete User" ${isSuperAdmin ? 'disabled' : ''}>
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddUserModal() {
    document.getElementById('new-username').value = '';
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-password').value = '';

    document.getElementById('add-user-modal').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('add-user-content').classList.remove('opacity-0', 'scale-95');
        document.getElementById('add-user-content').classList.add('opacity-100', 'scale-100');
    }, 10);
}

function openChangePasswordModal(userId, username) {
    document.getElementById('change-password-user-id').value = userId;
    document.getElementById('change-password-username').textContent = `User: ${username}`;
    document.getElementById('update-password-input').value = '';

    document.getElementById('change-password-modal').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('change-password-content').classList.remove('opacity-0', 'scale-95');
        document.getElementById('change-password-content').classList.add('opacity-100', 'scale-100');
    }, 10);
}

function closeUserModal(type) {
    const content = document.getElementById(`${type === 'add' ? 'add-user' : 'change-password'}-content`);
    content.classList.remove('opacity-100', 'scale-100');
    content.classList.add('opacity-0', 'scale-95');

    setTimeout(() => {
        document.getElementById(`${type === 'add' ? 'add-user' : 'change-password'}-modal`).classList.add('hidden');
    }, 200);
}

async function createUser() {
    const btn = document.getElementById('create-user-btn');
    const originalText = btn.innerHTML;

    const username = document.getElementById('new-username').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        await api.post('/users', { username, email, password, role: 'user' });
        showToast('User created successfully', 'success');
        closeUserModal('add');
        await loadUsers();
    } catch (error) {
        showToast(error.message || 'Failed to create user', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function updateUserPassword() {
    const btn = document.getElementById('update-password-btn');
    const originalText = btn.innerHTML;

    const id = document.getElementById('change-password-user-id').value;
    const newPassword = document.getElementById('update-password-input').value;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

        await api.put(`/users/${id}/password`, { newPassword });
        showToast('Password updated successfully', 'success');
        closeUserModal('password');
    } catch (error) {
        showToast(error.message || 'Failed to update password', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function deleteUserAccount(id, username) {
    if (username === 'admin') {
        showToast('Cannot delete the super admin account', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    try {
        await api.delete(`/users/${id}`);
        showToast('User deleted successfully', 'success');
        await loadUsers();
    } catch (error) {
        showToast(error.message || 'Failed to delete user', 'error');
    }
}
