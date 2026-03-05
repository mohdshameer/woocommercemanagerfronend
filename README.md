# woocommercemanagerfronend
# WooCommerce Stock Manager

A real-time inventory management system built with Node.js, Express, MongoDB, and Socket.io.

## Features

- 🔐 JWT-based admin authentication
- 📦 Product CRUD operations with image upload
- 📊 Real-time stock updates via WebSockets
- 📱 Responsive mobile-first design
- 📈 Dashboard analytics and activity logs
- 🔄 Live inventory simulation

## Quick Start

### Prerequisites

- Node.js (v16+)
- MongoDB (local or Atlas)

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/YOUR_USERNAME/woocommerce-stock-manager.git
   cd woocommerce-stock-manager
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Create `.env` file:
   \`\`\`env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/woocommerce-manager
   JWT_SECRET=your-super-secret-key
   NODE_ENV=development
   \`\`\`

4. Seed sample data (optional):
   \`\`\`bash
   npm run seed
   \`\`\`

5. Start the server:
   \`\`\`bash
   npm start
   # or for development with auto-reload:
   npm run dev
   \`\`\`

6. Open browser: `http://localhost:3000`

### Default Login

- **Username:** admin
- **Password:** admin123

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/products` | List all products |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/api/products/:id/stock/adjust` | Adjust stock |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/stock-logs` | Activity logs |

## Project Structure

\`\`\`
├── server.js          # Main server file
├── public/            # Frontend files
├── scripts/           # Utility scripts
├── package.json       # Dependencies
└── .env              # Environment variables
\`\`\`

## Technologies

- **Backend:** Node.js, Express, Socket.io
- **Database:** MongoDB with Mongoose
- **Frontend:** Vanilla JS, Tailwind CSS
- **Auth:** JWT (JSON Web Tokens)
- **Real-time:** WebSockets

## License

MIT