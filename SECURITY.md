# Security Requirements

## Table security
Internal table IDs must never be exposed to customers. Use cryptographically secure opaque tokens.

Do not use:
- `/table/1`
- `?table=1`
- sequential public table IDs
- localStorage for raw table IDs
- hidden HTML fields containing internal IDs

Store only a hash of the table token where practical and resolve it server-side.

## Authentication
- OTPs are short-lived.
- OTPs are not stored in plaintext.
- Limit attempts.
- Rate-limit requests.
- Add resend cooldown.
- Use secure, HttpOnly, SameSite cookies for sessions.

## Authorization
Every protected resource must verify ownership or role server-side.

A customer must not access another customer's:
- order
- phone number
- table session
- payment details
- order history

## Payment
Never trust client-provided totals or prices. Recalculate using trusted database values.

UPI must not be marked paid simply because the customer clicked a button. Use gateway verification/webhooks when a real gateway is integrated.

## Admin
Admin routes require server-side role checks. Passwords must be securely hashed.

## General
- HTTPS-ready.
- Environment variables for secrets.
- No credentials in frontend code.
- Validate all input.
- Use parameterized queries/ORM.
- Safe error messages.
- Logging must avoid secrets and unnecessary PII.
- Protect against CSRF where applicable.
- Prevent replay of invalidated table tokens.
