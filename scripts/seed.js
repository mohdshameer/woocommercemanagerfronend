const mongoose = require('mongoose');
require('dotenv').config();

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
    attributes: [{ name: String, value: String }],
    salesCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

const sampleProducts = [
    {
        name: 'Wireless Bluetooth Headphones Pro',
        sku: 'WBH-001',
        description: 'Premium wireless headphones with active noise cancellation.',
        price: 129.99,
        stock: 45,
        threshold: 10,
        status: 'instock',
        manageStock: true,
        category: 'Electronics',
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop'],
        attributes: [
            { name: 'Color', value: 'Midnight Black' },
            { name: 'Battery Life', value: '30 hours' }
        ]
    },
    {
        name: 'Organic Cotton T-Shirt',
        sku: 'OCT-002',
        description: 'Comfortable everyday essential made from sustainable materials.',
        price: 34.99,
        stock: 8,
        threshold: 15,
        status: 'instock',
        manageStock: true,
        category: 'Clothing',
        images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop'],
        attributes: [
            { name: 'Size', value: 'M, L, XL' },
            { name: 'Material', value: '100% Organic Cotton' }
        ]
    },
    {
        name: 'Smart Home Hub Gen 2',
        sku: 'SHH-003',
        description: 'Central control for all your smart home devices.',
        price: 199.99,
        stock: 0,
        threshold: 5,
        status: 'outofstock',
        manageStock: true,
        category: 'Electronics',
        images: ['https://images.unsplash.com/photo-1558089687-f282ffcbc126?w=400&h=400&fit=crop'],
        attributes: [
            { name: 'Compatibility', value: 'Alexa, Google, HomeKit' }
        ]
    },
    {
        name: 'Yoga Mat Premium',
        sku: 'YMP-004',
        description: 'Non-slip eco-friendly yoga mat for all skill levels.',
        price: 68.00,
        stock: 23,
        threshold: 8,
        status: 'instock',
        manageStock: true,
        category: 'Sports',
        images: ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=400&fit=crop'],
        attributes: [
            { name: 'Thickness', value: '6mm' },
            { name: 'Material', value: 'Natural Rubber' }
        ]
    },
    {
        name: 'Ceramic Coffee Mug Set',
        sku: 'CCM-005',
        description: 'Handcrafted ceramic mugs with modern minimalist design.',
        price: 42.00,
        stock: 3,
        threshold: 10,
        status: 'instock',
        manageStock: true,
        category: 'Home & Garden',
        images: ['https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop'],
        attributes: [
            { name: 'Capacity', value: '350ml' },
            { name: 'Set Size', value: '4 pieces' }
        ]
    }
];

async function seedDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/woocommerce-manager');
        console.log('Connected to MongoDB');

        await Product.deleteMany({});
        console.log('Cleared existing products');

        await Product.insertMany(sampleProducts);
        console.log('Inserted sample products');

        mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error seeding database:', error);
        mongoose.connection.close();
        process.exit(1);
    }
}

seedDB();
