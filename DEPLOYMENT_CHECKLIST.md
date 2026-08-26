# Deployment & Verification Checklist (Direct UPI Architecture)

This document provides the complete testing protocol for launching the Cafe Booking & Ordering System with **Direct UPI Deep Linking** and **Cash-at-Counter** staff verification.

---

## 1. Physical Device & Customer Flow Verification

| Step | Action | Expected Result | Checked |
| :--- | :--- | :--- | :---: |
| **1. QR Scan** | Scan physical table standee QR with standard camera/scanner | Opens customer landing page: `https://cafe.domain.com/entry?token=...` | [ ] |
| **2. Table Verification** | Page auto-verifies opaque token | Displays "Table verified successfully" without exposing internal table code or table ID | [ ] |
| **3. Mobile Number Entry** | Enter 10-digit customer phone (e.g. `9876543210`) | Triggers SMS request; 60-second cooldown timer begins | [ ] |
| **4. OTP Verification** | Enter 6-digit SMS OTP code | Logs in instantly; sets `customer_token` HttpOnly session cookie | [ ] |
| **5. Menu Catalog** | Browse categories, use search, toggle Vegetarian & Spicy filters | Filtered dishes render with prices, descriptions, and high-res imagery | [ ] |
| **6. Dish Selection** | Tap dish to open detail modal, adjust quantity, add to order | Item added to Cart; floating cart bar updates quantity and subtotal | [ ] |
| **7. Cart Review** | Open slide-over Cart drawer | Shows items, quantities, 5% GST tax breakdown, and special cooking instructions box | [ ] |
| **8. Payment Selection** | Select either **UPI Digital** or **Cash at Counter** | Payment toggle updates; total remains server-authoritative | [ ] |
| **9. Order Placement** | Click "Place Order" | Order created transactionally; public order number (e.g. `ORD-938210`) generated | [ ] |
| **10. Direct UPI Intent** | On order tracker, tap "Pay ₹X via UPI" | Opens UPI app with exact server amount (`am=...`), payee VPA (`pa=...`), and order ref (`tr=...`) | [ ] |
| **11. Pending Verification**| Return from UPI app to cafe website | Displays **"Payment submitted for verification. The cafe will confirm your payment shortly."** (Payment status remains `PENDING`) | [ ] |
| **12. Live Confirmation**| Staff clicks "Verify UPI Payment" on admin portal | Customer tracker updates in real-time to **"Payment Confirmed ✓"** | [ ] |

---

## 2. Admin & Kitchen Operations Verification

| Step | Action | Expected Result | Checked |
| :--- | :--- | :--- | :---: |
| **1. Staff Login** | Navigate to `/admin/login` and enter staff/admin credentials | Sets secure `admin_token` HttpOnly cookie and redirects to `/admin` | [ ] |
| **2. Operations Dashboard** | Inspect KPI dashboard cards | Shows Today's Orders, Gross Revenue (₹), Active Kitchen Orders, and Pending Payments | [ ] |
| **3. Live Kitchen Board** | Open `/admin/orders` on kitchen tablet | Displays real-time orders with internal table code (e.g. `T-01`) and items | [ ] |
| **4. Audio Notification** | Place a new customer test order | Browser plays chime sound and adds order card to "Pending" queue | [ ] |
| **5. Kitchen Workflow** | Click "Accept Order" ➔ "Start Preparing" ➔ "Mark Ready" ➔ "Mark Served" | State transitions update immediately on kitchen board and customer phone | [ ] |
| **6. Verify UPI Payment** | Staff confirms bank credit/soundbox and clicks "Verify UPI Payment" | Order and payment status update to `PAID`; records staff verifier ID and timestamp | [ ] |
| **7. Verify Cash** | Customer pays cash at counter; staff clicks "Verify Cash Payment" | Order and payment status update to `PAID` in real-time | [ ] |
| **8. Order Completion** | Click "Complete Order" | Order closes; table status returns to `AVAILABLE` automatically | [ ] |
| **9. Table Management** | Open `/admin/tables`; view occupancy states and regenerate a table token | Regenerates new QR standee; immediately revokes old QR and active sessions | [ ] |
| **10. Menu Management** | Open `/admin/menu`; toggle dish "Out of Stock" or update price | Customer menu updates immediately; historical orders retain snapshot prices | [ ] |

---

## 3. Production Security & Edge Cases Verification

| Test Scenario | Verification Method | Pass Criteria | Checked |
| :--- | :--- | :--- | :---: |
| **Table Enumeration** | Attempt to open `/entry?token=1` or `/entry?token=T-01` | Returns `403 Forbidden`; no internal table details disclosed | [ ] |
| **Cross-Customer IDOR** | Customer A pastes Customer B's order link (`/orders/ORD-XXXXXX`) | Returns `404 Not Found`; Customer B data is not accessible | [ ] |
| **Price Tampering** | Post modified `client_price: 1.00` via DevTools/API | Server computes price from database; tampered value ignored | [ ] |
| **Quantity Tampering** | Post `quantity: 0`, `-5`, or `100` | Server rejects request with `400 Bad Request` | [ ] |
| **Customer UPI Spoofing**| Customer tries to call `POST /api/admin/payments/:id/verify-upi` | Server rejects with `403 Forbidden` (only staff/admin allowed) | [ ] |
| **Customer Cash Spoofing**| Customer tries to call `POST /api/admin/payments/:id/verify-cash` | Server rejects with `403 Forbidden` (only staff/admin allowed) | [ ] |
| **Token Replay Defense** | Try scanning old QR token after admin clicks "Regenerate Token" | Server returns `403 Forbidden`; requires re-scanning new standee | [ ] |
| **OTP Brute-Force** | Submit 5 wrong OTP attempts for a phone number | Record deleted; phone number locked out from further attempts | [ ] |
