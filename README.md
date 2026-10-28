# Smart Cake Shop

@project:00d3b57d-60a3-41d9-97f7-5258983d9526:"Smartcakeshop" 
1. Admin Panel and Permissions: The Admin Panel must have full control over the entire website. Nobody should be able to become an admin without permission from the existing administrator. Any new admin must be approved by the current admin.

2. Full Website Management: The admin must be able to edit, add, update, and delete all website content, manage products, view customer information, manage orders, and control all website features.

3. Customer Login and Ordering: Customers must be able to register and log in to the website, browse all available cakes, view cake details and prices, and place orders online.

4. Cake Search Option: Add a cake search feature that allows customers to search for cakes by name or keyword and quickly find the cakes they want.

This project was built with [Lovable](https://lovable.dev).

## Database rollout and first administrator

The database migration in `drizzle/migrations/0006_integer_order_quantities.sql` adds server-side whole-number quantity and pound checks and updates `place_order` to reject fractional quantities. Apply this migration to the existing Supabase project before deploying the matching application code. It does not modify or delete existing order data; the historical-row checks are added as `NOT VALID` and apply to new writes.

New signups receive only the customer role. To bootstrap the first administrator, a trusted Supabase project owner must verify the intended account in **Authentication → Users**, copy that account's user UUID, and run the following in the Supabase SQL Editor:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<verified-auth-user-uuid>'::uuid, 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Replace the placeholder with the UUID of the verified account. Do not expose a service-role key or grant admin access from browser code or user-editable metadata. Subsequent administrator access should be granted by an existing administrator through the protected portal.

**Live app**: https://smart-cake-shop.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7a6929ed-a34a-469e-95ce-2d008616d9bb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
