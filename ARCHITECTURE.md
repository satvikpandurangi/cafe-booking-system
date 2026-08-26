# System Architecture

## Logical architecture

Customer Web App
→ Backend/API
→ Authentication / Authorization
→ Order Service
→ Payment Service
→ Table Service
→ Menu Service
→ Database

Admin Web App
→ Backend/API
→ Admin Authorization
→ Same domain services
→ Database

## Rules
- The browser must never perform privileged database operations directly.
- Internal table IDs stay server-side.
- Customer requests must be authorized against the authenticated user and active table session.
- Admin permissions must be checked server-side.
- Order totals are calculated server-side.
- Historical order item names and prices are snapshots.

## Suggested service boundaries
- AuthService
- TableService
- MenuService
- Cart/OrderService
- PaymentService
- AdminService
- ReportingService

## External integrations
- SMS/OTP provider
- UPI/payment gateway when configured
- Object storage/CDN for menu images if required
