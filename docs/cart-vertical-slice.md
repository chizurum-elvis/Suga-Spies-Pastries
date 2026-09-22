# Customer product-selection and cart vertical slice

## What is implemented

- Published product pages support database-defined variants, single-choice options, multiple-choice options, allocated-quantity options, price additions, and product/variant quantity rules.
- The current launch rule is represented by catalogue data: the regular cheesecake starts at one; the other current products start at four; the step after the minimum is one.
- Add to cart and the navigation cart button open the full, keyboard-accessible right-hand drawer. Customers edit their pastries and choose a delivery date without leaving the product page. On mobile the drawer fills the viewport. `/cart` remains a direct-access compatibility view, not part of the normal journey.
- Guests can increase, decrease, type, repair, and remove quantities, clear the cart, continue browsing, and refresh without losing valid selections.
- Only schema-versioned product, variant, option, and quantity identifiers are stored in local storage. Prices, product copy, customer data, addresses, and payment data are never persisted there.
- Storage events synchronize normal changes from another browser tab. The Web Locks API serializes writes where the browser supports it, and every mutation rereads the latest persisted cart before writing.
- Corrupt, unsupported, oversized, or old cart payloads fail safely to an empty supported cart instead of crashing the storefront.

## Authoritative validation

`POST /api/cart/validate` accepts strict JSON identifiers and quantities. It rejects unknown fields, including any browser-supplied price. The route limits payload size, disables caching, rereads the current published Supabase catalogue, and calculates Canadian-dollar totals with integer cents.

Before a new line is written to local storage, the complete proposed cart is checked against fresh server data. A newly unavailable, draft, archived, missing, invalid, or foreign product choice is therefore not added. After a valid line has been added, later catalogue changes remain visible as blocked cart issues so the customer can remove or repair the selection.

Validation covers:

- published product existence and current availability;
- required, owned, published, and available variants;
- minimum, step, and maximum quantities;
- option ownership, publication, availability, required counts, and selection limits;
- current base, variant, and option prices;
- safe integer arithmetic and a current CAD subtotal.

Price changes are never silently accepted. The cart displays the new server total, identifies the changed line, requires acknowledgement, and will block the future checkout step until that review is complete. Unavailable or invalid lines make the subtotal unavailable and block progression.

## Explicit boundary

The drawer has two steps: Your pastries and Delivery date. Saving an available date opens `/checkout`, where contact details, address validation, delivery pricing, and payment remain together. Choosing a date does not reserve capacity or start payment; existing server-side scheduling checks and payment-time holds remain authoritative. Cart and date editing are disabled during an active payment, and its summary uses the payment snapshot.

Date availability and saved-draft failures have retry states. The date endpoint returns only the draft summary and initial calendar month with private, no-store caching. Prices and quantities continue to use the existing server validator. No new database migration or environment key is needed for the drawer.

Free-form decoration wording is not collected yet. Structured owner-approved choices work now, but production custom-message fields require the owner-approved eligible products, character limits, allowed content, price rules, and approval flow before implementation.

No database migration or new environment variable was required for this slice. It uses the existing public catalogue RLS policies and Supabase public configuration.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
```

The test suite covers corrupt storage, duplicate configurations, repeated additions, cross-tab adoption, quantity boundaries and invalid steps, foreign and archived options, unavailable and missing products, price changes, safe CAD arithmetic, browser-price injection, persistence across reloads, removal, accessibility, reduced motion, security headers, 320 px overflow, and desktop/mobile visual baselines.

### Manual sidebar check

1. Open a product and add a valid quantity. Confirm the drawer opens without navigating.
2. Change quantity, remove an item, and reopen the cart from navigation. Check the item count and `quantity × unit price`.
3. Choose Delivery date, pick an available day, and go back to Your pastries. The selected day should remain when returning to the calendar.
4. Continue to checkout. Contact information and payment should share the checkout page; Edit cart and Change date reopen the drawer.
5. Repeat on a narrow mobile viewport and with only the keyboard. Escape closes the drawer and returns focus to its opener.
