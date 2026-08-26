# Payments

## UPI
Customer selects UPI and is shown the configured cafe payment flow.

The amount must come from the server-calculated order total.

When a real payment gateway is used:
- Create payment server-side.
- Verify gateway response server-side.
- Use signed webhooks where supported.
- Store transaction reference.
- Mark paid only after verification.

If gateway integration is unavailable:
- Use `PENDING` rather than pretending payment succeeded.

## Cash at counter
Customer selects cash.
Order payment state:
- Method: CASH
- Status: PENDING

Staff verifies receipt of cash and marks it PAID.

## Payment states
- PENDING
- PAID
- FAILED
- REFUNDED
- CANCELLED

Never trust a client-side `paid=true` value.
