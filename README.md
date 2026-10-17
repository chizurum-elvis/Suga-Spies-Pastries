# Suga Spies

Suga Spies is a mobile-first pastry ordering and owner-operations application for Toronto. It uses Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase, and Stripe.

## Local development

1. Use Node.js 22 or newer.
2. Copy `.env.example` to `.env.local` and fill only the services you are actively using.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.

The application is available at [http://localhost:3000](http://localhost:3000). The public menu is at `/menu`; the cart and delivery-date selection open in a right-side drawer. `/cart` remains a direct-access fallback, and the reusable component preview is at `/foundation`. The owner workspace at `/admin` is private and requires an approved active owner account.

The site is delivery-only. Customers choose a date in the drawer, then enter contact/address information and pay on `/checkout`. Older checkout URLs remain compatibility routes, not additional required steps. The owner has Overview, Orders, Kitchen plan, Menu, Delivery calendar, Website content, and Settings. Delivery pricing is in Settings; `/admin/delivery` remains a compatible direct link. See [the payment and order setup guide](docs/payment-order-vertical-slice.md) before enabling payments, webhooks, or a reconciliation schedule.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run format:check
npm run test:unit
npm run test:release
npm run check:release
npm run test:db:payments
npm run test:db
npm run build
npm run test:e2e
```

Install the Playwright browsers once with `npx playwright install` before running browser tests locally.

## Owner handover and release

- [Plain-language owner guide](docs/owner-admin-guide.md)
- [Owner acceptance checklist](docs/admin-workspace-completion.md)
- [Business email and password-recovery setup](docs/production-email-setup.md)
- [Failure handling, release checks, scheduling, and recovery](docs/admin-operations-and-release.md)

GitHub runs credential-free release checks. Connected database/checkout tests,
approved owner acceptance, real card/wallet testing, and visual review remain
separate release gates. A deployed admin is not proof that live ordering is ready.

## Project rules

- Application code uses the root-level `app/` directory. Do not add `src/`.
- `docs/business-owner-discovery-responses.md` is the current source of truth for business decisions.
- Read `skills/pastry-commerce-frontend/SKILL.md` before frontend work.
- Keep Server Components as the default. Add client boundaries only where interaction or browser APIs require them.
- Never expose server secrets through a `NEXT_PUBLIC_` variable or import server-only modules into Client Components.

See [docs/environments.md](docs/environments.md) for environment and secret-management rules. Follow [docs/admin-authentication.md](docs/admin-authentication.md) to activate and test the private owner account.
