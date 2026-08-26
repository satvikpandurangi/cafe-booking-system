# Security Test Cases

## Table enumeration
Attempt:
- sequential IDs
- modified QR tokens
- guessed tokens
- old tokens

Expected: access denied.

## IDOR
Change public order identifiers in customer requests.

Expected: only the authenticated customer's own order is accessible.

## Price manipulation
Modify browser request item price/total.

Expected: server recalculates and rejects manipulated values.

## Admin bypass
Open admin APIs without an admin session.

Expected: unauthorized.

## Token replay
Reuse a revoked table token.

Expected: rejected.

## Sensitive data leakage
Inspect customer API responses and browser storage.

Expected: no internal table IDs, secrets, hashes, admin data, or other customers' data.
