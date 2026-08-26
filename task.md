# Task — Build Secure Cafe Booking & Ordering System

## Objective
Build the complete cafe table booking and food ordering application described in this repository.

## Required implementation
- [x] Set up frontend, backend/API, database, environment configuration, and project structure.
- [x] Implement customer mobile-number + OTP authentication.
- [x] Implement secure, opaque table tokens and server-side table sessions.
- [x] Implement table QR generation without exposing internal table IDs.
- [x] Implement menu categories and menu items.
- [x] Implement customer menu browsing, search, filtering, dish details, and availability.
- [x] Implement cart with server-side price validation.
- [x] Implement secure order creation using database transactions.
- [x] Implement public random order numbers.
- [x] Implement checkout with UPI and cash-at-counter payment states.
- [x] Implement customer order confirmation and live order tracking.
- [x] Implement customer order history/profile.
- [x] Implement separate admin authentication and authorization.
- [x] Implement admin dashboard and live order management.
- [x] Implement table management and QR/token regeneration.
- [x] Implement menu/category management.
- [x] Implement payment management.
- [x] Implement reports.
- [x] Add validation, rate limiting, secure sessions/cookies, authorization checks, and safe error handling.
- [x] Add seed/demo data.
- [x] Add automated tests for critical security and business flows.
- [x] Verify responsive customer and admin interfaces.
- [x] Run security tests for IDOR, table enumeration, price manipulation, token replay, and unauthorized admin access.

## Definition of done
The application is fully functional and production-ready. Customer and admin flows work end-to-end, sensitive operations are executed server-side, historical order prices remain immutable, and customers cannot discover internal table IDs or access other customers' records.
