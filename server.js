// server.js - Main entry point
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
require('dotenv').config();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const WooCommerce = new WooCommerceRestApi({
    url: process.env.WOOCOMMERCE_URL || 'https://www.sheshoponline.in',
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
    version: 'wc/v3',
    queryStringAuth: true // Force Basic Authentication as query string true and using under HTTPS
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/woocommerce-manager', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Schemas
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, default: 'admin' },
    createdAt: { type: Date, default: Date.now }
});

const attributeSchema = new mongoose.Schema({
    name: String,
    value: String
});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    description: String,
    price: { type: Number, required: true, default: 0 },
    stock: { type: Number, default: 0 },
    threshold: { type: Number, default: 10 },
    status: { type: String, enum: ['instock', 'outofstock', 'onbackorder'], default: 'instock' },
    manageStock: { type: Boolean, default: true },
    category: { type: String, default: 'Uncategorized' },
    images: [String],
    attributes: [attributeSchema],
    salesCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
});

const stockLogSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    type: { type: String, enum: ['sale', 'restock', 'adjustment', 'return'] },
    quantity: Number,
    previousStock: Number,
    newStock: Number,
    reason: String,
    timestamp: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);
const Product = mongoose.model('Product', productSchema);
const StockLog = mongoose.model('StockLog', stockLogSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Initialize default admin
async function initializeAdmin() {
    const adminExists = await Admin.findOne({ username: 'admin' });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await Admin.create({
            username: 'admin',
            password: hashedPassword,
            email: 'admin@store.com',
            role: 'admin'
        });
        console.log('Default admin created: admin / admin123');
    }
}

// Routes

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, admin.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: admin._id, username: admin.username, role: admin.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Image Upload Route
app.post('/api/upload', authenticateToken, upload.array('images', 5), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Return the full URLs to access the images
        const imageUrls = req.files.map(file => {
            return `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
        });

        res.json({ urls: imageUrls });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Product Routes
app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const { search, category, status, lowStock } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } }
            ];
        }

        if (category) query.category = category;
        if (status) query.status = status;
        if (lowStock === 'true') {
            query.$expr = { $lte: ['$stock', '$threshold'] };
            query.stock = { $gt: 0 };
        }

        const products = await Product.find(query).sort({ lastUpdated: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', authenticateToken, async (req, res) => {
    try {
        const productData = req.body;
        productData.lastUpdated = new Date();

        // Auto-set status based on stock
        if (productData.manageStock) {
            if (productData.stock === 0) productData.status = 'outofstock';
            else if (productData.stock <= productData.threshold) productData.status = 'instock';
        }

        // 1. Push to WooCommerce FIRST
        if (process.env.WOOCOMMERCE_CONSUMER_KEY) {
            const wooData = {
                name: productData.name,
                type: 'simple',
                regular_price: productData.price.toString(),
                description: productData.description || '',
                short_description: productData.description || '',
                sku: productData.sku,
                manage_stock: productData.manageStock,
                stock_quantity: productData.stock,
                stock_status: productData.status,
            };

            // Map attributes to WooCommerce format (Array of options)
            if (productData.attributes && productData.attributes.length > 0) {
                wooData.attributes = productData.attributes.map(attr => ({
                    name: attr.name,
                    options: attr.value ? attr.value.split(',').map(v => v.trim()) : [],
                    visible: true,
                    variation: false
                }));
            }

            // Assuming category is a string we matched from Woo, we'd ideally need the Category ID.
            // For now, WooCommerce will create it as uncategorized if we don't pass an exact ID array.

            // Send images to WooCommerce as base64 since it cannot reach localhost
            if (productData.images && productData.images.length > 0) {
                wooData.images = productData.images.map(imgUrl => {
                    if (imgUrl.includes('/uploads/')) {
                        // Extract filename and read from disk
                        const filename = imgUrl.split('/').pop();
                        const filepath = path.join(uploadDir, filename);
                        if (fs.existsSync(filepath)) {
                            const ext = path.extname(filename).substring(1);
                            const base64Str = fs.readFileSync(filepath, { encoding: 'base64' });
                            // Must be data URI format for WooCommerce
                            return { src: imgUrl, name: filename, alt: productData.name };
                        }
                    }
                    return { src: imgUrl };
                });
            }

            // Important: WooCommerce accepts images as just src URLs for public sites, but since we are localhost
            // we have a problem. The standard REST API *does not* support raw base64 uploads without a specific plugin.
            // If the URL is localhost, WooCommerce will simply fail to download it.
            // A temporary workaround is to remove localhost images from the woo sync logic and just warn the user.
            if (wooData.images) {
                const hasLocalhost = wooData.images.some(i => i.src.includes('localhost') || i.src.includes('127.0.0.1'));
                if (hasLocalhost) {
                    console.log("Cannot send localhost image URLs to live WooCommerce. Skipping images for live sync.");
                    delete wooData.images;
                }
            }

            const wooResponse = await WooCommerce.post("products", wooData);

            // Save the WooCommerce ID to our local database so we can update it later
            productData.sku = wooResponse.data.sku || productData.sku; // WooCommerce might have modified it
        }

        // 2. Save to local MongoDB
        const product = new Product(productData);
        await product.save();

        // Log stock if initial stock > 0
        if (product.stock > 0) {
            await StockLog.create({
                productId: product._id,
                type: 'restock',
                quantity: product.stock,
                previousStock: 0,
                newStock: product.stock,
                reason: 'Initial stock'
            });
        }

        io.emit('product:created', product);
        res.status(201).json(product);
    } catch (error) {
        console.error("Error creating product:", error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.message || error.message });
    }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const productData = req.body;
        const oldProduct = await Product.findById(req.params.id);

        if (!oldProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Check for stock changes
        if (productData.stock !== undefined && productData.stock !== oldProduct.stock) {
            await StockLog.create({
                productId: oldProduct._id,
                type: 'adjustment',
                quantity: productData.stock - oldProduct.stock,
                previousStock: oldProduct.stock,
                newStock: productData.stock,
                reason: 'Manual adjustment'
            });
        }

        // Auto-update status
        if (productData.manageStock !== false) {
            if (productData.stock === 0) productData.status = 'outofstock';
            else if (productData.stock > 0) productData.status = 'instock';
        }

        productData.lastUpdated = new Date();

        // 1. Push changes to WooCommerce
        if (process.env.WOOCOMMERCE_CONSUMER_KEY && oldProduct.sku) {
            try {
                // Determine if we are updating by SKU or if we need to fetch the ID
                const wooProducts = await WooCommerce.get("products", { sku: oldProduct.sku });
                if (wooProducts.data && wooProducts.data.length > 0) {
                    const wooId = wooProducts.data[0].id;

                    const wooData = {
                        name: productData.name,
                        regular_price: productData.price ? productData.price.toString() : undefined,
                        description: productData.description || '',
                        short_description: productData.description || '',
                        manage_stock: productData.manageStock,
                        stock_quantity: productData.stock,
                        stock_status: productData.status,
                    };

                    if (productData.attributes && productData.attributes.length > 0) {
                        wooData.attributes = productData.attributes.map(attr => ({
                            name: attr.name,
                            options: attr.value ? attr.value.split(',').map(v => v.trim()) : [],
                            visible: true,
                            variation: false
                        }));
                    }

                    // Update WooCommerce
                    await WooCommerce.put(`products/${wooId}`, wooData);
                }
            } catch (wooError) {
                console.error("WooCommerce PUT sync error:", wooError.response?.data || wooError.message);
                // Do not throw here, proceed to local update even if WooCommerce failed (e.g., offline)
            }
        }

        // 2. Save to local MongoDB
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            productData,
            { new: true }
        );

        io.emit('product:updated', product);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        io.emit('product:deleted', { id: req.params.id });
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stock Management Routes
app.post('/api/products/:id/stock/adjust', authenticateToken, async (req, res) => {
    try {
        const { quantity, reason, type } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const previousStock = product.stock;
        const newStock = Math.max(0, previousStock + quantity);

        product.stock = newStock;

        // Update status
        if (newStock === 0) product.status = 'outofstock';
        else if (newStock <= product.threshold) product.status = 'instock';
        else product.status = 'instock';

        product.lastUpdated = new Date();
        await product.save();

        await StockLog.create({
            productId: product._id,
            type: type || 'adjustment',
            quantity,
            previousStock,
            newStock,
            reason: reason || 'Manual adjustment'
        });

        io.emit('stock:updated', {
            productId: product._id,
            previousStock,
            newStock,
            product
        });

        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk Operations
app.post('/api/products/bulk/update', authenticateToken, async (req, res) => {
    try {
        const { ids, updates } = req.body;
        const result = await Product.updateMany(
            { _id: { $in: ids } },
            { $set: { ...updates, lastUpdated: new Date() } }
        );

        io.emit('products:bulk-updated', { ids, updates });
        res.json({ modified: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stock Logs
app.get('/api/stock-logs', authenticateToken, async (req, res) => {
    try {
        const { productId, limit = 50 } = req.query;
        let query = {};
        if (productId) query.productId = productId;

        const logs = await StockLog.find(query)
            .populate('productId', 'name sku')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dashboard Stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const total = await Product.countDocuments();
        const lowStock = await Product.countDocuments({
            $expr: { $lte: ['$stock', '$threshold'] },
            stock: { $gt: 0 }
        });
        const outOfStock = await Product.countDocuments({ stock: 0 });
        const totalValue = await Product.aggregate([
            { $match: { status: { $ne: 'outofstock' } } },
            { $group: { _id: null, total: { $sum: { $multiply: ['$price', '$stock'] } } } }
        ]);

        // Recent activity
        const recentLogs = await StockLog.find()
            .populate('productId', 'name sku images')
            .sort({ timestamp: -1 })
            .limit(5);

        res.json({
            total,
            lowStock,
            outOfStock,
            totalValue: totalValue[0]?.total || 0,
            recentActivity: recentLogs
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Categories - Fetch directly from WooCommerce
app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        if (process.env.WOOCOMMERCE_CONSUMER_KEY) {
            // Fetch live categories from WooCommerce
            const response = await WooCommerce.get("products/categories", { per_page: 100 });
            res.json(response.data);
        } else {
            // Fallback to local distinct categories
            const categories = await Product.distinct('category');
            // Format to match Woo response style for frontend compatibility
            res.json(categories.map(c => ({ id: c, name: c })));
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tags - Fetch directly from WooCommerce
app.get('/api/tags', authenticateToken, async (req, res) => {
    try {
        if (process.env.WOOCOMMERCE_CONSUMER_KEY) {
            const response = await WooCommerce.get("products/tags", { per_page: 100 });
            res.json(response.data);
        } else {
            res.json([]); // Fallback empty
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Attributes - Fetch directly from WooCommerce
app.get('/api/attributes', authenticateToken, async (req, res) => {
    try {
        if (!process.env.WOOCOMMERCE_CONSUMER_KEY) return res.json([]);

        // 1. Get all attribute groups (e.g., "Color", "Size")
        const attrResp = await WooCommerce.get("products/attributes");
        const attributes = attrResp.data;

        // 2. Fetch terms for each attribute to get the dropdown options
        const fullAttributes = await Promise.all(attributes.map(async (attr) => {
            const termsResp = await WooCommerce.get(`products/attributes/${attr.id}/terms`);
            return {
                id: attr.id,
                name: attr.name,
                options: termsResp.data.map(term => term.name)
            };
        }));

        res.json(fullAttributes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// WebSocket Connection Handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join', (room) => {
        socket.join(room);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Simulate live sales (for demo purposes)
function simulateLiveSales() {
    setInterval(async () => {
        try {
            const products = await Product.find({ status: 'instock', stock: { $gt: 0 } });
            if (products.length === 0) return;

            const randomProduct = products[Math.floor(Math.random() * products.length)];
            const saleQty = Math.floor(Math.random() * 3) + 1;

            if (randomProduct.stock >= saleQty) {
                const previousStock = randomProduct.stock;
                randomProduct.stock -= saleQty;
                randomProduct.salesCount += saleQty;

                if (randomProduct.stock === 0) {
                    randomProduct.status = 'outofstock';
                } else if (randomProduct.stock <= randomProduct.threshold) {
                    // Still instock but low
                }

                randomProduct.lastUpdated = new Date();
                await randomProduct.save();

                await StockLog.create({
                    productId: randomProduct._id,
                    type: 'sale',
                    quantity: -saleQty,
                    previousStock,
                    newStock: randomProduct.stock,
                    reason: 'Customer purchase'
                });

                io.emit('stock:live-update', {
                    productId: randomProduct._id,
                    product: randomProduct,
                    change: -saleQty,
                    timestamp: new Date()
                });

                console.log(`Live sale: ${randomProduct.name} (-${saleQty})`);
            }
        } catch (error) {
            console.error('Simulation error:', error);
        }
    }, 8000); // Every 8 seconds
}

// Sync with WooCommerce Route
app.post('/api/woocommerce/sync', authenticateToken, async (req, res) => {
    try {
        if (!process.env.WOOCOMMERCE_CONSUMER_KEY || !process.env.WOOCOMMERCE_CONSUMER_SECRET) {
            return res.status(400).json({ error: 'WooCommerce API keys are missing in .env' });
        }

        // Fetch products from WooCommerce
        const response = await WooCommerce.get("products", { per_page: 50 });
        const wooProducts = response.data;

        let syncedCount = 0;

        for (const woo of wooProducts) {
            const productData = {
                name: woo.name,
                sku: woo.sku || `WOO-${woo.id}`,
                description: woo.short_description || woo.description,
                price: parseFloat(woo.price) || 0,
                stock: woo.stock_quantity || 0,
                status: woo.stock_status,
                manageStock: woo.manage_stock,
                category: woo.categories.length > 0 ? woo.categories[0].name : 'Uncategorized',
                images: woo.images.map(img => img.src),
                attributes: woo.attributes.map(attr => ({ name: attr.name, value: attr.options.join(', ') })),
                lastUpdated: new Date()
            };

            // Update or Create the product in local MongoDB
            const existingProduct = await Product.findOne({ sku: productData.sku });

            if (existingProduct) {
                await Product.updateOne({ _id: existingProduct._id }, { $set: productData });
            } else {
                await Product.create(productData);
            }
            syncedCount++;
        }

        io.emit('woocommerce:sync-complete', { syncedCount });
        res.json({ message: `Successfully synced ${syncedCount} products from WooCommerce.`, syncedCount });
    } catch (error) {
        console.error("WooCommerce Sync Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.message || error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeAdmin();
    simulateLiveSales();
});