// Activity Log Functions
export function initActivityPage() {
    const container = document.getElementById('section-activity');
    if (!container) return;
    container.innerHTML = `
        <div class="bg-white border-b border-slate-200 px-6 py-4">
            <h2 class="text-xl font-bold text-slate-800">Activity Log</h2>
            <p class="text-sm text-slate-500">Recent stock changes and updates</p>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
            <div id="activity-list" class="space-y-3">
                <!-- Activity items injected here -->
            </div>
        </div>
    `;
}


function renderActivity(logs) {
    const container = document.getElementById('activity-list');
    if (!container) return;

    if (!logs || logs.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-500 py-8">No recent activity</p>';
        return;
    }

    container.innerHTML = logs.map(log => {
        const icons = {
            sale: { icon: 'shopping-cart', color: 'text-blue-600', bg: 'bg-blue-50' },
            restock: { icon: 'truck', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            adjustment: { icon: 'sliders-h', color: 'text-amber-600', bg: 'bg-amber-50' },
            return: { icon: 'undo', color: 'text-purple-600', bg: 'bg-purple-50' }
        };
        const style = icons[log.type] || icons.adjustment;
        const time = new Date(log.timestamp).toLocaleTimeString();

        return `
            <div class="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                <div class="w-12 h-12 ${style.bg} rounded-xl flex items-center justify-center ${style.color}">
                    <i class="fas fa-${style.icon} text-lg"></i>
                </div>
                <div class="flex-1">
                    <p class="font-medium text-slate-800">${log.productId?.name || 'Unknown Product'}</p>
                    <p class="text-sm text-slate-500">${log.type.toUpperCase()}: ${log.quantity > 0 ? '+' : ''}${log.quantity} units • ${log.reason}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-medium text-slate-800">${log.newStock} in stock</p>
                    <p class="text-xs text-slate-400">${time}</p>
                </div>
            </div>
        `;
    }).join('');
}

async function loadActivity() {
    try {
        const logs = await api.get('/stock-logs?limit=20');
        renderActivity(logs);
    } catch (error) {
        if (typeof showToast === 'function') showToast('Failed to load activity', 'error');
    }
}

// Expose global functions
window.renderActivity = renderActivity;
window.loadActivity = loadActivity;
