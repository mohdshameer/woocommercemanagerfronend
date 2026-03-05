// Products Display
function renderProducts() {
    const container = document.getElementById('products-container');
    if (!container) return;

    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    const categorySelect = document.getElementById('category-filter');
    const category = categorySelect ? categorySelect.value : '';

    let filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm) || p.sku.toLowerCase().includes(searchTerm);
        const matchesCategory = !category || p.category === category;
        return matchesSearch && matchesCategory;
    });

    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.classList.toggle('hidden', filtered.length > 0);

    const navCount = document.getElementById('nav-count');
    if (navCount) navCount.textContent = products.length;

    container.innerHTML = filtered.map(product => {
        const stockBadge = getStockBadge(product);
        const image = product.images[0] || 'https://via.placeholder.com/400';

        if (currentView === 'grid') {
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
                            <span class="text-lg font-bold text-slate-900">$${product.price.toFixed(2)}</span>
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
                        <p class="text-xl font-bold text-slate-900">$${product.price.toFixed(2)}</p>
                        <p class="text-sm ${getStockTextColor(product)} font-medium mt-1">${product.stock} units</p>
                    </div>
                    <button class="p-3 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-brand-600">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            `;
        }
    }).join('');
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
    currentView = view;
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
    renderProducts();
}

// Product Management (Modals, Logic)
function openEditModal(id) {
    currentProduct = products.find(p => p._id === id);
    if (!currentProduct) return;

    tempImages = [...(currentProduct.images || [])];
    tempAttributes = [...(currentProduct.attributes || [])];

    document.getElementById('modal-title').innerText = 'Edit Product';
    document.getElementById('modal-subtitle').innerText = `SKU: ${currentProduct.sku}`;
    document.getElementById('edit-name').value = currentProduct.name;
    document.getElementById('edit-sku').value = currentProduct.sku;
    document.getElementById('edit-price').value = currentProduct.price;
    document.getElementById('edit-category').value = currentProduct.category || '';
    document.getElementById('edit-stock').value = currentProduct.stock;
    document.getElementById('edit-threshold').value = currentProduct.threshold;
    document.getElementById('edit-description').value = currentProduct.description || '';
    document.getElementById('edit-manage-stock').checked = currentProduct.manageStock !== false;

    const tagSelect = document.getElementById('edit-tags');
    if (tagSelect) {
        Array.from(tagSelect.options).forEach(opt => {
            opt.selected = (currentProduct.tags || []).includes(opt.value);
        });
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
    currentProduct = null;
    tempImages = [];
    tempAttributes = [];

    document.getElementById('modal-title').innerText = 'Add New Product';
    document.getElementById('modal-subtitle').innerText = 'Create a new product listing';
    document.getElementById('edit-name').value = '';
    document.getElementById('edit-sku').value = 'SKU-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    document.getElementById('edit-price').value = '';
    document.getElementById('edit-category').value = '';

    const tagSelect = document.getElementById('edit-tags');
    if (tagSelect) tagSelect.selectedIndex = -1;

    document.getElementById('edit-stock').value = '0';
    document.getElementById('edit-threshold').value = '10';
    document.getElementById('edit-description').value = '';
    document.getElementById('edit-manage-stock').checked = true;

    const stockStatusObj = document.getElementById('status-instock');
    if (stockStatusObj) stockStatusObj.checked = true;

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
        if (currentSection === 'inventory' && typeof renderInventory === 'function') renderInventory();
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
            headers: { 'Authorization': `Bearer ${authToken}` },
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

    if (wooAttributes.length === 0) {
        container.innerHTML = tempAttributes.map((attr, idx) => `
            <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <input type="text" placeholder="Name (e.g. Color)" value="${attr.name}" 
                    onchange="updateAttribute(${idx}, 'name', this.value)"
                    class="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm">
                <input type="text" placeholder="Value (e.g. Red)" value="${attr.value}" 
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
        const chosenAttrObj = wooAttributes.find(wa => wa.name === attr.name);
        const currentValues = attr.value ? attr.value.split(',').map(s => s.trim()) : [];
        const optionsHtml = chosenAttrObj
            ? chosenAttrObj.options.map(opt => `<option value="${opt}" ${currentValues.includes(opt) ? 'selected' : ''}>${opt}</option>`).join('')
            : '<option value="">Select Option</option>';

        return `
            <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <select onchange="updateAttributeName(${idx}, this.value)"
                    class="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm cursor-pointer">
                    <option value="">Select Attribute</option>
                    ${wooAttributes.map(wa => `<option value="${wa.name}" ${attr.name === wa.name ? 'selected' : ''}>${wa.name}</option>`).join('')}
                </select>
                
                <select multiple onchange="updateMultiAttribute(${idx}, this)" ${!chosenAttrObj ? 'disabled' : ''}
                    class="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm cursor-pointer ${!chosenAttrObj ? 'bg-slate-100 opacity-50' : ''}" style="height: 60px;">
                    ${optionsHtml}
                </select>
                <button onclick="removeAttribute(${idx})" class="p-2 text-slate-400 hover:text-red-500">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
    }).join('');
}

function updateAttributeName(idx, newName) { tempAttributes[idx].name = newName; tempAttributes[idx].value = ''; renderAttributes(); }
function addAttributeField() { tempAttributes.push({ name: '', value: '' }); renderAttributes(); }
function updateAttribute(idx, field, value) { tempAttributes[idx][field] = value; }
function updateMultiAttribute(idx, selectObj) { const selectedOptions = Array.from(selectObj.selectedOptions).map(opt => opt.value); tempAttributes[idx].value = selectedOptions.join(', '); }
function removeAttribute(idx) { tempAttributes.splice(idx, 1); renderAttributes(); }

// Save/Delete Products
async function saveProduct() {
    const tagSelect = document.getElementById('edit-tags');
    const selectedTags = tagSelect ? Array.from(tagSelect.selectedOptions).map(opt => opt.value) : [];

    const data = {
        name: document.getElementById('edit-name').value,
        sku: document.getElementById('edit-sku').value,
        price: parseFloat(document.getElementById('edit-price').value) || 0,
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
    }
}

async function deleteProduct() {
    if (!currentProduct) return;
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        await api.delete(`/products/${currentProduct._id}`);
        closeModal();
        if (typeof showToast === 'function') showToast('Product deleted', 'success');
    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
    }
}
