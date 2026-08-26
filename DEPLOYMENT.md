# Production Deployment & Direct UPI Architecture Guide

This guide details the steps required to deploy, configure, secure, and operate the **Cafe Booking & Ordering System** using **Direct UPI Deep Linking** and staff-verified payment settlement.

---

## 1. Direct UPI & Cash Architecture (No Payment Gateway Required)

```
[Customer Checkout] ──► [Select "Pay via UPI" or "Pay Cash"]
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       [Direct UPI Intent / QR]        [Cash at Counter]
                │                             │
    upi://pay?pa=...&am=...                   │
    (Server Calculated Total)                 │
                │                             │
                ▼                             ▼
   [Payment Status: PENDING]      [Payment Status: PENDING]
   ("Payment submitted for        ("Pay cash at counter")
    verification")                            │
                │                             │
                └──────────────┬──────────────┘
                               │
                               ▼
     [Staff / Admin Inspects Cafe Terminal / Soundbox / Cash]
                               │
                               ▼
        [Staff Clicks "Verify UPI" or "Verify Cash"]
                               │
                               ▼
         [Order & Payment Status Transitions to: PAID]
                               │
                               ▼
             [Customer Tracker: "Payment Confirmed ✓"]
```

---

## 2. Environment Variables

### A. Required Configuration
| Variable | Production Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security mode and disables all dev bypasses |
| `PORT` | `3001` | Express application listening port |
| `DATABASE_PATH` | `./data/cafe.db` | Local persistent SQLite database path |
| `SESSION_SECRET` | `openssl rand -base64 48` | Minimum 64-character secret for signing JWT cookies |
| `ADMIN_SEED_EMAIL` | `admin@cafe.domain.com` | Initial production Super-Admin email address |
| `ADMIN_SEED_PASSWORD`| `StrongProdPass#2026!` | Initial production Super-Admin password |
| `UPI_ID` | `merchant.cafe@okaxis` | Verified merchant UPI Virtual Payment Address (VPA) |
| `CAFE_NAME` | `Artisan Coffee & Bistro` | Display name of the cafe restaurant |
| `TAX_RATE_PERCENT` | `5.0` | Standard restaurant GST percentage rate |
| `ALLOWED_ORIGINS` | `https://cafe.domain.com` | Whitelist of trusted frontend domains for CORS |

### B. Optional SMS Configuration (For OTP Delivery)
| Variable | Description |
| :--- | :--- |
| `SMS_PROVIDER` | Real SMS gateway name (`msg91`, `twilio`, or `fast2sms`) |
| `SMS_API_KEY` | API credentials for the SMS gateway |
| `SMS_SENDER_ID` | 6-character registered DLT sender header (e.g. `CAFEIN`) |
| `SMS_TEMPLATE_ID` | Registered DLT message template ID for transactional OTP |

---

## 3. Direct UPI Intent & Verification Security

1. **Authoritative URI Construction**:
   - `GET /api/payments/:publicOrderNumber/upi` generates:
     `upi://pay?pa=CAFE_UPI_ID&pn=CAFE_NAME&am=486.00&cu=INR&tr=ORDER_REFERENCE&tn=Order+ORD-XXXXXX`
   - The amount `am` is fetched directly from the database order record and cannot be altered by the client.
2. **Customer State Isolation**:
   - Opening the UPI app or returning to the cafe web application **never** marks the payment as paid.
   - The customer UI displays:
     **"Payment submitted for verification"**
     **"Your order has been placed. The cafe will confirm your payment shortly."**
   - The UI strictly avoids displaying "Payment Confirmed" or "Payment Successful" until staff verification.
3. **Staff Verification & Audit Trail**:
   - Staff confirms incoming UPI alerts on the cafe phone/soundbox or bank app.
   - Staff clicks **"Verify UPI Payment"** in the Admin Portal.
   - The database records:
     - `payments.status = 'PAID'`
     - `orders.payment_status = 'PAID'`
     - `payments.verified_by = admin.id`
     - `payments.verified_at = CURRENT_TIMESTAMP`
     - `payments.transaction_reference = Bank UTR / Reference`
   - Live order polling on the customer phone detects the transition and displays **"Payment Confirmed ✓"**.

---

## 4. Admin Management & Access Control

- **Admin Creation**: Initial admin created with `npm run db:seed`.
- **Role Matrix**:
  - `STAFF`: Live orders queue, status progression (`Accept`, `Prepare`, `Ready`, `Serve`), and **Verify UPI / Verify Cash** actions.
  - `ADMIN`: Full staff access + Table QR creation, Token regeneration/revocation, Menu management, and Sales reporting.

---

## 5. SQLite Database Procedures & Backups

The database is stored locally in `./data/cafe.db` with Write-Ahead Logging (`WAL`) mode enabled.

### Safe Hot-Backup Command
```bash
# Linux / macOS cron job
0 2 * * * sqlite3 /path/to/cafe/data/cafe.db ".backup '/path/to/cafe/data/backups/cafe_backup_$(date +\%Y\%m\%d_\%H\%M\%S).db'"

# Windows PowerShell:
powershell -Command "New-Item -ItemType Directory -Force -Path ./data/backups; Copy-Item ./data/cafe.db ./data/backups/cafe_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').db"
```

---

## 6. Launching Production Service

```bash
# 1. Install & Build
npm ci
npm run build

# 2. Seed database
npm run db:seed

# 3. Start with PM2
pm2 start dist/server/index.js --name "cafe-app"
pm2 save
pm2 startup
```
