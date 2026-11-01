# SmartBiz Cakes

**SmartBiz Cakes** is a complete online cake shop and business management system. It allows customers to browse cakes, create accounts, place orders, and manage their purchases. Administrators can manage products, customers, orders, payments, inventory, expenses, and business operations through a secure admin portal.

## Features

### 1. Admin Panel and Permissions
- Secure administrator login.
- Full control over website content and features.
- Only authorized administrators can grant administrator access.
- New administrator accounts require approval from an existing administrator.
- Manage products, customers, orders, payments, and business operations.

### 2. Website Management
- Add, edit, update, and delete cake products.
- Upload and manage cake images.
- Manage website content and customer-facing information.
- Manage delivery charges and payment instructions.
- Control available website features through the admin portal.

### 3. Customer Accounts and Ordering
- Customer registration and login.
- Browse available cakes and view product details and prices.
- Add cakes to the shopping cart.
- Place online orders.
- View order history and order status.
- Manage customer profile information and addresses.

### 4. Cake Search
- Search cakes by name or keyword.
- Quickly find available products.
- Browse the cake catalog.

### 5. Checkout and Payments
- Separate cart and checkout pages.
- Delivery and pickup options.
- Customer delivery information and phone validation.
- Voucher selection and validation.
- bKash, Nagad, Rocket, and upay payment-reference support.
- Manual administrator payment verification.
- Partial payment and payment balance tracking.

### 6. Business Management
- Order management and status tracking.
- Inventory management.
- Expense management.
- Financial dashboard.
- Sales, profit, discount, delivery charge, and payment summaries.
- Customer referral and invitation links.

---

## Technology Stack

- Frontend: React, TypeScript
- Styling: CSS / Tailwind CSS
- Backend and Database: Supabase
- Database Management: Drizzle ORM
- Authentication: Supabase Authentication
- Testing: Vitest
- Package Manager: npm

## Database Setup

This project uses Supabase for authentication, database storage, and application services.

### First Administrator Setup

New signups receive only the customer role.

To create the first administrator, a trusted Supabase project owner must:

1. Open Supabase Dashboard.
2. Navigate to Authentication → Users.
3. Verify the intended account.
4. Copy the account's user UUID.
5. Open SQL Editor and execute:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<verified-auth-user-uuid>'::uuid, 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Replace the placeholder with the verified user's UUID.

Never expose a service-role key or grant administrator permissions through browser code or user-editable metadata.

Subsequent administrator accounts must be approved by an existing administrator through the protected admin portal.

---

## Database Migrations

Apply database migrations in the correct order to the existing Supabase database.

**Important:** Do not reset or replace production data. Review each migration before applying it. Do not apply an already-applied migration again unnecessarily.

### Migration 0006
`drizzle/migrations/0006_integer_order_quantities.sql`

- Adds server-side whole-number quantity and pound validation.
- Updates `place_order` to reject fractional quantities.
- Historical-row checks are added as `NOT VALID` and apply to new writes.
- Does not modify or delete existing order data.

### Migration 0007
`drizzle/migrations/0007_inventory_pounds.sql`

- Converts ingredient quantities recorded in kilograms to pounds.
- Changes the default inventory unit to pounds.

### Migration 0008
`drizzle/migrations/0008_checkout_vouchers_payments.sql`

- Adds persistent customer carts.
- Adds delivery and pickup order details.
- Adds voucher eligibility and redemption.
- Adds configurable welcome vouchers.
- Adds payment methods.
- New customer accounts receive a unique welcome code while welcome vouchers are enabled.

### Migration 0009
`drizzle/migrations/0009_percentage_vouchers_and_customer_pages.sql`

- Enforces percentage-only voucher discounts.
- Allows customers to view expired, inactive, and redeemed voucher history.
- Disables existing fixed-amount vouchers during the conversion.
- Disables a fixed-amount welcome voucher setting until an administrator configures a percentage-based voucher.

### Migration 0010
`drizzle/migrations/0010_customer_addresses_support_and_checkout_safety.sql`

- Adds private customer address records.
- Adds customer support-request records.
- Adds private profile-photo storage.
- Adds checkout request idempotency.
- Adds an initially disabled upay option.

### Migration 0011
`drizzle/migrations/0011_cake_photo_bucket.sql`

- Ensures the cake-photo storage bucket exists for administrator uploads.
- Creates the bucket only if it is missing.
- Leaves existing bucket configuration unchanged.

### Migration 0012
`drizzle/migrations/0012_customer_referrals_and_checkout_phone.sql`

- Adds owner-scoped referral relationship tracking.
- Records referral attribution at signup.
- Enforces valid phone numbers