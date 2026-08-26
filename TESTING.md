# Testing Plan

## Authentication
- Valid OTP succeeds.
- Invalid OTP fails.
- Expired OTP fails.
- Too many attempts are blocked.
- Resend cooldown works.

## Table security
- Valid QR token works.
- Invalid token fails.
- Revoked token fails.
- Regenerated token invalidates old token.
- Table enumeration fails.
- Internal table ID is absent from customer responses.

## Authorization
- Customer A cannot access Customer B's order.
- Customer cannot access admin endpoints.
- Non-admin cannot use admin operations.

## Order integrity
- Client price manipulation is ignored.
- Client total manipulation is ignored.
- Unavailable items cannot be ordered.
- Invalid quantities fail.
- Duplicate submissions do not create unintended duplicate orders.
- Historical prices remain unchanged.

## Payments
- Cash starts pending.
- Staff can verify cash.
- UPI cannot be marked paid without valid verification.
- Failed payments do not become paid.

## UI
Test mobile, tablet, and desktop layouts, including loading, empty, error, and offline/slow-network states.
