# Cafe Booking & Ordering System

A full-stack, secure, and production-ready Cafe Booking & Ordering platform built for seamless dine-in mobile ordering, real-time kitchen tracking, and comprehensive admin/staff operations.

---

## 🌟 Core Features

- **📱 Customer Mobile-First Dining Flow**:
  - **Zero ID Leakage Table Security**: Cryptographic 256-bit opaque tokens bound to physical table QR standees.
  - **OTP Authentication**: 6-digit salted OTP verification with brute-force lockout and 60-second cooldown protection.
  - **Interactive Menu Catalog**: Dietary filters (Vegetarian, Spicy), live dish search, and rich modal dish previews.
  - **Slide-Over Cart & Review**: Item quantity controls, special dietary notes, and server-authoritative 5% GST tax calculation.
  - **Direct UPI Intent Payment**: Generates dynamic `upi://pay?pa=...` links and scannable QR codes. Zero gateway middleman fees.
  - **Live Dine-In Order Tracker**: Automatic timeline updates (`Placed` ➔ `Accepted` ➔ `Preparing` ➔ `Ready` ➔ `Served` ➔ `Completed`).

- **👨‍🍳 Admin & Kitchen Operations Portal**:
  - **Live Kitchen Orders Board**: Real-time order queue with table binding, sound chime alerts, and status lifecycle progression.
  - **Staff Payment Verification**: One-click staff confirmation for direct UPI transfers and counter cash collections with audit trail.
  - **Table & QR Standee Generator**: Visual table occupancy grid, instant cryptographic token regeneration, and printable standees.
  - **Menu & Category Management**: Live dish editor, price updates, and stock availability toggling.
  - **Sales Analytics & Reports**: Revenue breakdown, AOV, top-selling dishes, and customer dining histories.

---

## 🏗️ Architecture & Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti
- **Backend API**: Express.js, TypeScript, Zod Schema Validation, Helmet, Cookie Parser
- **Database Layer**: **Turso / libSQL (`@libsql/client`)** — Serverless distributed SQLite with ACID transactional integrity.
- **Deployment**: Configured for **Vercel Serverless Functions** (`api/index.ts` + `vercel.json`) and local offline fallback.

---

## 🚀 Quickstart & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

### 3. Initialize & Seed Database
```bash
npm run db:migrate
npm run db:seed
```

### 4. Run Automated Security Test Suite
```bash
npm run test:security
```
*Executes 73 automated assertions covering IDOR, table zero-ID leakage, price tampering, quantity boundaries, token replay defense, and staff RBAC.*

### 5. Start Development Servers
```bash
npm run dev
```
- **Customer App**: `http://localhost:5173/entry`
- **Admin Portal**: `http://localhost:5173/admin/login`
  - Super Admin: `admin@cafe.local` / `Admin@12345`
  - Kitchen Staff: `staff@cafe.local` / `Staff@12345`

---

## 🌐 Deploy to Vercel

For complete production deployment instructions using Vercel and Turso, see [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md).

---
