# Database Design

## Users
- id
- phone
- created_at
- updated_at

## Admin Users
- id
- email
- password_hash
- role
- created_at
- updated_at

## Tables
- id
- internal_table_code
- secure_token_hash
- status
- created_at
- updated_at

## Menu Categories
- id
- name
- created_at
- updated_at

## Menu Items
- id
- category_id
- name
- description
- price
- image_url
- available
- created_at
- updated_at

## Orders
- id
- public_order_number
- user_id
- table_id
- subtotal
- tax
- total
- payment_method
- payment_status
- order_status
- created_at
- updated_at

## Order Items
- id
- order_id
- menu_item_id
- item_name_snapshot
- unit_price_snapshot
- quantity
- total

## Payments
- id
- order_id
- method
- amount
- status
- transaction_reference
- created_at
- updated_at

## Integrity
- Foreign keys must be enforced.
- Monetary values should use an exact decimal representation.
- Public identifiers must not be database primary keys.
- Order creation must be transactional.
- Historical snapshots must never be overwritten when menu prices change.
