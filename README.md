# ☕ Sandycaffee POS System

A complete Point of Sale system for Sandycaffee built with Node.js + Express + SQLite.

## Features

- **Login & Sessions** — JWT-based auth with 3 roles: Administrator, Cashier, Kitchen
- **Dashboard** — Daily revenue, order count, best seller, hourly sales chart, low stock alerts
- **User Management** — Create/edit/deactivate users with roles
- **Categories** — Manage categories with emoji and colour
- **Products** — Full product management with photos, stock tracking, auto low-stock alerts
- **Meals / Combos** — Create combo meals linking existing products
- **Tables & QR Codes** — Generate printable QR codes per table
- **Customer Ordering** — Mobile-friendly page at `/table/:number` — no login required
- **POS / Till** — Product buttons, cart, cash/card/QR payment, receipt printing
- **Kitchen Display** — Live orders with status management, auto-refresh every 10s
- **Inventory** — Stock levels, manual restock, stock movement history, PDF export
- **Reports** — Sales by day/week/month, best-selling products, stock report, PDF export

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Administrator | admin | admin123 |
| Cashier | Sarah | cashier123 |
| Kitchen | Chef Tom | kitchen123 |

## Local Setup

### Prerequisites
- Node.js v18+
- npm

### Install & Run

```bash
# Clone or enter the project directory
cd cafe-pos

# Install dependencies
npm install

# Start the server
npm start

# Or for development with auto-restart
npm run dev   # requires: npm install -g nodemon
```

Open your browser at: **http://localhost:3000**

The database is created automatically on first run with seed data:
- 3 categories (Hot Drinks, Cold Drinks, Food)
- 5 products (Espresso, Latte, Iced Coffee, Croissant, Chocolate Cake)
- 2 meals (Coffee & Croissant, Afternoon Tea)
- 3 tables (Table 1, 2, 3)
- 3 users (admin, Sarah, Chef Tom)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | `sandycaffee_jwt_secret_2024` | JWT signing secret |
| `BASE_URL` | `http://localhost:3000` | Base URL for QR code generation |
| `DB_PATH` | `./sandycaffee.db` | SQLite database path |

## Deploy to Railway

1. Push this project to a GitHub repository
2. Go to [railway.app](https://railway.app) and create a new project
3. Select **Deploy from GitHub repo** and choose your repository
4. Add environment variables:
   - `JWT_SECRET` → a long random secret string
   - `BASE_URL` → your Railway public URL (e.g. `https://sandycaffee.up.railway.app`)
5. Railway will detect `railway.json` and deploy automatically

### Important for Railway
- The SQLite database file is stored on the Railway volume — data persists between deploys
- Set `BASE_URL` to your Railway domain so QR codes point to the correct URL
- The `Procfile` tells Railway to run `node server.js`

## Project Structure

```
cafe-pos/
├── server.js              # Express app entry point
├── package.json
├── railway.json           # Railway deployment config
├── Procfile               # web: node server.js
├── database/
│   ├── db.js              # SQLite setup + table creation
│   └── seed.js            # Initial data seed
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── routes/
│   ├── auth.js            # POST /api/auth/login
│   ├── users.js           # CRUD /api/users
│   ├── categories.js      # CRUD /api/categories
│   ├── products.js        # CRUD /api/products (with photo upload)
│   ├── meals.js           # CRUD /api/meals
│   ├── tables.js          # CRUD /api/tables + QR generation
│   ├── orders.js          # Order creation + kitchen endpoint
│   ├── sales.js           # Sales recording + today summary
│   ├── inventory.js       # Stock management + PDF export
│   └── reports.js         # Sales reports + PDF export
└── public/
    ├── login.html
    ├── dashboard.html
    ├── users.html
    ├── categories.html
    ├── products.html
    ├── meals.html
    ├── tables.html
    ├── pos.html            # POS / Till
    ├── kitchen.html        # Kitchen Display
    ├── inventory.html      # Inventory Management
    ├── reports.html        # Reports & Analytics
    ├── customer.html       # Customer QR ordering page
    ├── css/
    │   ├── admin.css       # Dark admin theme
    │   └── customer.css    # Light mobile customer theme
    ├── js/
    │   ├── auth.js         # Shared auth utilities + sidebar
    │   ├── dashboard.js
    │   ├── users.js
    │   ├── categories.js
    │   ├── products.js
    │   ├── meals.js
    │   ├── tables.js
    │   ├── pos.js
    │   ├── kitchen.js
    │   ├── inventory.js
    │   └── reports.js
    └── uploads/            # Uploaded product photos
```

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript, Chart.js (CDN)
- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **QR Codes**: qrcode npm package
- **PDF Export**: pdfkit npm package
- **File Uploads**: multer
- **Font**: Poppins (Google Fonts)
