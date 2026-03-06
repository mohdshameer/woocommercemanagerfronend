// Core App Initialization & Sockets

let socket = null;
let currentSection = 'products';
let currentView = 'grid';

// Initialize App
async function init() {
    if (typeof initAuth === 'function') {
        await initAuth();
    }
}

// Socket.io
function initializeSocket() {
    if (typeof io === 'undefined') return;
    socket = io();

    socket.on('connect', () => {
        const el = document.getElementById('connection-status');
        if (el) {
            el.textContent = 'Connected to server';
            el.classList.add('text-emerald-400');
        }
    });

    socket.on('disconnect', () => {
        const el = document.getElementById('connection-status');
        if (el) {
            el.textContent = 'Disconnected - Reconnecting...';
            el.classList.remove('text-emerald-400');
        }
    });

    socket.on('stock:live-update', (data) => {
        if (typeof products !== 'undefined') {
            const product = products.find(p => p._id === data.productId);
            if (product) {
                product.stock = data.product.stock;
                product.status = data.product.status;
                product.lastUpdated = data.product.lastUpdated;
                if (typeof renderProducts === 'function') renderProducts();
                if (currentSection === 'inventory' && typeof renderInventory === 'function') renderInventory();
                showToast(`${product.name}: Stock changed by ${data.change}`, 'info');
            }
        }
    });

    socket.on('product:created', (product) => {
        if (typeof products !== 'undefined') {
            products.unshift(product);
            if (typeof renderProducts === 'function') renderProducts();
            if (typeof updateStats === 'function') updateStats();
            showToast('New product added', 'success');
        }
    });

    socket.on('product:updated', (product) => {
        if (typeof products !== 'undefined') {
            const idx = products.findIndex(p => p._id === product._id);
            if (idx !== -1) {
                products[idx] = product;
                if (typeof renderProducts === 'function') renderProducts();
                if (typeof updateStats === 'function') updateStats();
            }
        }
    });

    socket.on('product:deleted', (data) => {
        if (typeof products !== 'undefined') {
            products = products.filter(p => p._id !== data.id);
            if (typeof renderProducts === 'function') renderProducts();
            if (typeof updateStats === 'function') updateStats();
        }
    });
}

// Data Loading
let products = [];
let categoriesList = [];
let tagsList = [];
let wooAttributes = [];
let tempImages = [];
let tempAttributes = [];
let currentProduct = null;

async function loadInitialData() {
    try {
        const [productsData, stats, categories, tags, attributes] = await Promise.all([
            api.get('/products').catch(() => []),
            api.get('/dashboard/stats').catch(() => ({ total: 0, lowStock: 0, outOfStock: 0, totalValue: 0, recentActivity: [] })),
            api.get('/categories').catch(() => []),
            api.get('/tags').catch(() => []),
            api.get('/attributes').catch(() => [])
        ]);

        products = productsData || [];
        categoriesList = categories || [];
        tagsList = tags || [];
        wooAttributes = attributes || [];

        const catSelect = document.getElementById('category-filter');
        if (catSelect) {
            catSelect.innerHTML = '<option value="">All Categories</option>' +
                categoriesList.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }

        const editCat = document.getElementById('edit-category');
        if (editCat) {
            editCat.innerHTML = '<option value="">Select Category</option>' +
                categoriesList.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }

        const editTags = document.getElementById('edit-tags');
        if (editTags) {
            editTags.innerHTML = tagsList.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
        }

        if (typeof renderProducts === 'function') renderProducts();
        if (typeof updateStatsDisplay === 'function') updateStatsDisplay(stats);
        if (typeof renderActivity === 'function') renderActivity(stats.recentActivity);
    } catch (error) {
        showToast('Failed to load data', 'error');
    }
}

async function refreshData() {
    const icon = document.getElementById('refresh-icon');
    if (icon) icon.classList.add('fa-spin');
    await loadInitialData();
    if (icon) setTimeout(() => icon.classList.remove('fa-spin'), 500);
}

// Section Navigation
function showSection(section) {
    currentSection = section;

    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.section === section) {
            item.classList.add('bg-brand-50', 'text-brand-700');
            item.classList.remove('text-slate-600', 'hover:bg-slate-50');
        } else {
            item.classList.remove('bg-brand-50', 'text-brand-700');
            item.classList.add('text-slate-600', 'hover:bg-slate-50');
        }
    });

    document.querySelectorAll('.section-content').forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('flex');
    });

    const activeSection = document.getElementById(`section-${section}`);
    if (activeSection) {
        activeSection.classList.remove('hidden');
        activeSection.classList.add('flex');
    }

    if (section === 'inventory' && typeof renderInventory === 'function') renderInventory();
    if (section === 'activity' && typeof loadActivity === 'function') loadActivity();
    if (section === 'settings') {
        const userManagementSection = document.getElementById('user-management-section');
        if (userManagementSection) {
            if (currentUser && currentUser.role === 'admin') {
                userManagementSection.classList.remove('hidden');
                if (typeof loadUsers === 'function') loadUsers();
            } else {
                userManagementSection.classList.add('hidden');
            }
        }
    }
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (sidebar && overlay) {
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        }
    }
}

function toggleFilters() {
    const select = document.getElementById('category-filter');
    if (select) {
        select.classList.toggle('hidden');
        select.classList.toggle('block');
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = { success: 'bg-emerald-500', error: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-brand-600' };
    const icons = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };

    toast.className = `${colors[type]} text-white px-6 py-3 rounded-xl shadow-lg transform translate-y-10 opacity-0 transition-all duration-300 pointer-events-auto min-w-[300px] flex items-center gap-3`;
    toast.innerHTML = `<i class="fas fa-${icons[type]}"></i><span class="font-medium">${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function syncWooCommerce() {
    const btn = document.getElementById('sync-woo-btn');
    const icon = btn.querySelector('i');

    if (btn) btn.disabled = true;
    if (icon) {
        icon.classList.remove('fa-wordpress');
        icon.classList.add('fa-spinner', 'fa-spin');
    }

    try {
        showToast('Refreshing live store data...', 'info');
        const result = await api.post('/woocommerce/sync');
        showToast('Live store data updated', 'success');
        await loadInitialData();
    } catch (error) {
        showToast(error.message || 'WooCommerce Sync Failed', 'error');
    } finally {
        if (btn) btn.disabled = false;
        if (icon) {
            icon.classList.remove('fa-spinner', 'fa-spin');
            icon.classList.add('fa-wordpress');
        }
    }
}

// Auto-Logout on Inactivity (5 minutes)
let inactivityTimer;
const INACTIVITY_TIME_LIMIT = 5 * 60 * 1000; // 5 minutes

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    // Only track inactivity if the user is actually logged in
    if (typeof authToken !== 'undefined' && authToken) {
        inactivityTimer = setTimeout(() => {
            if (typeof showToast === 'function') {
                showToast('Logged out due to inactivity', 'warning');
            }
            if (typeof logout === 'function') {
                logout();
            }
        }, INACTIVITY_TIME_LIMIT);
    }
}

// Reset timer on any user activity
['mousemove', 'mousedown', 'keypress', 'touchmove', 'scroll', 'click'].forEach(evt =>
    document.addEventListener(evt, resetInactivityTimer, { passive: true, capture: true })
);

window.onload = () => {
    init();
    resetInactivityTimer();
};
