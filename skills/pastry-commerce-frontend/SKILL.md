---
name: pastry-commerce-frontend
description: Design, implement, or review the Suga Spies pastry-commerce frontend. Use for customer storefronts, menu and product experiences, cart and checkout, order tracking, content pages, responsive admin UI, visual polish, motion, accessibility, performance, or frontend quality assurance. Do not use for backend-only, database-only, or infrastructure-only work.
---

# Pastry Commerce Frontend

Create a distinctive, food-first commerce experience that feels crafted for a premium pastry business and remains fast, accessible, trustworthy, and easy to order from on a phone.

## Required project context

Read [references/project-context.md](references/project-context.md) for every Suga Spies task. Treat `docs/business-owner-discovery-responses.md`—especially **Current authoritative decisions**—as the source of truth when it conflicts with the older PRD.

This project uses a root-level Next.js App Router structure. Never introduce a `src/` directory. Before writing Next.js code, read the relevant current guides in `node_modules/next/dist/docs/` as required by the repository `AGENTS.md`.

## Route to the right guidance

- For visual direction, typography, colour, photography, visual hierarchy, or inspiration research, read [references/art-direction-and-research.md](references/art-direction-and-research.md).
- For customer flows, page composition, forms, product UI, cart, checkout, tracking, admin UI, or responsive behaviour, read [references/commerce-and-responsive-patterns.md](references/commerce-and-responsive-patterns.md).
- For transitions, scroll behaviour, feedback animation, loading motion, or animation review, read [references/motion-and-interaction.md](references/motion-and-interaction.md).
- For implementation, refactoring, review, or release readiness, read [references/quality-gates.md](references/quality-gates.md).

Read only the references needed for the task, except that implementation and review work always requires the quality gates.

## Working standard

### Start from product truth

Before choosing components, identify:

- the user's immediate goal;
- the business rule that can block it;
- the primary action;
- the information required to make that action safe;
- loading, empty, unavailable, validation, success, retry, and expired states;
- mobile constraints and the keyboard/screen-reader path.

Design the real feature with realistic pastry names, prices, quantities, dates, allergens, and fulfillment copy. Do not judge visual quality using lorem ipsum, repeated placeholder cards, or unrelated stock content.

### Establish art direction before decoration

For a new surface, state the brand premise in three adjectives, the intended emotional tone, the typography roles, colour roles, image treatment, geometry, one recurring brand motif, and one motion signature. When brand assets are missing, propose two or three genuinely distinct directions or choose the strongest reversible direction and state the assumption.

The default recommendation for Suga Spies is a **modern celebration patisserie**: warm, editorial, tactile, and joyful without becoming childish, excessively pink, or wedding-template generic. This is a starting point, not a substitute for the owner's logo, photography, packaging, or preferences.

### Keep commerce legible

Food photography may be expressive; transactional UI must be calm. Product name, price, minimum quantity, availability, selected options, fulfillment date, delivery fee, and final total must never compete with decorative effects.

Use semantic HTML and native controls before custom widgets. Preserve browser and assistive-technology behaviour. Never make ordering depend on hover, drag, animation completion, colour alone, or a precise pointer.

### Build mobile-first, not mobile-only

Compose the customer flow from the smallest supported viewport upward. Expand into editorial asymmetry, richer whitespace, and supporting imagery on wider screens without changing the task hierarchy. Design the admin for efficient desktop/tablet operation while keeping urgent actions usable on mobile.

### Use motion with restraint

Motion should explain hierarchy, continuity, or feedback. Prefer opacity and transform, provide a reduced-motion equivalent, avoid layout-triggering animation, and never delay a customer from adding to cart, correcting a form, or paying. A polished static layout is better than purposeless animation.

### Protect the rendering boundary

Keep Server Components as the default. Add Client Components only around genuine interaction or browser APIs. Do not make an entire page client-rendered to animate a small section. Defer non-critical code and third-party scripts, and preserve stable image/font dimensions to prevent layout shift.

### Separate customer and operational personality

The storefront may be expressive and editorial. Checkout, tracking, account, and admin surfaces become progressively quieter and denser. Do not carry decorative storefront treatments into high-stakes forms or operational tables when they reduce speed or clarity.

## Anti-generic rules

Do not ship:

- a generic SaaS hero, purple gradient, glass dashboard, or component-library demo aesthetic;
- arbitrary blobs, sparkles, emoji icons, gradients, shadows, radii, or illustrations without a brand role;
- the same white rounded card repeated for every section;
- cursive or high-contrast display fonts for body copy, prices, form labels, or status text;
- text placed over busy pastry photography without deliberate art direction and reliable contrast;
- autoplay carousels, scroll hijacking, custom cursors, constant floating objects, or animation on every section;
- tiny grey text, invisible focus rings, mystery icons, hover-only details, or horizontally clipped mobile layouts;
- fake reviews, invented awards, invented scarcity, misleading countdowns, or unavailable wallet buttons;
- copied layouts, fonts, illustrations, photographs, motion sequences, or brand devices from reference businesses.

Derive the visual system from Suga Spies' own name, products, packaging, photography, and service model. References are for principles and calibration, never cloning.

## Vertical-slice workflow

For each frontend slice:

1. Read the relevant product rules and current Next.js documentation.
2. Map the customer journey, admin counterpart, state matrix, and responsive priority.
3. Define or reuse tokens and components; avoid one-off styling that weakens the system.
4. Implement the smallest coherent end-to-end experience with real validation and truthful data states.
5. Verify keyboard, screen-reader semantics, reduced motion, zoom, responsive layouts, loading/error states, and slow-network behaviour.
6. Run the required static, functional, accessibility, visual, and production-build gates.
7. Inspect the rendered result at mobile and desktop sizes. Passing code checks is not visual approval.

## Definition of frontend done

A surface is done only when:

- it has a deliberate Suga Spies art direction rather than framework defaults;
- the primary task is obvious within a few seconds;
- every relevant state is designed and implemented;
- it works from 320 CSS pixels upward without horizontal overflow;
- keyboard, focus, labels, errors, zoom, contrast, and reduced motion are verified;
- food images are sharp, responsive, correctly cropped, and dimensionally stable;
- interaction and visual regression tests cover the critical states;
- lint, type checks, tests, and a production build pass;
- no console, hydration, broken-link, or obvious layout errors remain;
- performance stays within the targets in the quality reference;
- the result has been visually reviewed, not only inferred from source code.

When a requirement conflicts with usability, accessibility, wallet-brand rules, or payment truthfulness, preserve correctness and raise the design tradeoff explicitly.
