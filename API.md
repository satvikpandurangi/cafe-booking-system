# API Specification

All sensitive operations are authenticated and authorized server-side.

## Customer auth
- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Table
- `POST /api/table/session`
- `GET /api/table/session`
- `POST /api/admin/tables`
- `PATCH /api/admin/tables/:id`
- `POST /api/admin/tables/:id/regenerate-token`
- `GET /api/admin/tables/:id/qr`

Customer table endpoints must never return internal table IDs.

## Menu
- `GET /api/menu`
- `GET /api/menu/categories`
- `GET /api/menu/:id`
- Admin CRUD endpoints under `/api/admin/menu`.

## Orders
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:publicOrderNumber`
- Admin order endpoints under `/api/admin/orders`.

Order lookup must verify customer ownership.

## Payments
- `POST /api/orders/:id/payment`
- `POST /api/payments/webhook` for gateway integrations
- Admin payment update endpoint for verified cash-at-counter payments.

## API rules
- Validate request schemas.
- Never trust client totals.
- Never expose database primary keys unnecessarily.
- Return safe errors.
- Apply authorization before resource access.
