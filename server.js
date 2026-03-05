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
const { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

// Configure Cloudflare R2 S3 Client
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

// Configure Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

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

// Product schema removed - fetching directly from WooCommerce now
const stockLogSchema = new mongoose.Schema({
    productId: String, // WooCommerce ID
    sku: String,
    name: String,
    type: { type: String, enum: ['sale', 'restock', 'adjustment', 'return'] },
    quantity: Number,
    previousStock: Number,
    newStock: Number,
    reason: String,
    timestamp: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);
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

// Helper to relocate newly uploaded temp images to product-structured subdirectories natively in R2
async function organizeR2Images(req, productData, productId) {
    if (!productData.images || productData.images.length === 0) return productData.images;

    let updatedImages = [];
    const publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

    for (let imgUrl of productData.images) {
        if (imgUrl.includes('/Products/temp/')) {
            const filename = imgUrl.split('/').pop();
            const sourceKey = `Products/temp/${filename}`;
            const targetKey = `Products/${productId}/${filename}`;

            try {
                // Copy the object to the product-specific folder
                await s3.send(new CopyObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME || 'sheshopbucket',
                    CopySource: `${process.env.R2_BUCKET_NAME || 'sheshopbucket'}/${sourceKey}`,
                    Key: targetKey,
                }));
                // Delete the temp object
                await s3.send(new DeleteObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME || 'sheshopbucket',
                    Key: sourceKey,
                }));

                updatedImages.push(`${publicUrl}/${targetKey}`);
            } catch (err) {
                console.error('Error organizing R2 image:', err.message);
                updatedImages.push(imgUrl);
            }
        } else {
            updatedImages.push(imgUrl);
        }
    }
    return updatedImages;
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

// User Management Routes
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        // Exclude passwords from the response
        const users = await Admin.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        const existingUser = await Admin.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await Admin.create({
            username,
            email,
            password: hashedPassword,
            role: role || 'user'
        });

        const userResponse = newUser.toObject();
        delete userResponse.password;

        res.status(201).json(userResponse);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/users/:id/password', authenticateToken, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.params.id;

        // Optional: Ensure non-superadmins can only change their own password, 
        // but for now, any authenticated user (or admin) can change passwords.
        // Or restrict to superadmin only? The prompt says "admin as super user... password can change". 
        // We will allow the frontend to restrict or let everyone change passwords if they have access to settings.

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await Admin.findByIdAndUpdate(userId, { password: hashedPassword });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;

        const targetUser = await Admin.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (targetUser.username === 'admin' || targetUser.role === 'admin') {
            // Hardcode safeguard
            return res.status(403).json({ error: 'Cannot delete the superadmin account' });
        }

        await Admin.findByIdAndDelete(userId);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Image Upload Route
app.post('/api/upload', authenticateToken, upload.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const prodId = req.body.productId || 'temp';
        const publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

        const imageUrls = [];

        for (const file of req.files) {
            const ext = path.extname(file.originalname);
            const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
            const key = `Products/${prodId}/${filename}`;

            await s3.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME || 'sheshopbucket',
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
            }));

            imageUrls.push(`${publicUrl}/${key}`);
        }

        res.json({ urls: imageUrls });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: error.message });
    }
});

const mapWooToLocal = (woo) => ({
    _id: woo.id.toString(), // Keep _id key for frontend compat
    id: woo.id,
    name: woo.name,
    sku: woo.sku,
    description: woo.short_description || woo.description,
    price: parseFloat(woo.price) || 0,
    regular_price: parseFloat(woo.regular_price) || 0,
    sale_price: parseFloat(woo.sale_price) || 0,
    stock: woo.stock_quantity || 0,
    threshold: woo.low_stock_amount || 10,
    status: woo.stock_status,
    manageStock: woo.manage_stock,
    category: woo.categories && woo.categories.length > 0 ? woo.categories[0].name : 'Uncategorized',
    images: woo.images.map(img => img.src),
    attributes: woo.attributes.map(attr => ({ name: attr.name, value: attr.options.join(', ') })),
    lastUpdated: woo.date_modified
});

// Product Routes
app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const { search, category, status } = req.query;
        let params = {
            per_page: 100,
            orderby: 'date',
            order: 'desc'
        };

        if (search) params.search = search;

        const response = await WooCommerce.get("products", params);
        let products = response.data.map(mapWooToLocal);

        // Filter by category and status locally if search was used (WC search is broad)
        if (category) {
            products = products.filter(p => p.category === category);
        }
        if (status) {
            products = products.filter(p => p.status === status);
        }

        res.json(products);
    } catch (error) {
        console.error("GET Products Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const response = await WooCommerce.get(`products/${req.params.id}`);
        res.json(mapWooToLocal(response.data));
    } catch (error) {
        res.status(404).json({ error: 'Product not found' });
    }
});

app.post('/api/products', authenticateToken, async (req, res) => {
    try {
        const productData = req.body;

        // 1. Map to WooCommerce Data
        const wooData = {
            name: productData.name,
            type: 'simple',
            regular_price: productData.regular_price ? productData.regular_price.toString() : '0',
            sale_price: productData.sale_price ? productData.sale_price.toString() : '',
            description: productData.description || '',
            short_description: productData.description || '',
            sku: productData.sku,
            manage_stock: productData.manageStock,
            stock_quantity: productData.stock,
            low_stock_amount: productData.threshold,
            stock_status: productData.stock > 0 ? 'instock' : 'outofstock'
        };

        // Category matching
        if (productData.category && productData.category !== 'Uncategorized') {
            try {
                const categoriesResponse = await WooCommerce.get("products/categories", { search: productData.category });
                const matchedCat = categoriesResponse.data.find(c => c.name.toLowerCase() === productData.category.toLowerCase());
                if (matchedCat) wooData.categories = [{ id: matchedCat.id }];
            } catch (e) { console.error("Cat fetch err:", e.message); }
        }

        // 2. Create in WooCommerce first to get ID
        const wooResponse = await WooCommerce.post("products", wooData);
        const newWooId = wooResponse.data.id;

        // 3. Move R2 images to the correct folder based on WooCommerce ID
        if (productData.images && productData.images.length > 0) {
            const finalImages = await organizeR2Images(req, productData, newWooId);

            // 4. Update WooCommerce with final R2 URLs
            await WooCommerce.put(`products/${newWooId}`, {
                images: finalImages.map(url => ({ src: url, alt: productData.name }))
            });

            wooResponse.data.images = finalImages.map(url => ({ src: url }));
        }

        // 5. Log activity
        if (productData.stock > 0) {
            await StockLog.create({
                productId: newWooId.toString(),
                sku: productData.sku,
                name: productData.name,
                type: 'restock',
                quantity: productData.stock,
                previousStock: 0,
                newStock: productData.stock,
                reason: 'Initial creation'
            });
        }

        const finalProduct = mapWooToLocal(wooResponse.data);
        io.emit('product:created', finalProduct);
        res.status(201).json(finalProduct);
    } catch (error) {
        console.error("Error creating product:", error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.message || error.message });
    }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const productData = req.body;
        const wooId = req.params.id;

        // 1. Fetch current product from WC to check stock change
        const currentResponse = await WooCommerce.get(`products/${wooId}`);
        const currentProduct = currentResponse.data;

        // 2. Prepare WooCommerce update data
        const wooData = {
            name: productData.name,
            regular_price: productData.regular_price ? productData.regular_price.toString() : undefined,
            sale_price: productData.sale_price !== undefined ? productData.sale_price.toString() : undefined,
            description: productData.description || '',
            short_description: productData.description || '',
            manage_stock: productData.manageStock,
            stock_quantity: productData.stock,
            low_stock_amount: productData.threshold,
            sku: productData.sku
        };

        if (productData.category && productData.category !== 'Uncategorized') {
            try {
                const categoriesResponse = await WooCommerce.get("products/categories", { search: productData.category });
                const matchedCat = categoriesResponse.data.find(c => c.name.toLowerCase() === productData.category.toLowerCase());
                if (matchedCat) wooData.categories = [{ id: matchedCat.id }];
            } catch (e) { console.error("Cat fetch err:", e.message); }
        }

        // Handle images
        productData.images = await organizeR2Images(req, productData, wooId);
        if (productData.images && productData.images.length > 0) {
            wooData.images = productData.images.map(imgUrl => ({ src: imgUrl, alt: productData.name }));
        }

        // 3. Update WooCommerce
        const wooUpdateResponse = await WooCommerce.put(`products/${wooId}`, wooData);

        // 4. Log stock changes locally
        if (productData.stock !== undefined && productData.stock !== currentProduct.stock_quantity) {
            await StockLog.create({
                productId: wooId,
                sku: currentProduct.sku,
                name: currentProduct.name,
                type: 'adjustment',
                quantity: productData.stock - (currentProduct.stock_quantity || 0),
                previousStock: currentProduct.stock_quantity || 0,
                newStock: productData.stock,
                reason: 'Manual adjustment via dashboard'
            });
        }

        const finalProduct = mapWooToLocal(wooUpdateResponse.data);
        io.emit('product:updated', finalProduct);
        res.json(finalProduct);
    } catch (error) {
        console.error("PUT Product Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const wooId = req.params.id;

        // 1. Delete from WooCommerce
        await WooCommerce.delete(`products/${wooId}`, { force: true });

        // 2. Cleanup images from R2
        const prefix = `Products/${wooId}/`;
        try {
            const listParams = {
                Bucket: process.env.R2_BUCKET_NAME || 'sheshopbucket',
                Prefix: prefix
            };
            const listedObjects = await s3.send(new ListObjectsV2Command(listParams));
            if (listedObjects.Contents && listedObjects.Contents.length > 0) {
                const deleteParams = {
                    Bucket: process.env.R2_BUCKET_NAME || 'sheshopbucket',
                    Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) }
                };
                await s3.send(new DeleteObjectCommand(deleteParams));
            }
        } catch (err) {
            console.error("Error cleaning up R2 images on delete:", err.message);
        }

        io.emit('product:deleted', { id: wooId });
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error("DELETE Product Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

// Stock Management Routes
app.post('/api/products/:id/stock/adjust', authenticateToken, async (req, res) => {
    try {
        const { quantity, reason, type } = req.body;
        const wooId = req.params.id;

        // 1. Fetch current stock
        const response = await WooCommerce.get(`products/${wooId}`);
        const product = response.data;

        const previousStock = product.stock_quantity || 0;
        const newStock = Math.max(0, previousStock + quantity);

        // 2. Update WooCommerce
        const updateResponse = await WooCommerce.put(`products/${wooId}`, {
            stock_quantity: newStock
        });

        const updatedProduct = mapWooToLocal(updateResponse.data);

        // 3. Log activity
        await StockLog.create({
            productId: wooId,
            sku: product.sku,
            name: product.name,
            type: type || 'adjustment',
            quantity,
            previousStock,
            newStock,
            reason: reason || 'Manual adjustment via dashboard'
        });

        io.emit('product:updated', updatedProduct);
        res.json(updatedProduct);
    } catch (error) {
        console.error("Stock adjust error:", error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

// Bulk Operations (Simplified to no-op or specific support)
app.post('/api/products/bulk/update', authenticateToken, async (req, res) => {
    res.status(501).json({ error: 'Bulk updates not implemented for direct WooCommerce integration yet.' });
});

// Stock Logs
app.get('/api/stock-logs', authenticateToken, async (req, res) => {
    try {
        const { productId, limit = 50 } = req.query;
        let query = {};
        if (productId) query.productId = productId;

        const logs = await StockLog.find(query)
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
        const response = await WooCommerce.get("products", { per_page: 100 });
        const products = response.data;

        const total = products.length;
        const outOfStock = products.filter(p => (p.stock_quantity || 0) === 0).length;
        const lowStock = products.filter(p => p.manage_stock && (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) <= (p.low_stock_amount || 10)).length;

        let totalValValue = 0;
        products.forEach(p => {
            if (p.price) {
                totalValValue += (parseFloat(p.price) * (p.stock_quantity || 0));
            }
        });

        // Recent activity from MongoDB logs
        const recentLogs = await StockLog.find()
            .sort({ timestamp: -1 })
            .limit(5);

        res.json({
            total,
            lowStock,
            outOfStock,
            totalValue: totalValValue,
            recentActivity: recentLogs
        });
    } catch (error) {
        console.error("Stats Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Categories - Fetch directly from WooCommerce
app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        if (process.env.WOOCOMMERCE_CONSUMER_KEY) {
            const response = await WooCommerce.get("products/categories", { per_page: 100 });
            res.json(response.data);
        } else {
            res.json([]);
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

// Sync with WooCommerce Route
app.post('/api/woocommerce/sync', authenticateToken, async (req, res) => {
    // Sync is now direct. This endpoint just acts as a "Refresh" trigger for the client
    // to re-fetch high-level stats if we add server-side caching later.
    res.json({ message: "Dashboard is now live. Data is directly sourced from WooCommerce." });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeAdmin();
});