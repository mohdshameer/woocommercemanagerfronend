// Products Page HTML and Initialization
let currentProduct = null;
let tempImages = [];
let tempAttributes = [];

export function initProductsPage() {
    const container = document.getElementById('section-products');
    if (!container) return;
    container.innerHTML = `
        <!-- Top Bar -->
        <div class="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-30">
            <div class="flex items-center gap-4 flex-1 max-w-2xl">
                <div class="relative flex-1">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input type="text" id="searchInput" placeholder="Search products, SKUs..."
                        class="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-0 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-sm"
                        oninput="filterProducts()">
                </div>
                <select id="category-filter" onchange="filterProducts()"
                    class="hidden md:block px-4 py-2.5 bg-slate-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-brand-500">
                    <option value="">All Categories</option>
                </select>
                <button onclick="toggleFilters()"
                    class="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors relative md:hidden">
                    <i class="fas fa-filter"></i>
                </button>
            </div>

            <div class="flex items-center gap-3">
                <button onclick="openAddProductModal()"
                    class="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-slate-900 rounded-xl font-medium transition-all shadow-lg shadow-brand-500/30 active:scale-95">
                    <i class="fas fa-plus"></i>
                    <span class="hidden sm:inline">Add Product</span>
                </button>
                <button onclick="syncWooCommerce()" id="sync-woo-btn"
                    class="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-slate-900 rounded-xl font-medium transition-all shadow-lg shadow-purple-500/30 active:scale-95">
                    <i class="fab fa-wordpress"></i>
                    <span class="hidden sm:inline">Sync WooCommerce</span>
                </button>
                <div class="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>
                <button onclick="refreshData()"
                    class="p-2.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                    title="Refresh">
                    <i class="fas fa-sync-alt" id="refresh-icon"></i>
                </button>
            </div>
        </div>

        <!-- Stats Bar -->
        <div class="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50">
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-slate-500 text-sm font-medium">Total Products</span>
                    <div class="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                        <i class="fas fa-cubes text-sm"></i>
                    </div>
                </div>
                <p class="text-2xl font-bold text-slate-800" id="stat-total">0</p>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-slate-500 text-sm font-medium">Low Stock</span>
                    <div class="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                        <i class="fas fa-exclamation-triangle text-sm"></i>
                    </div>
                </div>
                <p class="text-2xl font-bold text-slate-800" id="stat-low">0</p>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-slate-500 text-sm font-medium">Out of Stock</span>
                    <div class="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
                        <i class="fas fa-times-circle text-sm"></i>
                    </div>
                </div>
                <p class="text-2xl font-bold text-slate-800" id="stat-out">0</p>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-slate-500 text-sm font-medium">Inventory Value</span>
                    <div
                        class="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                        <i class="fas fa-rupee-sign text-sm"></i>
                    </div>
                </div>
                <p class="text-2xl font-bold text-slate-800" id="stat-value">₹0</p>
            </div>
        </div>

        <!-- Products Grid -->
        <div class="flex-1 overflow-y-auto px-6 pb-6">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-bold text-slate-800">Products</h2>
                <div class="flex items-center gap-2">
                    <button onclick="setView('grid')" id="btn-grid"
                        class="p-2 rounded-lg bg-white border border-slate-200 text-brand-600 shadow-sm">
                        <i class="fas fa-th-large"></i>
                    </button>
                    <button onclick="setView('list')" id="btn-list"
                        class="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-white hover:shadow-sm transition-all">
                        <i class="fas fa-list"></i>
                    </button>
                </div>
            </div>

            <div id="products-container"
                class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                <!-- Products injected here -->
            </div>

            <div id="products-pagination"></div>

            <div id="empty-state" class="hidden flex flex-col items-center justify-center py-20 text-center">
                <div class="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fas fa-search text-3xl text-slate-400"></i>
                </div>
                <h3 class="text-lg font-semibold text-slate-700 mb-2">No products found</h3>
                <p class="text-slate-500 max-w-sm">Try adjusting your search or add new products.</p>
            </div>
        </div>
    `;
}

let currentProductPage = 1;
const productsPerPage = 10;
let tagsSelectInstance = null;
let attributeSelectInstances = [];

function initTagsSelect() {
    if (tagsSelectInstance) {
        tagsSelectInstance.destroy();
        tagsSelectInstance = null;
    }
    const el = document.getElementById('edit-tags');
    if (el) {
        tagsSelectInstance = new TomSelect(el, {
            plugins: ['remove_button'],
            create: true,
            persist: false,
            placeholder: 'Select or type tags...'
        });
    }
}

function changeProductPage(page) {
    currentProductPage = page;
    renderProducts();
}

// Products Display
function renderProducts() {
    const container = document.getElementById('products-container');
    if (!container) return;

    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    const categorySelect = document.getElementById('category-filter');
    const category = categorySelect ? categorySelect.value : '';

    let filtered = window.products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm) || p.sku.toLowerCase().includes(searchTerm);
        const matchesCategory = !category || p.category === category;
        return matchesSearch && matchesCategory;
    });

    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.classList.toggle('hidden', filtered.length > 0);

    const navCount = document.getElementById('nav-count');
    if (navCount) navCount.textContent = window.products.length;

    const totalPages = Math.ceil(filtered.length / productsPerPage);
    if (currentProductPage > totalPages) currentProductPage = totalPages || 1;

    const startIndex = (currentProductPage - 1) * productsPerPage;
    const paginatedProducts = filtered.slice(startIndex, startIndex + productsPerPage);

    container.innerHTML = paginatedProducts.map(product => {
        const stockBadge = getStockBadge(product);
        const image = product.images[0] || 'https://via.placeholder.com/400';

        // Fallback to product.price for variable products where regular_price is empty
        const regularPrice = product.regular_price !== '' && product.regular_price != null
            ? parseFloat(product.regular_price)
            : (product.price !== '' && product.price != null ? parseFloat(product.price) : null);
        const salePrice = product.sale_price !== '' && product.sale_price != null ? parseFloat(product.sale_price) : null;

        let priceHtml = '';
        if (regularPrice !== null) {
            if (salePrice !== null && salePrice < regularPrice) {
                priceHtml = `<div class="flex flex-col">
                    <span class="text-lg font-bold text-brand-600">₹${salePrice.toFixed(2)}</span>
                    <span class="text-xs text-slate-400 line-through">₹${regularPrice.toFixed(2)}</span>
                   </div>`;
            } else {
                priceHtml = `<span class="text-lg font-bold text-slate-900">₹${regularPrice.toFixed(2)}</span>`;
            }
        } else {
            priceHtml = `<span class="text-sm font-medium text-slate-400">No price</span>`;
        }

        if (window.currentView === 'grid') {
            return `
                <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-brand-200 transition-all duration-300 group cursor-pointer" onclick="openEditModal('${product._id}')">
                    <div class="aspect-square overflow-hidden bg-slate-100 relative">
                        <img src="${image}" class="w-full h-full object-cover" alt="${product.name}">
                        <div class="absolute top-3 right-3">${stockBadge}</div>
                        <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <button class="w-full py-2 bg-white/90 backdrop-blur-sm rounded-lg text-sm font-medium text-slate-800">Quick Edit</button>
                        </div>
                    </div>
                    <div class="p-4">
                        <p class="text-xs text-slate-500 mb-1 font-mono">${product.sku}</p>
                        <h3 class="font-bold text-slate-800 line-clamp-1 group-hover:text-brand-600 transition-colors">${product.name}</h3>
                        <div class="flex items-center justify-between mt-3">
                            ${priceHtml}
                            <div class="flex items-center gap-2 text-sm">
                                <span class="w-2 h-2 rounded-full ${getStockColor(product)}"></span>
                                <span class="text-slate-600 font-medium">${product.stock} in stock</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-md hover:border-brand-200 transition-all cursor-pointer" onclick="openEditModal('${product._id}')">
                    <div class="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                        <img src="${image}" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">${product.sku}</span>
                            ${stockBadge}
                        </div>
                        <h3 class="font-bold text-slate-800 truncate mb-1">${product.name}</h3>
                        <p class="text-sm text-slate-500 truncate">${product.description || 'No description'}</p>
                    </div>
                    <div class="text-right flex-shrink-0">
                        ${priceHtml}
                        <p class="text-sm ${getStockTextColor(product)} font-medium mt-1">${product.stock} units</p>
                    </div>
                    <button class="p-3 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-brand-600">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            `;
        }
    }).join('');

    // Pagination HTML
    const paginationContainer = document.getElementById('products-pagination');
    if (paginationContainer) {
        if (totalPages > 1) {
            paginationContainer.innerHTML = `
                <div class="flex items-center justify-between mt-6 px-2">
                    <span class="text-sm text-slate-500">Showing ${startIndex + 1} to ${Math.min(startIndex + productsPerPage, filtered.length)} of ${filtered.length} entries</span>
                    <div class="flex items-center gap-2">
                        <button onclick="changeProductPage(${currentProductPage - 1})" ${currentProductPage === 1 ? 'disabled' : ''} 
                            class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium ${currentProductPage === 1 ? 'text-slate-400 bg-slate-50 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50 bg-white transition-colors'}">
                            Previous
                        </button>
                        <span class="text-sm font-medium text-slate-700 mx-2">Page ${currentProductPage} of ${totalPages}</span>
                        <button onclick="changeProductPage(${currentProductPage + 1})" ${currentProductPage === totalPages ? 'disabled' : ''} 
                            class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium ${currentProductPage === totalPages ? 'text-slate-400 bg-slate-50 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50 bg-white transition-colors'}">
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

function getStockBadge(product) {
    if (product.status === 'outofstock' || product.stock === 0) {
        return `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200">OUT OF STOCK</span>`;
    } else if (product.stock <= product.threshold) {
        return `<span class="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg border border-amber-200">LOW STOCK</span>`;
    } else {
        return `<span class="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">IN STOCK</span>`;
    }
}

function getStockColor(product) {
    if (product.stock === 0) return 'bg-red-500';
    if (product.stock <= product.threshold) return 'bg-amber-500';
    return 'bg-emerald-500';
}

function getStockTextColor(product) {
    if (product.stock === 0) return 'text-red-600';
    if (product.stock <= product.threshold) return 'text-amber-600';
    return 'text-emerald-600';
}

function setView(view) {
    window.currentView = view;
    const btnGrid = document.getElementById('btn-grid');
    if (btnGrid) {
        btnGrid.className = view === 'grid'
            ? 'p-2 rounded-lg bg-white border border-slate-200 text-brand-600 shadow-sm'
            : 'p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-white hover:shadow-sm transition-all';
    }
    const btnList = document.getElementById('btn-list');
    if (btnList) {
        btnList.className = view === 'list'
            ? 'p-2 rounded-lg bg-white border border-slate-200 text-brand-600 shadow-sm'
            : 'p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-white hover:shadow-sm transition-all';
    }

    const container = document.getElementById('products-container');
    if (container) {
        container.className = view === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4'
            : 'flex flex-col gap-3';
    }

    renderProducts();
}

function filterProducts() {
    currentProductPage = 1;
    renderProducts();
}

// Product Management (Modals, Logic)
function openEditModal(id) {
    currentProduct = window.products.find(p => p._id === id);
    if (!currentProduct) return;

    tempImages = [...(currentProduct.images || [])];
    tempAttributes = [...(currentProduct.attributes || [])];

    document.getElementById('modal-title').innerText = 'Edit Product';
    document.getElementById('modal-subtitle').innerText = `SKU: ${currentProduct.sku}`;
    document.getElementById('edit-name').value = currentProduct.name;
    document.getElementById('edit-type').value = currentProduct.type || 'simple';
    document.getElementById('edit-sku').value = currentProduct.sku;
    document.getElementById('edit-regular-price').value = (currentProduct.regular_price !== undefined && currentProduct.regular_price !== null && currentProduct.regular_price !== '')
        ? currentProduct.regular_price
        : (currentProduct.price !== undefined && currentProduct.price !== null && currentProduct.price !== '' ? currentProduct.price : '');

    document.getElementById('edit-sale-price').value = (currentProduct.sale_price !== undefined && currentProduct.sale_price !== null && currentProduct.sale_price !== '')
        ? currentProduct.sale_price : '';
    document.getElementById('edit-category').value = currentProduct.category || '';
    document.getElementById('edit-stock').value = currentProduct.stock;
    document.getElementById('edit-threshold').value = currentProduct.threshold;
    document.getElementById('edit-description').value = currentProduct.description || '';
    document.getElementById('edit-manage-stock').checked = currentProduct.manageStock !== false;

    toggleVariationsLayer();

    initTagsSelect();
    if (tagsSelectInstance && currentProduct.tags) {
        // Add any missing tags as options first
        currentProduct.tags.forEach(tag => {
            tagsSelectInstance.addOption({ value: tag, text: tag });
        });
        // Select all the product's tags
        tagsSelectInstance.setValue(currentProduct.tags);
    }

    const statusObj = document.getElementById(`status-${currentProduct.status}`);
    if (statusObj) statusObj.checked = true;

    toggleStockManagement();
    if (typeof renderImagePreviews === 'function') renderImagePreviews();
    if (typeof renderAttributes === 'function') renderAttributes();

    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    modal.classList.remove('hidden');
    setTimeout(() => content.classList.remove('translate-x-full'), 10);
}

function openAddProductModal() {
    console.log('openAddProductModal clicked!');
    currentProduct = null;
    tempImages = [];
    tempAttributes = [];

    document.getElementById('modal-title').innerText = 'Add New Product';
    document.getElementById('modal-subtitle').innerText = 'Create a new product listing';
    document.getElementById('edit-name').value = '';
    document.getElementById('edit-type').value = 'simple';
    document.getElementById('edit-sku').value = 'SKU-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    document.getElementById('edit-regular-price').value = '';
    document.getElementById('edit-sale-price').value = '';
    document.getElementById('edit-category').value = '';

    const tagSelect = document.getElementById('edit-tags');
    if (tagSelect) tagSelect.selectedIndex = -1;
    initTagsSelect();

    document.getElementById('edit-stock').value = '0';
    document.getElementById('edit-threshold').value = '10';
    document.getElementById('edit-description').value = '';
    document.getElementById('edit-manage-stock').checked = true;

    const stockStatusObj = document.getElementById('status-instock');
    if (stockStatusObj) stockStatusObj.checked = true;

    toggleVariationsLayer();

    toggleStockManagement();
    if (typeof renderImagePreviews === 'function') renderImagePreviews();
    if (typeof renderAttributes === 'function') renderAttributes();

    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    modal.classList.remove('hidden');
    setTimeout(() => content.classList.remove('translate-x-full'), 10);
}

function closeModal() {
    const content = document.getElementById('edit-modal-content');
    const modal = document.getElementById('edit-modal');
    if (content) content.classList.add('translate-x-full');
    if (modal) setTimeout(() => modal.classList.add('hidden'), 300);
}

function toggleStockManagement() {
    const editCheck = document.getElementById('edit-manage-stock');
    const enabled = editCheck ? editCheck.checked : false;
    const controls = document.getElementById('stock-controls');
    if (controls) {
        controls.style.opacity = enabled ? '1' : '0.5';
        controls.style.pointerEvents = enabled ? 'auto' : 'none';
    }
}

function adjustStock(delta) {
    const input = document.getElementById('edit-stock');
    if (input) input.value = parseInt(input.value || 0) + delta;
}

async function quickAdjustStock(id, delta) {
    try {
        await api.post(`/products/${id}/stock/adjust`, {
            quantity: delta,
            reason: 'Quick adjustment',
            type: delta > 0 ? 'restock' : 'sale'
        });
        if (typeof showToast === 'function') showToast(`Stock ${delta > 0 ? 'increased' : 'decreased'}`, 'success');
        if (typeof refreshData === 'function') await refreshData();
        if (window.currentSection === 'inventory' && typeof renderInventory === 'function') renderInventory();
    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
    }
}

// Image Handling
function renderImagePreviews() {
    const grid = document.getElementById('image-preview-grid');
    if (!grid) return;
    grid.innerHTML = tempImages.map((img, idx) => `
        <div class="aspect-square rounded-lg overflow-hidden relative group border border-slate-200">
            <img src="${img}" class="w-full h-full object-cover">
            <button onclick="removeImage(${idx})" class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fas fa-times text-xs"></i>
            </button>
        </div>
    `).join('');
}

function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function handleDrop(e) { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); const files = e.dataTransfer.files; handleFiles(files); }
function handleFileSelect(e) { handleFiles(e.target.files); }

async function handleFiles(files) {
    const formData = new FormData();
    let hasImages = false;

    if (currentProduct && currentProduct._id) {
        formData.append('productId', currentProduct._id);
    }

    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            formData.append('images', file);
            hasImages = true;
        }
    });

    if (!hasImages) return;

    try {
        if (typeof showToast === 'function') showToast('Uploading images...', 'info');

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.authToken}` },
            body: formData
        });

        if (!response.ok) throw new Error('Failed to upload images');
        const data = await response.json();

        if (data.urls && data.urls.length > 0) {
            tempImages = [...tempImages, ...data.urls];
            renderImagePreviews();
            if (typeof showToast === 'function') showToast('Images uploaded successfully', 'success');
        }
    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
    }
}

function removeImage(idx) {
    tempImages.splice(idx, 1);
    renderImagePreviews();
}

// Attributes Management
function renderAttributes() {
    const container = document.getElementById('attributes-container');
    if (!container) return;

    // Destroy existing instances
    attributeSelectInstances.forEach(instance => instance.destroy());
    attributeSelectInstances = [];

    if (window.wooAttributes.length === 0) {
        container.innerHTML = tempAttributes.map((attr, idx) => `
            <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <input type="text" placeholder="Name (e.g. Color)" value="${attr.name}" 
                    onchange="updateAttribute(${idx}, 'name', this.value)"
                    class="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm">
                <input type="text" placeholder="Value (e.g. Red, Blue)" value="${attr.value}" 
                    onchange="updateAttribute(${idx}, 'value', this.value)"
                    class="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm">
                <button onclick="removeAttribute(${idx})" class="p-2 text-slate-400 hover:text-red-500">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `).join('');
        return;
    }

    container.innerHTML = tempAttributes.map((attr, idx) => {
        const chosenAttrObj = window.wooAttributes.find(wa => wa.name === attr.name);
        const currentValues = attr.value ? attr.value.split(',').map(s => s.trim()) : [];
        const optionsHtml = chosenAttrObj
            ? chosenAttrObj.options.map(opt => `<option value="${opt}" ${currentValues.includes(opt) ? 'selected' : ''}>${opt}</option>`).join('')
            : '<option value="">Select Option</option>';

        return `
            <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <select onchange="updateAttributeName(${idx}, this.value)"
                    class="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm cursor-pointer">
                    <option value="">Select Attribute</option>
                    ${window.wooAttributes.map(wa => `<option value="${wa.name}" ${attr.name === wa.name ? 'selected' : ''}>${wa.name}</option>`).join('')}
                </select>
                
                <select multiple ${!chosenAttrObj ? 'disabled' : ''}
                    class="multi-attribute-select flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm cursor-pointer ${!chosenAttrObj ? 'bg-slate-100 opacity-50' : ''}">
                    ${optionsHtml}
                </select>
                <button onclick="removeAttribute(${idx})" class="p-2 text-slate-400 hover:text-red-500">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
    }).join('');

    // Initialize Tom Select for multi-attributes
    document.querySelectorAll('.multi-attribute-select').forEach((el, idx) => {
        if (!el.disabled) {
            const instance = new TomSelect(el, {
                plugins: ['remove_button'],
                create: true,
                persist: false,
                placeholder: 'Select items...',
                onChange: function (value) {
                    // TomSelect value is an array of strings for multiple selects
                    tempAttributes[idx].value = value.join(', ');
                }
            });
            attributeSelectInstances.push(instance);
        }
    });
}

function updateAttributeName(idx, newName) { tempAttributes[idx].name = newName; tempAttributes[idx].value = ''; renderAttributes(); }
function addAttributeField() { tempAttributes.push({ name: '', value: '' }); renderAttributes(); }
function updateAttribute(idx, field, value) { tempAttributes[idx][field] = value; }
function removeAttribute(idx) { tempAttributes.splice(idx, 1); renderAttributes(); }

// Variation Logic
function toggleVariationsLayer() {
    const typeSelect = document.getElementById('edit-type');
    const varSection = document.getElementById('variations-section');
    if (typeSelect && varSection) {
        if (typeSelect.value === 'variable') {
            varSection.classList.remove('hidden');
        } else {
            varSection.classList.add('hidden');
        }
    }
}

// Bind event listener to the dropdown
document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('edit-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', toggleVariationsLayer);
    }
});

function previewVariations() {
    const container = document.getElementById('variations-preview-container');
    if (!container) return;

    // Filter valid attributes
    const validAttrs = tempAttributes.filter(a => a.name.trim() !== '' && a.value.trim() !== '');
    if (validAttrs.length === 0) {
        container.innerHTML = '<p class="text-xs text-amber-500">Please add attributes and values first.</p>';
        return;
    }

    // Split comma-separated values into arrays
    const attrOptionsList = validAttrs.map(a => ({
        name: a.name,
        options: a.value.split(',').map(s => s.trim()).filter(s => s !== '')
    }));

    // Generate cartesian product
    const cartesian = (arrays) => arrays.reduce((acc, curr) =>
        acc.flatMap(c => curr.map(n => [...c, n])), [[]]
    );

    const permutations = cartesian(attrOptionsList.map(a => a.options));

    if (permutations.length === 0 || (permutations.length === 1 && permutations[0].length === 0)) {
        container.innerHTML = '<p class="text-xs text-amber-500">Not enough values to generate variations.</p>';
        return;
    }

    let html = `<div class="bg-white border text-sm text-slate-800 border-slate-200 rounded-lg max-h-48 overflow-y-auto">
        <table class="w-full text-left">
            <thead class="bg-slate-50 sticky top-0 border-b border-slate-200">
                <tr>
                    <th class="py-2 px-3 font-medium">Variation Combination</th>
                    <th class="py-2 px-3 font-medium text-right bg-slate-50">Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">`;

    permutations.forEach(combo => {
        const comboString = combo.map((val, idx) => `<span class="bg-brand-50 text-brand-700 px-2 rounded font-medium text-xs">${attrOptionsList[idx].name}: ${val}</span>`).join(' + ');
        html += `
            <tr class="hover:bg-slate-50/50">
                <td class="py-2 px-3 flex flex-wrap gap-1">${comboString}</td>
                <td class="py-2 px-3 text-right text-xs"><span class="text-emerald-500 font-semibold"><i class="fas fa-magic"></i> Ready</span></td>
            </tr>`;
    });

    html += `</tbody></table></div>
        <p class="text-xs text-slate-500 mt-2"><i class="fas fa-info-circle text-brand-500"></i> ${permutations.length} variations will be built natively on save.</p>`;

    container.innerHTML = html;
}

// Preloader Helpers
function showPreloader(text = 'Processing...') {
    const preloader = document.getElementById('global-preloader');
    const preloaderText = document.getElementById('preloader-text');
    if (preloader) {
        if (preloaderText) preloaderText.textContent = text;
        preloader.classList.remove('hidden');
        preloader.classList.add('flex');
    }
}

function hidePreloader() {
    const preloader = document.getElementById('global-preloader');
    if (preloader) {
        preloader.classList.add('hidden');
        preloader.classList.remove('flex');
    }
}

// Save/Delete Products
async function saveProduct() {
    let selectedTags = [];
    if (tagsSelectInstance) {
        selectedTags = tagsSelectInstance.items;
    } else {
        const tagSelect = document.getElementById('edit-tags');
        selectedTags = tagSelect ? Array.from(tagSelect.selectedOptions).map(opt => opt.value) : [];
    }

    const data = {
        name: document.getElementById('edit-name').value,
        type: document.getElementById('edit-type').value,
        sku: document.getElementById('edit-sku').value,
        regular_price: document.getElementById('edit-regular-price').value !== '' ? document.getElementById('edit-regular-price').value : '',
        sale_price: document.getElementById('edit-sale-price').value !== '' ? document.getElementById('edit-sale-price').value : '',
        category: document.getElementById('edit-category').value,
        tags: selectedTags,
        stock: parseInt(document.getElementById('edit-stock').value) || 0,
        threshold: parseInt(document.getElementById('edit-threshold').value) || 10,
        manageStock: document.getElementById('edit-manage-stock').checked,
        description: document.getElementById('edit-description').value,
        images: tempImages,
        attributes: tempAttributes.filter(a => a.name.trim() && a.value.trim())
    };

    if (document.getElementById('status-outofstock') && document.getElementById('status-outofstock').checked) data.status = 'outofstock';
    else if (document.getElementById('status-backorder') && document.getElementById('status-backorder').checked) data.status = 'onbackorder';
    else data.status = 'instock';

    try {
        showPreloader('Saving product...');
        if (currentProduct) {
            await api.put(`/products/${currentProduct._id}`, data);
            if (typeof showToast === 'function') showToast('Product updated successfully', 'success');
        } else {
            await api.post('/products', data);
            if (typeof showToast === 'function') showToast('Product created successfully', 'success');
        }
        closeModal();
        if (typeof refreshData === 'function') await refreshData();
    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
    } finally {
        hidePreloader();
    }
}

async function deleteProduct() {
    if (!currentProduct) return;
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        showPreloader('Deleting product...');
        await api.delete(`/products/${currentProduct._id}`);
        closeModal();
        if (typeof showToast === 'function') showToast('Product deleted', 'success');
    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
    } finally {
        hidePreloader();
    }
}

async function rewriteDescriptionWithAI() {
    const descInput = document.getElementById('edit-description');
    const description = descInput.value;
    const btn = document.getElementById('rewrite-ai-btn');
    const OriginalIcon = btn.innerHTML;

    if (!description || description.trim() === '') {
        if (typeof showToast === 'function') showToast('Please enter some description text first to rewrite.', 'warning');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i>Rewriting...';

        const response = await api.post('/ai/rephrase-description', { description });

        if (response && response.rephrased) {
            descInput.value = response.rephrased;
            if (typeof showToast === 'function') showToast('Description rewritten successfully!', 'success');
        }
    } catch (error) {
        console.error('AI Rewrite Error:', error);
        if (typeof showToast === 'function') showToast(error.message || 'Failed to rewrite description.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = OriginalIcon;
    }
}

// Expose global functions
window.filterProducts = filterProducts;
window.openAddProductModal = openAddProductModal;
window.setView = setView;
window.openEditModal = openEditModal;
window.changeProductPage = changeProductPage;
window.removeImage = removeImage;
window.updateAttributeName = updateAttributeName;
window.addAttributeField = addAttributeField;
window.updateAttribute = updateAttribute;
window.removeAttribute = removeAttribute;
window.toggleVariationsLayer = toggleVariationsLayer;
window.previewVariations = previewVariations;
window.closeModal = closeModal;
window.toggleStockManagement = toggleStockManagement;
window.adjustStock = adjustStock;
window.quickAdjustStock = quickAdjustStock;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.handleFileSelect = handleFileSelect;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.rewriteDescriptionWithAI = rewriteDescriptionWithAI;
window.renderProducts = renderProducts;
