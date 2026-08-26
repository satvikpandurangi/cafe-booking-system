# Table & QR Management

## Internal table record
Each physical table has:
- Internal database ID.
- Internal table code.
- Secure token hash.
- Status.

## Customer entry
The QR code contains only an opaque table entry token or secure entry URL.

The customer sees:
**Table verified successfully.**

The customer never sees the internal table code.

## Token lifecycle
- Generate using a cryptographically secure random generator.
- Store a hash when possible.
- Validate server-side.
- Support revocation.
- Regeneration invalidates the previous token.
- Do not use sequential IDs as tokens.

## Admin table states
- Available
- Occupied
- Order Pending
- Payment Pending
- Cleaning
- Inactive

## QR
Admin can generate and regenerate a QR code for each table. QR content must not contain plain table numbers, customer information, or order information.
