# Finance Tracker Backend

A RESTful API backend for a finance tracking application. Built with **Node.js**, **Express v5**, and **PostgreSQL**. Supports multi-user authentication, role-based access control, income/expense records management, category management, and an analytics dashboard.
This application is designed for organizational use, where an Admin has full management control, an Analyst can view records and the dashboard, and a Viewer has read-only access to records. Users can self-register as Viewers, and only the Admin can assign or update user roles.
---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [Auth](#auth)
  - [Users](#users)
  - [Records](#records)
  - [Categories](#categories)
  - [Dashboard](#dashboard)
- [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [Error Handling](#error-handling)
- [Known Issues & Improvements](#known-issues--improvements)

---

## Features

- **JWT Authentication** — access tokens (15m day) + refresh tokens (7 days) stored in a `sessions` table
- **Token Rotation** — on every `/auth/refresh`, the old refresh token is deleted and a new one is issued
- **Role-Based Access Control** — three roles: `admin`, `analyst`, `viewer` with fine-grained endpoint permissions
- **Financial Records** — create, read, update, soft-delete income and expense transactions with filtering and pagination
- **Categories** — manage income/expense categories; records can auto-create categories by name
- **Dashboard Analytics** — summary totals, spending by category, monthly income vs expense trends, recent records
- **Input Validation** — all request bodies validated with Zod schemas
- **Security** — Helmet for HTTP headers, bcrypt for password hashing, parameterized SQL queries

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express v5 |
| Database | PostgreSQL (via `pg` connection pool) |
| Authentication | JWT (`jsonwebtoken`) |
| Password Hashing | `bcrypt` |
| Validation | `zod` |
| HTTP Security | `helmet`, `cors` |
| Logging | `morgan` |
| Dev Server | `nodemon` |

---

## Project Structure

```
src/
├── server.js                   # Entry point — starts HTTP server
├── app.js                      # Express app setup — middleware, routes, error handler
├── config/
│   └── db.js                   # PostgreSQL connection pool
├── middlewares/
│   ├── auth.middleware.js       # JWT verification — attaches req.user
│   └── rbac.middleware.js       # Role-based access control guard
├── utils/
│   ├── AppError.js              # Custom operational error class
│   ├── hash.js                  # bcrypt hash and compare helpers
│   └── jwt.js                   # Access and refresh token generators
└── modules/
    ├── auth/                    # Registration, login, token refresh, logout
    ├── users/                   # User listing, role/status management, profile
    ├── records/                 # Financial records CRUD
    ├── categories/              # Category CRUD
    └── dashboard/               # Analytics endpoints
```

Each module follows a consistent four-layer architecture:

```
routes.js        → defines Express routes and applies middleware
controller.js    → validates input, calls service, sends response
service.js       → business logic
repository.js    → raw SQL queries via the pg pool
validation.js    → Zod schemas for request body validation
```

---

## Database Schema

The application expects the following tables in PostgreSQL. You will need to create them manually (no migration tool is included).

```sql
-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(50) DEFAULT 'viewer',   -- 'viewer' | 'analyst' | 'admin'
  status        VARCHAR(50) DEFAULT 'active',   -- 'active' | 'inactive'
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Sessions (refresh tokens)
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  user_agent    TEXT,
  ip_address    TEXT,
  expires_at    TIMESTAMP NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  type       VARCHAR(50) NOT NULL,   -- 'income' | 'expense'
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Financial Records
CREATE TABLE financial_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  type        VARCHAR(50) NOT NULL,    -- 'income' | 'expense'
  amount      NUMERIC(12, 2) NOT NULL,
  record_date DATE NOT NULL,
  notes       TEXT,
  deleted_at  TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL 14+

### Installation

```bash
# Clone the repository
git clone https://github.com/zaranasanghavi/finance_tracker_Backend.git
cd finance_tracker_Backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your values (see Environment Variables section)

# Create the database tables
# Run the SQL from the Database Schema section above in your PostgreSQL client

# Start development server
npm run dev
npm install express pg dotenv cors helmet morgan bcrypt jsonwebtoken zod
npm install --save-dev nodemon
# Or start production server
npm start
```

The API will be available at `http://localhost:5000`.

---

## Environment Variables

Create a `.env` file in the root of the project with the following variables:

```env
# Server
PORT=5000

# PostgreSQL
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<dbname>

# JWT
JWT_SECRET=<your-strong-access-token-secret>

JWT_REFRESH_SECRET=<your-strong-refresh-token-secret>
```

> ⚠️ **Never commit your `.env` file.** Add it to `.gitignore`.

---

## API Reference

All protected routes require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

---

### Auth

Base path: `/api/auth`

#### `POST /api/auth/register`

Register a new user. New users are assigned the `viewer` role by default.

**Request body:**
```json
{
  "name": "Zarana Sanghavi",
  "email": "zarana@example.com",
  "password": "secret123"
}
```

**Validation rules:** `name` ≥ 2 chars, valid `email`, `password` ≥ 6 chars.

**Response `201`:**
```json
{
  "id": "uuid",
  "email": "zarana@example.com",
  "role": "viewer"
}
```

---

#### `POST /api/auth/login`

Authenticate a user and receive tokens.

**Request body:**
```json
{
  "email": "zarana@example.com",
  "password": "secret123"
}
```

**Response `200`:**
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

The refresh token is stored in the `sessions` table along with the client's `User-Agent` and IP address.

---

#### `POST /api/auth/refresh`

Exchange a valid refresh token for a new access token and refresh token. The old refresh token is immediately deleted (token rotation).

**Request body:**
```json
{
  "refreshToken": "<jwt>"
}
```

**Response `200`:**
```json
{
  "accessToken": "<new-jwt>",
  "refreshToken": "<new-jwt>"
}
```

---

#### `POST /api/auth/logout`

Invalidate a refresh token (deletes the session).

**Request body:**
```json
{
  "refreshToken": "<jwt>"
}
```

**Response `200`:**
```json
{ "message": "Logged out" }
```

---

### Users

Base path: `/api/users`

#### `GET /api/users` — `admin` only

List all users with pagination.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Results per page |

**Response `200`:**
```json
{
  "data": [
    { "id": "uuid", "name": "...", "email": "...", "role": "viewer", "status": "active", "created_at": "..." }
  ],
  "meta": { "total": 42, "page": 1, "pages": 5 }
}
```

---
#### `GET /api/users/:id` — `admin` only

Get a specific user by their ID.

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | UUID | ID of the user |

**Response `200`:**
```json
{
  "id": "uuid",
  "name": "Zarana Sanghavi",
  "email": "zarana@example.com",
  "role": "viewer",
  "status": "active",
  "created_at": "2025-01-01T12:00:00.000Z"
}
```

---
`GET /api/users/me` — any authenticated user

Get the currently authenticated user's profile.

**Response `200`:**
```json
{
  "id": "uuid",
  "name": "Zarana Sanghavi",
  "email": "zarana@example.com",
  "role": "viewer",
  "status": "active"
}
```

---

#### `PATCH /api/users/:id/role` — `admin` only

Update a user's role.

**Request body:**
```json
{ "role": "analyst" }
```

Valid roles: `viewer`, `analyst`, `admin`.

**Response `200`:**
```json
{ "id": "uuid", "email": "...", "role": "analyst" }
```

---

#### `PATCH /api/users/:id/status` — `admin` only

Activate or deactivate a user account.

**Request body:**
```json
{ "status": "inactive" }
```

Valid statuses: `active`, `inactive`.

**Response `200`:**
```json
{ "id": "uuid", "email": "...", "status": "inactive" }
```

---

### Records

Base path: `/api/records`

Financial records support **soft deletion** — deleted records have `deleted_at` set and are excluded from all queries.

#### `POST /api/records` — `admin` only

Create a new income or expense record. You can pass either a `category_id` (UUID of an existing category) or a `category` name string. If a name is provided and no matching category exists, one is automatically created.

**Request body:**
```json
{
  "amount": 5000.00,
  "type": "income",
  "category_id": "uuid",
  "record_date": "2025-01-15",
  "notes": "January salary"
}
```

Or with category name auto-creation:
```json
{
  "amount": 250.00,
  "type": "expense",
  "category": "Groceries",
  "record_date": "2025-01-20"
}
```

**Validation rules:** `amount` must be positive; `type` must be `"income"` or `"expense"`; either `category_id` or `category` is required.

**Response `201`:** Returns the created record object.

---

#### `GET /api/records` — `admin`, `analyst`, `viewer`

List records with optional filtering and pagination.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `type` | string | Filter by `income` or `expense` |
| `category_id` | UUID | Filter by category |
| `startDate` | date string | Filter records on or after this date |
| `endDate` | date string | Filter records on or before this date |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 10) |

**Response `200`:**
```json
{
  "data": [ { ...record } ],
  "meta": { "total": 100, "page": 1, "pages": 10 }
}
```

---

#### `GET /api/records/:id` — `admin`, `analyst`, `viewer`

Get a single record by ID.

**Response `200`:** Returns the record object, or an error if not found.

---

#### `PATCH /api/records/:id` — `admin` only

Update a record's fields. All fields are optional.

**Request body:**
```json
{
  "amount": 5500.00,
  "notes": "Updated salary"
}
```

**Response `200`:** Returns the updated record object.

---

#### `DELETE /api/records/:id` — `admin` only

Soft-delete a record (sets `deleted_at = NOW()`). The record is not removed from the database.

**Response `200`:**
```json
{ "message": "Record deleted" }
```

---

### Categories

Base path: `/api/categories`

#### `POST /api/categories` — `admin` only

Create a new category.

**Request body:**
```json
{
  "name": "Utilities",
  "type": "expense"
}
```

**Validation:** `name` ≥ 2 chars; `type` must be `"income"` or `"expense"`.

**Response `201`:** Returns the created category object.

---

#### `GET /api/categories` — `admin`, `analyst`, `viewer`

List all active (non-deleted) categories, ordered by most recently created.

**Response `200`:**
```json
[
  { "id": "uuid", "name": "Salary", "type": "income", "created_at": "..." },
  { "id": "uuid", "name": "Rent", "type": "expense", "created_at": "..." }
]
```

---

#### `PATCH /api/categories/:id` — `admin` only

Update a category's name and/or type.

**Request body:**
```json
{
  "name": "Utility Bills",
  "type": "expense"
}
```

**Response `200`:** Returns the updated category object.

---

#### `DELETE /api/categories/:id` — `admin` only

Hard-delete a category. Note: this is a permanent deletion, unlike records which are soft-deleted.

**Response `200`:**
```json
{ "message": "Category deleted" }
```

---

### Dashboard

Base path: `/api/dashboard`

All dashboard endpoints are available to `admin` and `analyst` roles only. The data scope is determined by role: `admin` and `analyst` see **all users' data**; other roles (if ever granted access) would only see their own.

#### `GET /api/dashboard/summary`

Returns total income, total expenses, and net balance.

**Response `200`:**
```json
{
  "income": 15000.00,
  "expense": 8500.00,
  "net": 6500.00
}
```

---

#### `GET /api/dashboard/by-category`

Returns total spending grouped by category name, ordered by highest total.

**Response `200`:**
```json
[
  { "name": "Rent", "total": "5000.00" },
  { "name": "Groceries", "total": "1200.00" }
]
```

---

#### `GET /api/dashboard/trends`

Returns monthly income and expense totals, useful for charting trends over time.

**Response `200`:**
```json
[
  { "month": "2025-01", "income": "5000.00", "expense": "3200.00" },
  { "month": "2025-02", "income": "5000.00", "expense": "2800.00" }
]
```

---

#### `GET /api/dashboard/recent`

Returns the most recently created records.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 10 | Number of records to return |

**Response `200`:** Array of record objects ordered by `created_at DESC`.

---

## Role-Based Access Control (RBAC)

The API uses a three-tier role system. Roles are assigned per user and enforced on every protected route by the `rbac.middleware.js` guard.

| Role | Description |
|---|---|
| `viewer` | Read-only access to records and categories |
| `analyst` | Read access to records, categories, and all dashboard analytics |
| `admin` | Full access — can create, update, delete records/categories and manage users |

**Endpoint permission summary:**

| Endpoint | viewer | analyst | admin |
|---|---|---|---|
| `POST /api/auth/*` | ✅ | ✅ | ✅ |
| `GET /api/users/me` | ✅ | ✅ | ✅ |
| `GET /api/users` | ❌ | ❌ | ✅ |
| `GET /api/users/:id` | ❌ | ❌ | ✅ |
| `PATCH /api/users/:id/role` | ❌ | ❌ | ✅ |
| `PATCH /api/users/:id/status` | ❌ | ❌ | ✅ |
| `GET /api/records` | ✅ | ✅ | ✅ |
| `GET /api/records/:id` | ✅ | ✅ | ✅ |
| `POST /api/records` | ❌ | ❌ | ✅ |
| `PATCH /api/records/:id` | ❌ | ❌ | ✅ |
| `DELETE /api/records/:id` | ❌ | ❌ | ✅ |
| `GET /api/categories` | ✅ | ✅ | ✅ |
| `POST /api/categories` | ❌ | ❌ | ✅ |
| `PATCH /api/categories/:id` | ❌ | ❌ | ✅ |
| `DELETE /api/categories/:id` | ❌ | ❌ | ✅ |
| `GET /api/dashboard/*` | ❌ | ✅ | ✅ |

---

## Error Handling

All errors flow through the central error handler in `app.js`. Operational errors (thrown as `AppError`) return a structured JSON response:

```json
{
  "status": "error",
  "message": "Email already exists"
}
```

Unhandled/unexpected errors return:

```json
{
  "status": "fail",
  "message": "Internal Server Error"
}
```

Zod validation errors are automatically forwarded to the error handler and will return the validation failure details.

Common HTTP status codes used:

| Code | Meaning |
|---|---|
| `200` | Success |
| `400` | Bad request / validation error |
| `401` | Unauthorized / invalid or expired token |
| `403` | Forbidden / insufficient role |
| `404` | Resource not found |
| `500` | Internal server error |

**Architecture**
- The dashboard's `resolveScope` function grants `admin` and `analyst` access to all users' data. Consider whether analysts should see all data or only their own.
- Categories `deleteCategory` is a hard delete while records use soft delete — this inconsistency could cause orphaned foreign key references.
- There are two redundant refresh token env vars (`REFRESH_TOKEN_SECRET` and `JWT_REFRESH_SECRET`) — only `JWT_REFRESH_SECRET` is actually used.

**Quality**
- No test suite exists. Consider adding Jest + Supertest for integration tests.
- No database migration tool — schema must be created manually.
- No rate limiting on auth endpoints (`/login`, `/register`).
- Consider adding a `.env.example` file for easier onboarding.
- `express.json()` is called twice in `app.js`.
