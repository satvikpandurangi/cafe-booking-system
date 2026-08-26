# Order Management

## Order lifecycle
Pending → Accepted → Preparing → Ready → Served → Completed

Cancellation may occur from appropriate states.

## Creation
Server must:
1. Authenticate customer.
2. Validate table session.
3. Retrieve current menu data.
4. Validate availability and quantity.
5. Calculate subtotal.
6. Calculate taxes/charges.
7. Calculate final total.
8. Create immutable item snapshots.
9. Generate a random public order number.
10. Commit in a transaction.

## Customer
Can view only their own orders and current order status.

## Admin
Can view authorized order data and update order status.

## Duplicate protection
Design order creation to avoid accidental duplicate submissions, for example with idempotency keys.
