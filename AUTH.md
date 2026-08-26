# Authentication & Authorization

## Customer flow
1. Customer scans a table QR.
2. Backend validates the opaque token.
3. Backend establishes an active table session.
4. Customer enters mobile number.
5. OTP is sent.
6. Customer submits OTP.
7. Backend verifies OTP.
8. Secure customer session is created.
9. Customer can order only for the active authorized table session.

## Admin flow
1. Admin opens admin login.
2. Credentials are verified server-side.
3. Password is checked against a secure hash.
4. Secure admin session is created.
5. Role is checked on every privileged request.

## Session requirements
- HttpOnly.
- Secure in production.
- SameSite appropriate to deployment.
- Expiration.
- Server-side invalidation.
- No sensitive authorization state solely in localStorage.

## OTP development mode
A clearly labeled development/mock OTP may be supported. It must be disabled or guarded in production.
