// Dashboard Functions

function updateStatsDisplay(stats) {
    const elTotal = document.getElementById('stat-total');
    if (elTotal) elTotal.textContent = stats.total;
    const elLow = document.getElementById('stat-low');
    if (elLow) elLow.textContent = stats.lowStock;
    const elOut = document.getElementById('stat-out');
    if (elOut) elOut.textContent = stats.outOfStock;
    const elValue = document.getElementById('stat-value');
    if (elValue) elValue.textContent = '₹' + stats.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

async function updateStats() {
    try {
        const stats = await api.get('/dashboard/stats');
        updateStatsDisplay(stats);
    } catch (error) {
        console.error('Failed to update stats');
    }
}
// Expose global functions
window.updateStatsDisplay = updateStatsDisplay;
window.updateStats = updateStats;
