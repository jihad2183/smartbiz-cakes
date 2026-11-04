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

### Migration 0013

`drizzle/migrations/0013_admin_financial_accuracy.sql`

- Adds cancellation timestamps and reasons, a protected order payment ledger, and an admin-only
  function for recording partial payments and refunds.
- Backfills existing verified paid orders into the ledger.
- Financial totals count confirmed/preparing/out-for-delivery/delivered orders; product sales are
  after discounts and exclude delivery charges. Profit is before product costs because no product
  cost ledger is currently recorded.

### Migration 0014

`drizzle/migrations/0014_delivery_map_locations.sql`

- Adds optional map coordinates and a reverse-geocoded address to orders.
- Allows saved addresses to omit legacy area/city fields.
- Adds an authenticated order-placement function that validates delivery coordinates and saves
  them only to the order belonging to the signed-in customer.
- Preserves existing order and address records.

Checkout uses OpenStreetMap tiles and Nominatim reverse geocoding; no API key is required. The map
requires an internet connection. Browser location permission is optional because customers can
choose a delivery point manually.

### Migration 0015

`drizzle/migrations/0015_customer_profile_location.sql`

- Adds optional GPS coordinates, readable location, and update time to customer profiles.
- Captures validated signup location metadata when Supabase creates a profile, preserving the
  existing referral, customer-role, and welcome-voucher signup behavior.
- Adds an authenticated, null-only profile-location RPC for OAuth signups; it cannot overwrite an
  existing saved location.
- Checkout uses a saved profile location as its initial delivery point and still allows customers
  to choose a different point for an order.

Apply this migration after 0014 before deploying the registration and checkout changes. Registration
uses browser geolocation and OpenStreetMap Nominatim; neither requires an API key. GPS permission
is optional, and customers can choose a location manually.

### Migration 0016

`drizzle/migrations/0016_payment_method_account_details.sql`

- Adds nullable account number, account type, and account holder name fields to existing payment
  method rows. It is safe to apply if any of these columns already exist.
- Restricts configured account types to Personal, Merchant, or Agent without changing payment data
  or existing row-level security policies.
- Requests a PostgREST schema-cache refresh after the migration commits.

Apply this migration in the Supabase SQL Editor before deploying code that reads or saves payment
account details. It does not create or recreate the payment methods table.
