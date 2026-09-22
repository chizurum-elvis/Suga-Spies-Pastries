# Catalogue vertical slice

## What is implemented

The homepage, `/menu`, and `/menu/[slug]` now use one catalogue contract. When Supabase is not configured, the current ten-item starting menu is used as a preview dataset so the public screens remain testable. When both Supabase public values are configured, reads switch to Supabase and failures surface through the storefront error boundary instead of silently returning preview data.

The protected owner routes are:

- `/admin/menu` — overview, search, filters, categories, and product states.
- `/admin/menu/new` — create a safe unpublished draft.
- `/admin/menu/[id]` — edit details, price and quantity rules, upload images, manage variants and options, preview, publish, pause, or archive.

The product page now hands its published variants, options, and quantity rules to the completed guest-cart slice. Scheduling, capacity, fulfillment pricing, Stripe wallets, and order creation remain separate later slices.

## Security and data guarantees

- Public database roles can read published catalogue records only.
- Every write is limited by Row Level Security to the active owner in `admin_users`.
- Server Actions repeat owner authorization near each mutation.
- Published slugs are immutable.
- Prices are stored as integer Canadian cents and parsed on the server.
- Product edits use a version check to prevent one browser tab from overwriting another.
- Products and nested choices are archived rather than hard-deleted.
- Audit events are append-only to application roles.
- Menu image files are owner-only writes, limited to 5 MB, and validated by declared MIME type and file signature.
- The image endpoint rejects cross-origin requests.
- Public catalogue reads are server-rendered and tag-cached for one hour; owner writes invalidate the tag immediately.

## Before Supabase is connected

Run the public experience without any Supabase or Stripe key:

```bash
npm run dev
```

Check `/`, `/menu`, and `/menu/nine-inch-cheesecake`. `/admin` must redirect to the owner login and explain that Supabase is not configured. This fail-closed behaviour is expected.

## After Supabase is connected

1. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local`.
2. Link the Supabase CLI to the correct non-production project.
3. Apply every migration in `supabase/migrations` in timestamp order. The catalogue migrations also create the public `product-images` bucket, its owner-only write policies, and follow-up constraint and policy hardening.
4. Create the owner Auth user and matching active `admin_users` row using `docs/admin-authentication.md`.
5. Load the preview seed only in a safe development/staging database. Replace its provisional menu wording with owner-approved data before production.
6. Restart Next.js after changing public environment variables; image-host configuration is evaluated at startup/build time.
7. Sign in, open `/admin/menu`, edit a draft, upload a photo, publish it, and verify the change immediately on `/menu`.

Stripe keys are not read by the catalogue or cart slices. They will be required when the payment slice creates server-owned PaymentIntents and verifies their webhook results.

## Information still needed from the owner

For every final product, provide its category, exact customer-facing name, description, base price, whether the price is “from,” unit label, minimum/step/maximum quantities, variants, flavours, customizations and additional prices, ingredients, allergen/cross-contact wording, storage or serving instructions, and final photography with alt-text guidance.

## Verification commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Supabase policy tests live in `supabase/tests`. They require a running local Supabase stack (Docker-compatible runtime) or an approved linked test project. Never run destructive reset commands against production.
