# Vercel Deployment & Turso Database Setup Guide

This guide covers the complete workflow for deploying the **Cafe Booking & Ordering System** on **Vercel** with **Turso (libSQL)** serverless database and direct UPI payment intent.

---

## 1. Architecture Overview

- **Frontend**: Single Page Application (React 18 + Vite + Tailwind CSS) deployed to Vercel's Global Edge Network (`dist/client`).
- **Backend**: Express API running on Vercel Serverless Functions (`api/index.ts`).
- **Database**: Serverless distributed SQLite via **Turso / libSQL** (`@libsql/client`), eliminating local filesystem dependency.
- **Payments**: Direct UPI Intent (`upi://pay?pa=...`) and staff counter verification (Zero gateway dependencies).
- **Authentication**: Salted 6-digit OTP with database-backed rate-limiting and HttpOnly JWT cookies.

---

## 2. Step-by-Step Deployment Instructions

### Step 1: Create a Turso Database

1. Install the Turso CLI (or use the [Turso Web Dashboard](https://turso.tech)):
   ```bash
   # Windows (via PowerShell)
   irm https://get.tur.so/install.ps1 | iex

   # macOS / Linux
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
2. Log in and create a database:
   ```bash
   turso auth login
   turso db create cafe-db
   ```
3. Retrieve your Database URL and Auth Token:
   ```bash
   turso db show cafe-db --url
   # Example: libsql://cafe-db-yourorg.turso.io

   turso db tokens create cafe-db
   # Example token: eyJhbGciOi...
   ```

---

### Step 2: Push Repository to GitHub

```bash
git init
git add .
git commit -m "feat: Cafe booking & ordering system ready for Vercel + Turso"
git remote add origin https://github.com/your-username/cafe-booking-system.git
git push -u origin main
```

---

### Step 3: Run Database Migrations & Initial Seed

Before launching, initialize the schema and seed data against your Turso database:

```bash
# In your local terminal, temporarily set Turso credentials:
export TURSO_DATABASE_URL="libsql://cafe-db-yourorg.turso.io"
export TURSO_AUTH_TOKEN="your_turso_jwt_token_here"

# Run schema migrations and create initial admin & menu catalog
npm run db:migrate
npm run db:seed
```

---

### Step 4: Import Project into Vercel

1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **"Add New..." ➔ "Project"** and import your GitHub repository.
3. Configure the Project Settings:
   - **Framework Preset**: `Vite` (or `Other`)
   - **Build Command**: `npm run build:client`
   - **Output Directory**: `dist/client`
   - **Install Command**: `npm install`
4. Add the following **Environment Variables** in Vercel:

| Variable Name | Value / Description | Required |
| :--- | :--- | :---: |
| `NODE_ENV` | `production` | **YES** |
| `TURSO_DATABASE_URL` | `libsql://cafe-db-yourorg.turso.io` | **YES** |
| `TURSO_AUTH_TOKEN` | `your_turso_auth_token` | **YES** |
| `SESSION_SECRET` | 64-char random secret (`openssl rand -base64 48`) | **YES** |
| `UPI_ID` | `artisan.cafe@okaxis` (Merchant VPA) | **YES** |
| `CAFE_NAME` | `Artisan Coffee & Bistro` | **YES** |
| `TAX_RATE_PERCENT` | `5.0` | **YES** |
| `ALLOWED_ORIGINS` | `https://your-project.vercel.app` | **YES** |
| `SMS_PROVIDER` | `msg91` or `twilio` (optional for real SMS) | Optional |
| `SMS_API_KEY` | Your SMS provider API key | Optional |

5. Click **"Deploy"**.

---

## 3. Post-Deployment Verification Checklist

1. **API Health Check**:
   Visit `https://your-project.vercel.app/api/health` ➔ should return `{"status":"ok", "timestamp":"..."}`.
2. **Customer Login**:
   Visit `https://your-project.vercel.app/` ➔ enter phone number ➔ verify OTP login.
3. **Table QR Entry**:
   Visit `https://your-project.vercel.app/entry?token=<opaque-token>` ➔ verifies table without leaking internal table codes.
4. **Order Placement & Direct UPI**:
   Place an order ➔ tap **"Pay via UPI"** ➔ verify UPI Intent URI and dynamic QR code generated with exact server total.
5. **Staff Portal & Verification**:
   Log in at `https://your-project.vercel.app/admin/login` (using `admin@cafe.local` / password) ➔ click **"Verify UPI"** on pending order ➔ customer tracker immediately updates to **"Payment Confirmed ✓"**.

---

## 4. Troubleshooting & FAQ

### Database Connection Failure
- **Symptom**: `Failed to connect to libSQL database`
- **Fix**: Verify `TURSO_DATABASE_URL` starts with `libsql://` or `https://` and that `TURSO_AUTH_TOKEN` was generated with `turso db tokens create <db-name>`.

### Cookie / Session Issues on Vercel
- The application sets `SameSite=Lax` and `Secure=true` in production mode (`NODE_ENV=production`), ensuring cookies work across HTTPS on Vercel domains.

### Rate Limiting & Serverless Execution
- In-memory rate limits run per-function instance, but **OTP attempts, cooldowns, and brute-force defenses are persistently tracked in the Turso database (`otp_records` table)**, guaranteeing state consistency across all serverless instances.

### SPA Client-Side Routing (404 on Refresh)
- `vercel.json` rewrites all non-API paths (`/(.*)`) to `/index.html`, ensuring client-side React Router navigation works properly on direct URL navigation.
