# Point of Sale (PoS) System

A comprehensive Point of Sale system with appointment/reservation management for beauty salons and catering businesses. Built with Node.js, Express, React, PostgreSQL, and Prisma.

## Features

### Core Functionality
- **Multi-tenant Architecture**: Support for multiple businesses with isolated data
- **User Management**: Role-based access control (Super Admin, Owner, Manager, Staff)
- **Catalog Management**: Products and services with categories and options
- **Order Management**: Create, modify, and track orders with real-time totals
- **Payment Processing**: 
  - Multiple payment methods (Cash, Card via Stripe, Gift Cards)
  - Split payments support
  - Refund management
- **Reservation System**: Appointment scheduling with conflict detection
- **Discount Management**: Order-level and line-level discounts
- **Inventory Tracking**: Stock management with automatic adjustments
- **Tax Management**: Version-controlled tax rules with historical preservation
- **Gift Cards**: Issue, validate, and manage gift card balances

### Industry-Specific Features
- **Beauty Industry**: Service appointments, employee scheduling, service duration tracking
- **Catering Industry**: Table/area management, walk-in and reservation flows

## Technology Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Google OAuth 2.0 + JWT
- **Payment Processing**: Stripe
- **Language**: TypeScript

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React icons
- **HTTP Client**: Axios
- **Notifications**: React Hot Toast

## Prerequisites

- Node.js 20 or higher
- PostgreSQL 14 or higher
- npm or yarn
- Google Cloud account (for OAuth)
- Stripe account (for payments)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd vupsp
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
# DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, STRIPE_SECRET_KEY

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed initial data (optional)
# Create first Super Admin manually in database

# Start development server
npm run dev
```

The backend will run on http://localhost:5000

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
# VITE_API_URL, VITE_GOOGLE_CLIENT_ID, VITE_STRIPE_PUBLISHABLE_KEY

# Start development server
npm run dev
```

The frontend will run on http://localhost:3001

### 4. Database Setup

Create the initial Super Admin account:

```sql
INSERT INTO "Employee" (
  "googleId",
  "email",
  "name",
  "role",
  "status",
  "createdAt",
  "updatedAt"
) VALUES (
  '<your-google-account-id>',
  '<your-email@example.com>',
  'Super Admin',
  'SuperAdmin',
  'Active',
  NOW(),
  NOW()
);
```

### 5. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - http://localhost:3001/auth/google/callback (development)
   - Your production URL
6. Copy Client ID and Client Secret to .env files

### 6. Configure Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get your API keys from Developers > API keys
3. Add keys to backend/.env and frontend/.env
4. For testing, use test mode keys (starting with `sk_test_` and `pk_test_`)

## Docker Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services will be available at:
- Frontend: http://localhost:3001
- Backend: http://localhost:5000
- PostgreSQL: localhost:5432

## Project Structure

```
vupsp/
├── backend/
│   ├── src/
│   │   ├── routes/           # API route handlers
│   │   ├── middleware/       # Auth, error handling
│   │   ├── lib/              # Database, utilities
│   │   └── server.ts         # Express app entry
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── store/            # Zustand state management
│   │   ├── lib/              # API client, utilities
│   │   ├── App.tsx           # Main app component
│   │   └── main.tsx          # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml
└── plan.md                   # Detailed specification
```

## API Documentation

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Get current user

### Businesses
- `POST /api/businesses` - Create business (Super Admin only)
- `GET /api/businesses` - List all businesses
- `GET /api/businesses/:id` - Get business details
- `PUT /api/businesses/:id` - Update business

### Employees
- `POST /api/employees` - Create employee
- `GET /api/employees` - List employees
- `GET /api/employees/:id` - Get employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Deactivate employee

### Catalog
- `POST /api/catalog/categories` - Create category
- `GET /api/catalog/categories` - List categories
- `POST /api/catalog/items` - Create catalog item
- `GET /api/catalog/items` - List catalog items
- `GET /api/catalog/items/:id` - Get item details
- `PUT /api/catalog/items/:id` - Update item
- `POST /api/catalog/items/:id/employees` - Assign employee to service

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/:id/lines` - Add order line
- `PUT /api/orders/:id/lines/:lineId` - Update order line
- `DELETE /api/orders/:id/lines/:lineId` - Remove order line
- `POST /api/orders/:id/discount` - Apply discount
- `POST /api/orders/:id/close` - Close order

### Payments
- `POST /api/payments/create-intent` - Create Stripe payment intent
- `POST /api/payments` - Record payment
- `GET /api/payments/order/:orderId` - Get order payments
- `POST /api/payments/refund` - Process refund

### Reservations
- `POST /api/reservations` - Create reservation
- `GET /api/reservations` - List reservations
- `GET /api/reservations/:id` - Get reservation details
- `PUT /api/reservations/:id` - Update reservation
- `POST /api/reservations/:id/cancel` - Cancel reservation
- `POST /api/reservations/:id/complete` - Complete reservation

### Discounts
- `POST /api/discounts` - Create discount
- `GET /api/discounts` - List discounts
- `GET /api/discounts/code/:code` - Get discount by code
- `PUT /api/discounts/:id` - Update discount
- `DELETE /api/discounts/:id` - Deactivate discount

### Gift Cards
- `POST /api/gift-cards` - Issue gift card
- `GET /api/gift-cards` - List gift cards
- `GET /api/gift-cards/code/:code` - Get gift card by code
- `GET /api/gift-cards/balance/:code` - Check balance
- `PUT /api/gift-cards/:id/status` - Block/unblock card

### Inventory
- `POST /api/inventory/items` - Create stock item
- `GET /api/inventory/items` - List stock items
- `GET /api/inventory/items/:id` - Get stock details
- `POST /api/inventory/movements` - Record stock movement
- `GET /api/inventory/movements` - List movements

### Taxes
- `POST /api/taxes` - Create tax rule (Super Admin only)
- `GET /api/taxes` - List tax rules
- `GET /api/taxes/current` - Get current tax rate
- `DELETE /api/taxes/:id` - Deactivate tax rule

## Business Flows

### Create Business
1. Super Admin creates business with owner credentials
2. Owner receives invitation or uses Google OAuth to log in
3. Owner configures catalog (categories, items, options)
4. Owner adds employees and assigns them to services
5. System is ready for operations

### Process Order (Catering)
1. Employee creates new order
2. Assigns table/area (optional)
3. Adds items to order
4. Applies discounts if applicable
5. Customer requests bill
6. Employee processes payment (cash/card/gift card/split)
7. System closes order and adjusts inventory

### Process Appointment (Beauty)
1. Customer books appointment (online or in-person)
2. System checks employee availability
3. Reservation is created with services
4. Customer arrives and checks in
5. Employee creates order from reservation
6. Services are performed
7. Additional items can be added
8. Payment is processed
9. Order is closed

## Error Handling

The API uses standard HTTP status codes and returns errors in this format:

```json
{
  "code": 400,
  "message": "Invalid request parameters",
  "details": [
    "Field 'email' must be a valid email address"
  ]
}
```

Common error codes:
- 400: Bad Request (validation errors)
- 401: Unauthorized (invalid/missing token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (resource doesn't exist)
- 409: Conflict (duplicate code, time slot unavailable)
- 500: Internal Server Error

## Security

- **Authentication**: Google OAuth 2.0 for identity verification
- **Authorization**: JWT tokens with role-based access control
- **Payment Security**: PCI-DSS compliant (Stripe handles card data)
- **Data Isolation**: Multi-tenant architecture with business-level isolation
- **Password Security**: No passwords stored (OAuth only)
- **API Security**: CORS, Helmet.js, rate limiting (recommended for production)

## Production Deployment

### Environment Variables

Ensure all production values are set:
- Use strong JWT_SECRET
- Configure production database URL
- Use production Google OAuth credentials
- Use production Stripe keys
- Set NODE_ENV=production
- Configure FRONTEND_URL for CORS

### Database Migrations

```bash
npx prisma migrate deploy
```

### Build and Deploy

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
# Serve dist/ with nginx or similar
```

### Recommended Hosting
- **Backend**: AWS EC2, DigitalOcean Droplets, Heroku
- **Frontend**: Vercel, Netlify, AWS S3 + CloudFront
- **Database**: AWS RDS PostgreSQL, DigitalOcean Managed Databases
- **Container**: AWS ECS, Google Cloud Run, DigitalOcean App Platform

## Monitoring and Maintenance

- Monitor application logs
- Set up error tracking (Sentry, LogRocket)
- Regular database backups
- Monitor Stripe webhooks
- Review and update tax rules as needed
- Regular security updates

