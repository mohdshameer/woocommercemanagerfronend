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
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Configure Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

const productSchema = new mongoose.Schema({
    _id: String, // Use WooCommerce ID as string for easy matching
    id: Number,
    name: String,
    type: { type: String, default: 'simple' },
    sku: String,
    description: String,
    price: Number,
    regular_price: Number,
    sale_price: Number,
    stock: Number,
    threshold: Number,
    status: String,
    manageStock: Boolean,
    category: String,
    tags: [String],
    images: [String],
    attributes: [attributeSchema],
    lastUpdated: Date
});

const Product = mongoose.model('Product', productSchema);
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

// Helper to resolve tag names to WooCommerce Tag IDs
async function resolveTags(tagNames) {
    if (!tagNames || tagNames.length === 0) return [];

    try {
        const existingTagsReq = await WooCommerce.get("products/tags", { per_page: 100 });
        const existingTags = existingTagsReq.data;

        let resolvedTags = [];
        for (const tagName of tagNames) {
            let match = existingTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
            if (match) {
                resolvedTags.push({ id: match.id });
            } else {
                try {
                    const newTag = await WooCommerce.post("products/tags", { name: tagName });
                    resolvedTags.push({ id: newTag.data.id });
                } catch (err) {
                    console.error("Error creating tag", err.message);
                }
            }
        }
        return resolvedTags;
    } catch (e) {
        console.error("Error fetching tags for resolution:", e.message);
        return [];
    }
}

// Helper to sync variations for Variable products
async function syncVariations(wooId, productData, wooData) {
    if (wooData.type !== 'variable') return;
    if (!wooData.attributes || wooData.attributes.length === 0) return;

    try {
        const cartesian = (arrays) => arrays.reduce((acc, curr) =>
            acc.flatMap(c => curr.map(n => [...c, n])), [[]]
        );
        const attrOptions = wooData.attributes.filter(a => a.variation);
        if (attrOptions.length === 0) return;

        const permutations = cartesian(attrOptions.map(a => a.options));

        const existingReq = await WooCommerce.get(`products/${wooId}/variations`, { per_page: 100 });
        const existingVariations = existingReq.data;

        const variationsToCreate = [];
        const variationsToUpdate = [];

        permutations.forEach(combo => {
            let attrsToMatch = combo.map((val, idx) => ({
                name: attrOptions[idx].name,
                option: val
            }));

            let match = existingVariations.find(ev => {
                return ev.attributes.length === attrsToMatch.length && attrsToMatch.every(atm => {
                    return ev.attributes.some(eva => eva.name === atm.name && eva.option === atm.option);
                });
            });

            let varPayload = {
                regular_price: productData.regular_price ? productData.regular_price.toString() : '0',
                manage_stock: productData.manageStock,
                stock_quantity: Math.floor((productData.stock || 0) / permutations.length),
                attributes: attrsToMatch
            };
            if (productData.sale_price) varPayload.sale_price = productData.sale_price.toString();

            if (match) {
                varPayload.id = match.id;
                variationsToUpdate.push(varPayload);
            } else {
                variationsToCreate.push(varPayload);
            }
        });

        const variationsToDelete = existingVariations.filter(ev => {
            return !permutations.find(combo => {
                let attrsToMatch = combo.map((val, idx) => ({ name: attrOptions[idx].name, option: val }));
                return ev.attributes.length === attrsToMatch.length && attrsToMatch.every(atm => {
                    return ev.attributes.some(eva => eva.name === atm.name && eva.option === atm.option);
                });
            });
        }).map(ev => ev.id);

        const batchData = {};
        if (variationsToCreate.length > 0) batchData.create = variationsToCreate;
        if (variationsToUpdate.length > 0) batchData.update = variationsToUpdate;
        if (variationsToDelete.length > 0) batchData.delete = variationsToDelete;

        if (Object.keys(batchData).length > 0) {
            await WooCommerce.post(`products/${wooId}/variations/batch`, batchData);
        }
    } catch (e) {
        console.error("Error syncing variations", e.response?.data || e.message);
    }
}

// Routes

// AI Rephrase Route
app.post('/api/ai/rephrase-description', authenticateToken, async (req, res) => {
    try {
        const { description } = req.body;

        if (!description || description.trim() === '') {
            return res.status(400).json({ error: 'Description is required for rephrasing' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Gemini API Key is not configured on the server.' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Rewrite the following product description to be engaging, professional, and well-structured. It should be approximately 150 words long and use HTML tags for formatting if necessary (like <p>, <ul>, <li>, <strong>).\n\nOriginal Description:\n${description}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        res.json({ rephrased: responseText });
    } catch (error) {
        console.error("Gemini AI Error:", error);
        res.status(500).json({ error: 'Failed to rephrase description' });
    }
});

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

// Verify Token Route
app.get('/api/auth/verify', authenticateToken, (req, res) => {
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
    type: woo.type || 'simple',
    sku: woo.sku,
    description: woo.short_description || woo.description,
    price: woo.price !== '' && woo.price !== undefined ? parseFloat(woo.price) : '',
    regular_price: woo.regular_price !== '' && woo.regular_price !== undefined ? parseFloat(woo.regular_price) : '',
    sale_price: woo.sale_price !== '' && woo.sale_price !== undefined ? parseFloat(woo.sale_price) : '',
    stock: woo.stock_quantity || 0,
    threshold: woo.low_stock_amount || 10,
    status: woo.stock_status,
    manageStock: woo.manage_stock,
    category: woo.categories && woo.categories.length > 0 ? woo.categories[0].name : 'Uncategorized',
    tags: woo.tags ? woo.tags.map(t => t.name) : [],
    images: woo.images.map(img => img.src),
    attributes: woo.attributes.map(attr => ({ name: attr.name, value: attr.options.join(', ') })),
    lastUpdated: woo.date_modified
});

// Product Routes
app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const { search, category, status } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } }
            ];
        }

        if (category) {
            query.category = category;
        }

        if (status) {
            query.status = status;
        }

        const products = await Product.find(query).sort({ lastUpdated: -1 });
        res.json(products);
    } catch (error) {
        console.error("GET Products Error:", error.message);
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
            type: productData.type || 'simple',
            regular_price: productData.regular_price !== '' ? productData.regular_price.toString() : '',
            sale_price: productData.sale_price !== '' ? productData.sale_price.toString() : '',
            description: productData.description || '',
            short_description: productData.description || '',
            sku: productData.sku,
            manage_stock: productData.manageStock,
            stock_quantity: productData.stock,
            low_stock_amount: productData.threshold,
            stock_status: productData.stock > 0 ? 'instock' : 'outofstock'
        };

        if (productData.tags && productData.tags.length > 0) {
            wooData.tags = await resolveTags(productData.tags);
        }

        if (productData.attributes && productData.attributes.length > 0) {
            wooData.attributes = productData.attributes.map(attr => ({
                name: attr.name,
                options: attr.value.split(',').map(v => v.trim()),
                visible: true,
                variation: wooData.type === 'variable'
            }));
        }

        // Category matching
        if (productData.category && productData.category !== 'Uncategorized') {
            try {
                const categoriesResponse = await WooCommerce.get("products/categories", { search: productData.category });
                const matchedCat = categoriesResponse.data.find(c => c.name.toLowerCase() === productData.category.toLowerCase());
                if (matchedCat) wooData.categories = [{ id: matchedCat.id }];
            } catch (e) { console.error("Cat fetch err:", e.message); }
        }

        // 2. Create locally in MongoDB for instant feedback
        const localId = 'temp-' + Date.now();
        const finalProduct = {
            ...productData,
            _id: localId,
            id: Date.now(),
            stock: productData.stock || 0,
            threshold: productData.threshold || 10,
            status: (productData.stock > 0) ? 'instock' : 'outofstock',
            lastUpdated: new Date()
        };

        await Product.create(finalProduct);

        io.emit('product:created', finalProduct);
        res.status(201).json(finalProduct);

        // 3. Background Sync to WooCommerce
        process.nextTick(async () => {
            try {
                const wooResponse = await WooCommerce.post("products", wooData);
                const newWooId = wooResponse.data.id;

                // Sync variations if variable
                if (wooData.type === 'variable') {
                    await syncVariations(newWooId, productData, wooData);
                }

                // Move R2 images to the correct folder based on WooCommerce ID
                if (productData.images && productData.images.length > 0) {
                    const finalImages = await organizeR2Images({ body: { productId: 'temp' } }, productData, newWooId);

                    await WooCommerce.put(`products/${newWooId}`, {
                        images: finalImages.map(url => ({ src: url, alt: productData.name }))
                    });
                    // update local DB with final R2 URLs
                    await Product.findByIdAndUpdate(localId, { images: finalImages });
                }

                // Finalize local ID replacement from Woo
                const wooDbRecord = mapWooToLocal(wooResponse.data);
                if (wooDbRecord.images && wooDbRecord.images.length === 0 && productData.images && productData.images.length > 0) {
                    wooDbRecord.images = productData.images; // optimistic UI retainment
                }

                await Product.findByIdAndDelete(localId); // remove temporary optimistic row
                await Product.create(wooDbRecord); // insert actual truth row

                io.emit('product:updated', wooDbRecord);

            } catch (bgError) {
                console.error("Background WooCommerce Create Error:", bgError.message);
            }
        });

        // 2b. Sync variations if variable
        if (wooData.type === 'variable') {
            await syncVariations(newWooId, productData, wooData);
        }

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

        // (Moved to background job)
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
            type: productData.type || 'simple',
            regular_price: productData.regular_price !== '' ? productData.regular_price.toString() : '',
            sale_price: productData.sale_price !== '' ? productData.sale_price.toString() : '',
            description: productData.description || '',
            short_description: productData.description || '',
            manage_stock: productData.manageStock,
            stock_quantity: productData.stock,
            low_stock_amount: productData.threshold,
            sku: productData.sku
        };

        if (productData.tags) {
            wooData.tags = await resolveTags(productData.tags);
        }

        if (productData.attributes) {
            wooData.attributes = productData.attributes.map(attr => ({
                name: attr.name,
                options: attr.value.split(',').map(v => v.trim()),
                visible: true,
                variation: wooData.type === 'variable'
            }));
        } else {
            wooData.attributes = [];
        }

        if (productData.category && productData.category !== 'Uncategorized') {
            try {
                const categoriesResponse = await WooCommerce.get("products/categories", { search: productData.category });
                const matchedCat = categoriesResponse.data.find(c => c.name.toLowerCase() === productData.category.toLowerCase());
                if (matchedCat) wooData.categories = [{ id: matchedCat.id }];
            } catch (e) { console.error("Cat fetch err:", e.message); }
        }

        // 3. Update Locally First
        const finalProduct = {
            ...productData,
            _id: wooId,
            id: parseInt(wooId),
            stock: productData.stock || 0,
            threshold: productData.threshold || 10,
            status: (productData.stock > 0) ? 'instock' : 'outofstock',
            lastUpdated: new Date()
        };

        await Product.findByIdAndUpdate(wooId, finalProduct, { upsert: true });

        // 4. Log stock changes locally immediately
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

        io.emit('product:updated', finalProduct);
        res.json(finalProduct);

        // 5. Background Sync to WooCommerce
        process.nextTick(async () => {
            try {
                // Handle images to R2
                productData.images = await organizeR2Images({ body: { productId: wooId } }, productData, wooId);
                if (productData.images && productData.images.length > 0) {
                    wooData.images = productData.images.map(imgUrl => ({ src: imgUrl, alt: productData.name }));
                    await Product.findByIdAndUpdate(wooId, { images: productData.images }); // update local with R2 urls definitively
                }

                // Update WooCommerce
                const wooUpdateResponse = await WooCommerce.put(`products/${wooId}`, wooData);

                // Sync variations if variable
                if (wooData.type === 'variable') {
                    await syncVariations(wooId, productData, wooData);
                }

                // Align any background formatting
                const wooDbRecord = mapWooToLocal(wooUpdateResponse.data);
                if (productData.images && productData.images.length > 0 && wooDbRecord.images.length === 0) {
                    wooDbRecord.images = productData.images;
                }
                await Product.findByIdAndUpdate(wooId, wooDbRecord);

            } catch (bgError) {
                console.error("Background PUT Product Error:", bgError.message);
            }
        });
    } catch (error) {
        console.error("PUT Product Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const wooId = req.params.id;

        // 1. Delete from local MongoDB First
        await Product.findByIdAndDelete(wooId);

        io.emit('product:deleted', { id: wooId });
        res.json({ message: 'Product deleted successfully' });

        // 2. Background cleanup from WooCommerce & R2
        process.nextTick(async () => {
            try {
                await WooCommerce.delete(`products/${wooId}`, { force: true });

                const prefix = `Products/${wooId}/`;
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
            } catch (bgError) {
                console.error("Background DELETE Product Error:", bgError.message);
            }
        });
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
        const total = await Product.countDocuments();
        const outOfStock = await Product.countDocuments({ stock: { $lte: 0 } });
        const lowStock = await Product.countDocuments({ manageStock: true, stock: { $gt: 0, $lte: 10 } });

        // Aggregate total value
        const valAgg = await Product.aggregate([
            {
                $project: {
                    itemValue: { $multiply: ["$price", "$stock"] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalValue: { $sum: "$itemValue" }
                }
            }
        ]);

        const totalValValue = valAgg.length > 0 ? valAgg[0].totalValue : 0;

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

// Core Sync Function
async function performWooCommerceSync() {
    try {
        let allProducts = [];
        let page = 1;
        let totalPages = 1;

        console.log("Starting WooCommerce Sync...");
        do {
            const response = await WooCommerce.get("products", { per_page: 100, page: page });
            allProducts = allProducts.concat(response.data);
            totalPages = parseInt(response.headers['x-wp-totalpages'] || 1);
            page++;
        } while (page <= totalPages);

        const localData = allProducts.map(mapWooToLocal);

        await Product.deleteMany({});
        if (localData.length > 0) {
            await Product.insertMany(localData);
        }

        console.log(`Sync complete. Loaded ${localData.length} products to Local Database.`);
        io.emit('sync:complete', { count: localData.length });
        return localData.length;
    } catch (error) {
        console.error("WooCommerce Sync Error:", error.response?.data || error.message);
        throw error;
    }
}

// Sync with WooCommerce Route
app.post('/api/woocommerce/sync', authenticateToken, async (req, res) => {
    try {
        const count = await performWooCommerceSync();
        res.json({ message: "Sync complete! Local cache is perfectly aligned.", count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeAdmin();

    // Auto-hydrate if database is entirely empty
    try {
        const currentCount = await Product.countDocuments();
        if (currentCount === 0) {
            console.log("No products found in local database. Auto-hydrating...");
            await performWooCommerceSync();
        }
    } catch (e) {
        console.error("Auto-hydrate check failed:", e.message);
    }
});