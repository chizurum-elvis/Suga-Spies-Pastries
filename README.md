# Suga Spies

Suga Spies is a mobile-first pastry ordering and owner-operations application for Toronto. It uses Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase, and Stripe.

## Local development

1. Use Node.js 22 or newer.
2. Copy `.env.example` to `.env.local` and fill only the services you are actively using.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.

The application is available at [http://localhost:3000](http://localhost:3000). The public menu is at `/menu`, the persisted guest cart is at `/cart`, and the reusable component preview is at `/foundation`. The owner workspace at `/admin` is private and fails closed until Supabase authentication is configured.

The site is delivery-only. Checkout continues through `/checkout/fulfillment`, `/checkout/details`, and `/checkout/payment`; the owner manages delivery rates at `/admin/delivery` and paid orders at `/admin/orders`. See [the payment and order setup guide](docs/payment-order-vertical-slice.md) before enabling any sandbox or live payment.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run format:check
npm run test:unit
npm run test:db:payments
npm run test:db
npm run build
npm run test:e2e
```

Install the Playwright browsers once with `npx playwright install` before running browser tests locally.

## Project rules

- Application code uses the root-level `app/` directory. Do not add `src/`.
- `docs/business-owner-discovery-responses.md` is the current source of truth for business decisions.
- Read `skills/pastry-commerce-frontend/SKILL.md` before frontend work.
- Keep Server Components as the default. Add client boundaries only where interaction or browser APIs require them.
- Never expose server secrets through a `NEXT_PUBLIC_` variable or import server-only modules into Client Components.

See [docs/environments.md](docs/environments.md) for environment and secret-management rules. Follow [docs/admin-authentication.md](docs/admin-authentication.md) to activate and test the private owner account.
