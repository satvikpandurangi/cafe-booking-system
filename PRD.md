# Product Requirements Document

## Product
Cafe Booking & Ordering System

## Problem
Cafe customers need a simple way to order food from their table without exposing internal table identifiers or other customers' information. Staff need a centralized interface for orders, payments, tables, customers, and reporting.

## Users
### Customer
Can authenticate, browse the menu, create a dine-in order, choose UPI/cash, and track the order.

### Admin / Staff
Can manage tables, QR codes, menu, orders, payments, customers, and reports.

## Functional requirements
1. Secure table entry through QR.
2. Mobile number + OTP authentication.
3. Secure table association.
4. Menu and cart.
5. Checkout.
6. UPI/cash payment states.
7. Order status lifecycle.
8. Customer order history.
9. Admin dashboard.
10. Table management.
11. Menu management.
12. Payment management.
13. Reports.

## Non-functional requirements
- Mobile-first customer UX.
- Responsive admin UX.
- Server-side authorization.
- Secure sessions.
- Rate limiting.
- Input validation.
- Transactional order creation.
- No secrets in client code.
- No sensitive database fields in customer responses.
- Production-ready error handling.

## Success criteria
A customer can complete an order from QR scan through order tracking, while staff can receive, process, and close the order without manual database intervention.
