# Frontend quality gates

Use this for every implementation, refactor, review, or release decision. Scale the number of tests to the change, but do not omit a relevant category merely because the page looks correct locally.

## 1. Pre-implementation gate

- Read the current business rules and feature acceptance criteria.
- Read relevant documentation from the installed Next.js version before writing code.
- Identify server/client boundaries, data ownership, and security-sensitive values.
- Record the UI state matrix, responsive priority, and accessibility path.
- Confirm whether real brand assets/content exist; label temporary assumptions.
- Check existing tokens/components before creating new variants.

## 2. Code-quality gate

At minimum, run the project's available commands:

- `npm run lint`
- `npm run typecheck`
- `npm run format:check`
- `npm run build`

Add and run feature-specific unit, component, and browser tests once their test tooling is installed. Do not invent a passing test claim when a tool or environment is unavailable.

Review for:

- no `any` or unsafe casts used to bypass UI state modelling without justification;
- no duplicated business constants in components;
- no browser-trusted prices, delivery fees, capacity, or eligibility;
- no service secrets in client code or `NEXT_PUBLIC_` variables;
- stable keys and deterministic server/client output;
- no hydration warnings, uncaught errors, or noisy console logs;
- no unnecessary top-level Client Components;
- no dead controls, placeholder links, or non-functional visual affordances;
- loading and errors contained at sensible route/component boundaries;
- usable behaviour when JavaScript, an image, or a third-party request is delayed.

## 3. Functional test gate

Use unit/component tests for local behaviour and Playwright for customer-visible journeys.

### Component and rule coverage

- quantity minimum, step, maximum, and mixed-box count;
- live price changes and server-rejection rendering;
- option selection and required customization;
- date/window disabled reasons and Toronto-time formatting;
- cart edits, unavailable items, and stale-price review;
- field validation and focus/error association;
- status/timeline rendering;
- cancellation deadline and confirmation UI;
- wallet availability, processing, failure, expiry, and recovery presentation.

### End-to-end coverage

- browse → product configuration → cart;
- guest delivery checkout through test wallet confirmation;
- no-wallet compatibility path;
- last-capacity conflict without cart loss;
- payment succeeds after browser navigation/close recovery;
- secure guest tracking and lost-link recovery;
- eligible and ineligible cancellation;
- owner order discovery and valid status update;
- owner product availability/content change reflected safely in storefront.

Prefer role, label, and user-visible locators. Do not make tests depend on fragile DOM nesting or styling selectors. See [Playwright locators](https://playwright.dev/docs/locators) and [best practices](https://playwright.dev/docs/best-practices).

## 4. Accessibility gate

Target WCAG 2.2 AA for core customer and admin journeys.

### Automated

- Run axe checks on representative page states, not only initial empty pages.
- Scan open menus/dialogs, validation errors, filled cart, checkout, tracking, and admin detail.
- Fail new unexplained serious/critical issues; do not hide broad containers from scanning.

Playwright documents integration with `@axe-core/playwright` but notes that automation cannot find every accessibility problem: [Accessibility testing](https://playwright.dev/docs/accessibility-testing).

### Manual keyboard

- Skip link reaches main content.
- Focus order matches visual/reading order.
- All menu, gallery, selector, calendar, cart, checkout, dialog, tracking, and admin actions work without a pointer.
- No keyboard trap.
- Focus is visible and not hidden behind sticky UI.
- Opening and closing overlays moves/restores focus correctly.
- Destructive confirmation and errors move focus predictably.

### Manual assistive-technology semantics

- One meaningful page `h1`; heading order represents structure.
- Landmarks and accessible names are meaningful.
- Images have appropriate informative or empty alt text.
- Price, quantity, availability, status, and errors have understandable reading order.
- Live announcements are concise and not triggered excessively.
- Forms expose label, description, required state, error, and valid autocomplete purpose.
- Custom widgets expose correct role, state, and keyboard behaviour—or are replaced with native controls.

### Visual accessibility

- Text and non-text controls meet applicable contrast.
- Information does not rely on colour alone.
- Content works at 200% zoom and with increased text spacing.
- Touch/pointer targets are comfortably sized and separated.
- Reduced motion removes non-essential spatial/continuous motion.
- No flashing content or uncontrolled autoplay.

Primary standard: [WCAG 2.2](https://www.w3.org/TR/WCAG22/). WCAG 2.2 adds criteria including focus not obscured, dragging alternatives, target size minimum, redundant entry, and accessible authentication: [What's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

## 5. Responsive visual gate

Every materially changed route must be visually inspected, not only rendered in one automated viewport.

### Representative widths

- 320px narrow mobile;
- 360px common Android-sized mobile;
- 390px modern iPhone-sized mobile;
- 768px portrait tablet;
- 1024px tablet/small laptop;
- 1280px standard desktop;
- 1440px large desktop;
- at least one wide desktop to catch excessive measure/stretching.

Also test short-height mobile/desktop viewports, landscape mobile where relevant, and 200% zoom.

### Visual assertions

- no horizontal page overflow;
- no clipped text, controls, menus, dialogs, or wallet buttons;
- stable header, sticky CTA, sticky summary, and safe-area behaviour;
- intended line breaks and readable text measure;
- consistent image crops and focal points;
- no stretched, blurry, or layout-shifting product images;
- touch and hover states both make sense;
- totals, errors, dates, and primary actions stay visible and ordered;
- admin tables transform into a usable narrow-screen pattern;
- empty, loading, unavailable, error, success, and long-content states remain composed.

Add Playwright screenshot comparisons for stable, high-value views and components. Baselines must be generated and compared in a consistent environment, and diffs must be reviewed rather than blindly updated. See [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots).

Suggested baseline states:

- homepage mobile and desktop;
- menu with unavailable item;
- product with validation and long customization content;
- cart with multiple configured lines;
- delivery calendar including disabled/full dates;
- checkout review with delivery fee, total, and wallet area;
- tracking at each main fulfillment mode;
- admin dashboard and order detail.

## 6. Performance gate

Use real-device/field data after launch and lab tools before launch. Target the Core Web Vitals “good” thresholds at the 75th percentile:

- LCP at or below 2.5 seconds;
- INP at or below 200 milliseconds;
- CLS at or below 0.1.

References: [Web Vitals](https://web.dev/articles/vitals), [LCP](https://web.dev/articles/lcp), and [Optimize CLS](https://web.dev/articles/optimize-cls).

### Required checks

- The hero/LCP asset is intentional, correctly sized, and not delayed by unnecessary client code.
- All imagery uses correct responsive sizing, dimensions/aspect ratio, modern formats where appropriate, and lazy loading below the fold.
- Fonts load through the current recommended Next.js path, use only necessary weights/subsets, and do not cause visible reflow.
- Public pages ship minimal client JavaScript; animation and admin dependencies do not leak into the storefront bundle.
- Third-party scripts are delayed or isolated unless required for the immediate task.
- Skeletons, banners, product grids, wallet area, and errors reserve appropriate layout space.
- Interactions remain responsive during filters, quantity changes, cart updates, and checkout.
- No large continuous main-thread animation.
- Production build output and route behaviour are reviewed for unexpected client growth.

Use Lighthouse as a lab regression signal, not proof of field performance. Investigate material regressions instead of chasing a score by hiding content or disabling needed functionality.

## 7. Content and commerce-integrity gate

- Product names, images, prices, serving information, quantity rules, ingredients, allergens, availability, and customization match owner-approved data.
- CAD formatting and Toronto-time wording are consistent.
- No fake ratings, reviews, customer counts, awards, or urgency.
- No unavailable product can appear purchasable.
- No stale browser total is presented as authoritative.
- Delivery language matches the delivery-only service and never reveals the owner's home address.
- The exact cancellation cutoff and refund expectation are visible before payment.
- Wallet brand buttons comply with current Stripe/Apple/Google guidance and appear only when available.
- Success copy is shown only after authoritative payment/order state.

## 8. Payment and device gate

Before production, test wallet UI on real supported devices and browsers, plus unsupported environments.

- Apple Pay on an eligible Apple device/browser and an unconfigured/unsupported state.
- Google Pay on eligible Android/desktop environments and an unconfigured/unsupported state.
- Wallet button layout at narrow width, zoom, dark/light surrounding surfaces, and translated/system-rendered labels where applicable.
- 15-minute hold warning, expiration, retry, and navigation recovery.
- duplicate tap, refresh, back navigation, slow provider response, and closed-browser recovery.
- provider failure without false order confirmation.

Stripe's Express Checkout Element states that methods are shown only when active, supported, and set up, and exposes availability changes for detecting when no wallet is available: [Express Checkout Element](https://docs.stripe.com/elements/express-checkout-element).

## 9. Final design review

Complete a slow visual pass after automation:

1. View the page first as a customer, without inspecting code.
2. Identify the first focal point, first action, and any competing element.
3. Read every customer-visible word and verify it is specific and truthful.
4. Inspect spacing rhythm, alignment, crop, type hierarchy, and component consistency.
5. Exercise the page with realistic long names, long options, large prices, and errors.
6. Compare mobile and desktop; neither may feel like the other's afterthought.
7. Use keyboard and reduced motion.
8. Check console/network failures and refresh deep links.
9. Confirm the page still feels like Suga Spies when decorative imagery is removed.

Do not approve a route solely because lint, build, or snapshots pass. Those prove important invariants, not taste, hierarchy, or usability.

## Release evidence

When handing off a completed frontend slice, report:

- routes/components changed;
- states implemented;
- viewports and interaction modes inspected;
- automated checks run and results;
- accessibility and reduced-motion checks;
- visual regression coverage;
- performance impact or measurement;
- assumptions and remaining owner decisions;
- any unavailable test environment, especially real wallet/device testing.
