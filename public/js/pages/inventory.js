// Inventory Management Functions
let currentInventoryPage = 1;
const inventoryPerPage = 20;

function changeInventoryPage(page) {
    currentInventoryPage = page;
    renderInventory();
}

function renderInventory() {
    const container = document.getElementById('inventory-list');
    if (!container) return;

    const sorted = [...products].sort((a, b) => a.stock - b.stock);

    const totalPages = Math.ceil(sorted.length / inventoryPerPage);
    if (currentInventoryPage > totalPages) currentInventoryPage = totalPages || 1;

    const startIndex = (currentInventoryPage - 1) * inventoryPerPage;
    const paginatedInventory = sorted.slice(startIndex, startIndex + inventoryPerPage);

    container.innerHTML = paginatedInventory.map(product => {
        const percent = Math.min((product.stock / (product.threshold * 2)) * 100, 100);
        const color = product.stock === 0 ? 'bg-red-500' : product.stock <= product.threshold ? 'bg-amber-500' : 'bg-emerald-500';

        return `
            <div class="bg-white rounded-xl border border-slate-200 p-4">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-3">
                        <img src="${product.images[0] || 'https://via.placeholder.com/400'}" class="w-12 h-12 rounded-lg object-cover">
                        <div>
                            <h4 class="font-bold text-slate-800">${product.name}</h4>
                            <p class="text-xs text-slate-500">${product.sku}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="quickAdjustStock('${product._id}', -1)" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
                            <i class="fas fa-minus text-xs"></i>
                        </button>
                        <span class="w-16 text-center font-bold text-slate-800">${product.stock}</span>
                        <button onclick="quickAdjustStock('${product._id}', 1)" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
                            <i class="fas fa-plus text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                    <div class="${color} h-2 rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                </div>
                <div class="flex justify-between mt-2 text-xs text-slate-500">
                    <span>Threshold: ${product.threshold}</span>
                    <span>${product.status}</span>
                </div>
            </div>
        `;
    }).join('');

    // Pagination HTML
    const paginationContainer = document.getElementById('inventory-pagination');
    if (paginationContainer) {
        if (totalPages > 1) {
            paginationContainer.innerHTML = `
                <div class="flex items-center justify-between mt-6 px-2">
                    <span class="text-sm text-slate-500">Showing ${startIndex + 1} to ${Math.min(startIndex + inventoryPerPage, sorted.length)} of ${sorted.length} entries</span>
                    <div class="flex items-center gap-2">
                        <button onclick="changeInventoryPage(${currentInventoryPage - 1})" ${currentInventoryPage === 1 ? 'disabled' : ''} 
                            class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium ${currentInventoryPage === 1 ? 'text-slate-400 bg-slate-50 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50 bg-white transition-colors'}">
                            Previous
                        </button>
                        <span class="text-sm font-medium text-slate-700 mx-2">Page ${currentInventoryPage} of ${totalPages}</span>
                        <button onclick="changeInventoryPage(${currentInventoryPage + 1})" ${currentInventoryPage === totalPages ? 'disabled' : ''} 
                            class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium ${currentInventoryPage === totalPages ? 'text-slate-400 bg-slate-50 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50 bg-white transition-colors'}">
                            Next
                        </button>
                    </div>
                </div>
            `;
        } else {
            paginationContainer.innerHTML = '';
        }
    }
}
