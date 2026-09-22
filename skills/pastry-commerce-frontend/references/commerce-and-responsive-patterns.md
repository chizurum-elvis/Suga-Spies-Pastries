# Commerce and responsive patterns

Use this for route composition, responsive behaviour, components, forms, product selection, checkout, tracking, and admin UI.

## Responsive operating model

Design from content priority, not named devices.

- Support 320 CSS pixels and upward without horizontal page scrolling.
- Use content-driven layout changes; Tailwind breakpoints are tools, not a design strategy.
- Test representative widths around 320, 360, 390, 768, 1024, 1280, 1440, and a wide desktop.
- Account for notches and browser bars when placing sticky mobile actions.
- Never depend on `100vh` without considering dynamic mobile viewport units and content fallback.
- Allow browser text zoom and 200% page zoom without clipping core tasks.
- Keep touch targets generous even when the formal accessibility minimum could be smaller; aim around 44 CSS pixels for primary interactive controls.
- Do not hide essential information on mobile to preserve visual minimalism.
- Avoid separate mobile and desktop business logic. Change composition, not truth.

## Global shell

### Announcement bar

- Use for one current operational or seasonal message.
- Keep it short, dismissible only when dismissal is useful, and accessible.
- Never stack several rotating promotions above navigation.

### Header

- Keep logo, Menu, Order/Cart, and account/tracking routes obvious.
- Use a compact sticky state only if it improves ordering; do not let it obscure focused elements.
- Mobile navigation needs an explicit labelled button, focus management, escape/close behaviour, and scroll containment.
- Cart count changes need a text/screen-reader announcement, not only a bouncing badge.

### Footer

- Include service areas, delivery summary, hours, support contact, policies, social link, and copyright/business identity.
- Keep transactional and marketing consent separate.
- Do not bury the only support route in the footer.

## Homepage

Recommended hierarchy:

1. A campaign or signature-product hero with one primary order action.
2. Immediately show the photo-led menu: two columns on mobile, with concise product names and prices.
3. Do not add a redundant favourites collection or operational strip before the menu.
4. Filtering or search only where it helps customers find pastries.
5. Craft/owner story with process imagery.
6. How ordering and fulfillment work.
7. Delivery service summary.
8. Real social proof or press only when supplied and verifiable.
9. FAQ/support and final order action.

Do not force every section into equal cards. Use a few deliberate layout systems and meaningful shifts in rhythm.

## Menu and collection browsing

- Expose categories as clear text controls, optionally sticky after the user reaches the menu.
- Preserve filter state in the URL when sharing or back-navigation benefits from it.
- Product cards show image, name, price/from-price, minimum/pack information, and availability before interaction.
- Use a visible “Unavailable” treatment while preserving product recognition; archived products disappear from new ordering.
- Keep crop ratio consistent within a collection. Use art-directed exceptions only for intentional feature modules.
- Avoid hover-only quick actions. Touch and keyboard users need equivalent access.
- Use skeletons only when they match final geometry; otherwise use a calm labelled loading state.
- Empty and failed results explain what happened and provide a useful route forward.

## Product detail and configuration

### Mobile composition

1. Product gallery or hero image.
2. Name, price, short description, availability.
3. Minimum quantity and serving information.
4. Required options and quantity.
5. Customization and notes.
6. Add-to-cart action and live total.
7. Ingredients, allergens/cross-contact, care/storage, and fulfillment notes.
8. Related items after the primary decision.

Use a sticky mobile purchase action only when it does not cover validation, wallet UI, browser controls, or content. Include the current price/quantity context so the sticky button is not ambiguous.

### Desktop composition

- Use a media column plus a purchase/configuration column when the content supports it.
- Sticky configuration may stop before related content and footer; never trap focus or create nested scrolling.
- Keep selectors close to the resulting price and availability.
- Galleries need keyboard-accessible controls and stable aspect ratio; clicking a thumbnail must not move the entire page.

### Option controls

- Use radio groups for one-of-many choices, checkboxes for independent add-ons, and clear quantity controls with an editable numeric path when appropriate.
- Show price deltas before selection.
- Explain minimum four as “Choose at least 4 pieces for this box,” not as a mysterious disabled button.
- For mixed flavours, display selected count versus required count and keep flavour quantity controls together.
- Do not clear valid selections after unrelated validation errors.
- Custom notes never replace structured required options.
- Place allergy/cross-contact language near relevant choices and again in product information when needed.

## Cart

- A full cart page is the reliable source of truth; a drawer can be a fast preview but must not become the only usable cart.
- Each line shows image, name, options, customization summary, quantity, unit/line price, edit, and remove.
- Keep subtotal and the next action visible without hiding changed-price or unavailable-item messages.
- State that fulfillment and the final delivery fee are confirmed during checkout when not yet known.
- Persist the cart across ordinary refresh/navigation while safely revalidating products and prices.
- Undo for line removal is useful when technically safe; do not fake undo after the server state is irreversible.
- Cross-sells come after cart clarity and should never obstruct checkout.

## Fulfillment selection

### Delivery only

- Do not show a mode selector, pickup flow, or location-approval queue.
- Ask only for required contact, address and recipient details.
- Validate addresses and driving-distance eligibility on the server using Google Maps Platform.
- Keep the routing origin private. Changes to cart, address, schedule or rates invalidate affected quotes.
- An address quote is not a capacity hold or paid order.

### Calendar and time selection

- Use real buttons/cells with accessible names, selected state, disabled state, and keyboard navigation.
- Disabled dates need an discoverable reason outside colour alone. If tooltips are used, they cannot be the only explanation.
- Clearly distinguish closed, insufficient notice, beyond booking range, blocked, and fully booked.
- Show dates in Toronto business time and use unambiguous month/day wording.
- Preserve the selected date/window on review, confirmation, tracking, and admin.
- On a capacity race, return the customer to this step with their cart preserved and a clear alternative—not a generic checkout error.

## Checkout

Checkout becomes visually quieter than the storefront.

### Structure

- Use a clear step model only if it reduces cognitive load; do not split a short form into unnecessary pages.
- Mobile uses one linear column with final total and primary action easy to find.
- Desktop uses form/content plus a non-sticky summary. The owner explicitly requested normal document scrolling for checkout summaries.
- Preserve entered values after recoverable validation and payment errors.
- Use visible labels, appropriate autocomplete tokens, input modes, and field-level errors connected programmatically to fields.
- Add an error summary for multi-field failures and move focus appropriately after submission.
- Never validate only on blur or only after payment begins.

### Review requirements

Before wallet payment, show:

- item names, selected options, quantities, and line amounts;
- delivery date and time;
- customer-confirmed delivery address;
- subtotal, distance delivery fee, free-delivery result, and final CAD total;
- exact cancellation/refund cutoff;
- linked policies and recorded acknowledgement.

If any authoritative value changes, explain the change and require review before payment.

### Wallet-only payment

- Mount provider-rendered Apple Pay and Google Pay buttons according to current provider/brand guidance.
- Do not recreate, distort, animate, recolour, or decorate wallet logos/buttons outside allowed APIs.
- Detect which wallet buttons are actually available.
- If neither wallet is available, show a clear compatibility message and a safe back/support route; do not leave a blank payment area.
- Show the 15-minute hold with calm, accurate wording. Countdown changes need an accessible announcement strategy that avoids reading every second.
- Distinguish “authorizing,” “processing,” “paid/confirmed,” “failed,” and “hold expired.”
- Never call a redirect success page proof of payment.

## Confirmation and tracking

### Confirmation

- Lead with confirmed outcome, readable order number, fulfillment date/time, and next expectation.
- Keep payment truth explicit.
- Provide secure tracking access, support contact, and relevant delivery instructions.
- Do not fill the confirmation page with new promotions before the customer sees critical details.

### Tracking

- Show payment, order, and fulfillment status as separate but visually coordinated information.
- Use a vertical timeline on narrow screens and a layout that retains chronological reading order on wider screens.
- Current state needs text, icon, and contrast—not colour alone.
- Show Toronto-time timestamps and explain the next expected action.
- Present cancellation only when eligible, with the exact deadline and consequences.
- Refund status remains visible here even though separate refund emails are not sent.
- Internal notes, payment-provider payloads, audit information, and private addresses never appear.

## Authentication and account

- Guest checkout remains the primary path; never gate ordering behind sign-up.
- Offer account creation/sign-in as convenience, not pressure.
- Passwordless states need explicit “check your email,” resend timing, changed-email recovery, expired-link, and rate-limit messages.
- Preserve cart and intended destination through authentication.
- Account order history prioritizes active/upcoming orders, then past orders.
- Claiming historical guest orders requires verified email ownership and must not expose whether another email has orders.

## Cancellation and failed delivery

- Show the exact cancellation cutoff before the final confirmation action.
- Eligible cancellation needs an explicit final review of order, amount, capacity release, and refund expectation.
- The successful cancellation screen distinguishes cancelled from refund completed.
- Ineligible cancellation explains the 24-hour rule and provides support contact without exposing an active destructive button.
- Failed delivery shows redelivery-fee requirements. Do not offer collection; the final unclaimed-order/discard policy must be confirmed before that later slice.

## Admin interface

The admin is part of the product, not a generic dashboard theme.

### Dashboard

- Prioritize action required, today's/upcoming fulfillment, capacity, wallet-payment exceptions, and failed notifications.
- Use counts as navigation into filtered lists, not decorative metrics.
- Keep business date/time context visible.

### Orders and production

- Desktop supports dense, scannable tables or split views with sticky headers where useful.
- Mobile switches each row to a structured summary rather than squeezing a desktop table.
- Filters remain visible, removable, and reflected in results/URL where appropriate.
- Order detail groups customer, fulfillment, items/customizations, totals, payment/refund, timeline, and internal history.
- Valid status actions use clear verbs and confirmation proportional to impact.
- Production views total quantities by product/flavour/window and exclude cancelled/expired orders.

### Content and menu management

- Use previewable forms with draft/published distinction.
- Image upload shows crop/preview, progress, recoverable errors, replacement, alt text, and size/type requirements.
- Editing current prices never visually implies that historical orders will change.
- High-impact availability, blackout, capacity, or policy changes show affected records before confirmation.

## Required state matrix

For every interactive surface, explicitly cover as applicable:

- initial/idle;
- loading or optimistic pending;
- loaded with data;
- empty;
- unavailable or disabled with reason;
- field validation failure;
- server/business-rule rejection;
- offline/network interruption;
- dependency timeout;
- retrying;
- partial success;
- success;
- expired/stale;
- unauthorized/forbidden;
- destructive confirmation and completion.

Do not declare the frontend complete while only the happy path has a designed state.
