# Art direction and research

Use this for visual discovery, brand direction, typography, colour, photography, homepage composition, and design critique.

## Research set

The following official sites were reviewed on August 28, 2026 for information architecture, merchandising, content hierarchy, product education, and available visual references. Websites change; recheck them when current implementation decisions depend on them.

### Canada

- [Nadège Patisserie](https://www.nadege-patisserie.com/) — product-first French patisserie presentation; seasonal, catering, and signature collections; concise product information with serving size, ingredient/allergen summary, and storage guidance.
- [Butter Baker](https://www.butter-baker.com/) — playful seasonal merchandising, announcement messaging, gift-price categories, product discovery, and café/lifestyle crossover.
- [Daan Go Cake Lab](https://daango.com/collections) — character-led product identity, clear designer-cake and custom-product taxonomy, strong local-location and policy visibility.
- [Alo Restaurant](https://alorestaurant.com/) — quiet precision, restrained copy, cinematic food/interior imagery, minimal navigation, and premium pacing.

### United States

- [Magnolia Bakery](https://www.magnoliabakery.com/) — recognisable pastel brand system, campaign-led homepage, occasion merchandising, and clear separation of shipping, local pickup, and catering.
- [Levain Bakery](https://levainbakery.com/) — iconic product storytelling, confident colour/illustration, social proof, pack-size selection, gifting, allergen disclosure, care instructions, and highly visible order routes.
- [Dominique Ansel Bakery](https://www.dominiqueanselny.com/) — chef-led craft, flagship-item storytelling, location-specific fulfillment, and direct preorder paths.

These references show that successful food commerce is not a single visual style. Nadège uses patisserie precision, Magnolia uses nostalgic celebration, Levain uses bold neighbourhood warmth, and Alo uses fine-dining restraint. The reusable lesson is coherence between product, voice, photography, geometry, and interaction—not copying pastel colours or serif type.

## What strong pastry and restaurant sites consistently do

- Let food imagery carry appetite and atmosphere while text carries decisions.
- Lead with one recognisable product, collection, occasion, or brand promise—not a generic welcome statement.
- Use seasonal collections without hiding the evergreen menu.
- Keep an ordering action visible early and repeat it only at meaningful decision points.
- Make fulfillment modes explicit: delivery, pickup, preorder, catering, or shipping are not interchangeable.
- Use product taxonomy that matches how customers shop: product type, occasion, box, flavour, or gift intent.
- Put price, quantity/serving information, allergens, care, availability, and fulfillment constraints close to purchase.
- Use real brand voice in small details: labels, empty states, care instructions, and confirmation copy.
- Display trust through real craft, owner story, product process, accurate policies, and operational clarity—not generic badge rows.
- Adapt the composition on mobile instead of merely shrinking desktop.

## Common problems to avoid

- Promotion overload before customers can find the menu.
- Large cinematic video that delays content or makes text unreadable.
- Too many announcement bars, popups, newsletter prompts, and upsells.
- Separate third-party flows that look unrelated and erode checkout confidence.
- Product grids with inconsistent crop, missing prices, or hidden availability.
- Decorative typography used where customers must scan quantities, prices, or errors.
- PDF-only menus or critical policies.
- Autoplay carousels that move before the customer can read.
- Large desktop whitespace translated into awkward mobile gaps.
- A visually impressive homepage followed by generic product and checkout screens.

## Recommended Suga Spies art direction

Until the owner provides a complete brand system, use **Modern Celebration Patisserie** as the reversible direction.

### Brand premise

- **Warm:** personal, welcoming, made for real celebrations.
- **Sculptural:** pastries photographed as crafted objects with texture and dimension.
- **Precise:** ordering rules, dates, quantities, prices, and status remain calm and exact.

The productive tension is **joyful product / disciplined interface**. The site can feel celebratory without making checkout playful or vague.

### Visual character

- Warm off-white or softly tinted canvas rather than clinical pure white everywhere.
- One dark culinary anchor colour for text and structure.
- One confection-inspired accent sampled from packaging or hero photography.
- One restrained secondary tint for seasonal surfaces and status grouping.
- Fine rules, editorial whitespace, cropped macro photography, and occasional asymmetric composition.
- Moderate corner radius chosen once; do not turn every block into a pill or rounded card.
- One branded motif derived from a real asset—icing stroke, ribbon fold, pastry-box seam, dusting pattern, or monogram—not generic stars and blobs.

Do not select final hex values until the logo and representative product photography can be viewed together. Validate colour contrast in context, including over images and in disabled/unavailable states.

## Typography system

Use typography as brand architecture, not decoration.

### Roles

1. **Display face:** expressive serif or editorial display family for hero statements, collection names, and selected section headings.
2. **Utility face:** highly legible humanist or geometric sans for navigation, prices, product details, forms, status, admin, and body copy.
3. **Optional accent:** use lettering from the actual logo or a minimal hand-rendered motif only as artwork, never as a third general-purpose UI font.

### Selection standard

- Use no more than two working font families and only the weights actually needed.
- Ensure Canadian English characters, currency, numerals, punctuation, and relevant diacritics render correctly.
- Verify the licence and current Next.js font integration before implementation.
- Prefer variable fonts when they reduce requests without adding unused range.
- Use `next/font` or appropriately self-hosted fonts to control loading and layout stability.
- Define intentional fallbacks with compatible metrics.
- Do not use a high-contrast serif below comfortable reading size.
- Use tabular numerals only where alignment matters, such as admin tables, countdowns, and totals.

Possible exploration pairs—not final selections—include an expressive variable serif such as Fraunces or Newsreader with a restrained sans such as Manrope or Instrument Sans. Verify availability, licensing, brand fit, and rendering before choosing. Do not default to Inter merely because it is familiar.

### Type behaviour

- Use a fluid but bounded scale with `clamp()` where appropriate.
- Body copy starts at a comfortable mobile size and line height; never shrink text to preserve a desktop layout.
- Keep long-form measure roughly 45–75 characters.
- Give display text optical spacing and deliberate line breaks at art-directed breakpoints.
- Keep product names readable at two or three lines without unstable card heights.
- Use tracked uppercase only for short labels, never paragraphs or validation messages.
- Prices, quantity rules, and status labels must scan faster than descriptive copy.

## Photography direction

The website cannot look premium if the product photography is inconsistent.

### Required image families

- **Hero/editorial:** celebration context or sculptural single-product composition with negative space planned for copy.
- **Catalogue:** consistent crop, light, distance, surface, and colour treatment across products.
- **Detail:** crumb, frosting, filling, decoration, packaging, and scale.
- **Process/human:** hands, preparation, finishing, packaging, or owner presence to communicate craft.
- **Fulfillment:** packaging and handoff imagery that makes delivery/pickup feel trustworthy.

### Image rules

- Capture focal-point metadata or choose crops intentionally by breakpoint.
- Use meaningful alt text for informative product images; decorative duplicates use empty alt text.
- Show product scale through servings, dimensions, or context, not visual guesswork.
- Never use a generated image as evidence of the exact item the customer will receive.
- If temporary generated or stock images are used during design, label them and replace them before owner approval.
- Reserve dimensions and use responsive sizes so images do not create layout shift.

## Composition and hierarchy

### Storefront

- The first viewport should establish brand, product desirability, and the order path.
- Alternate dense product discovery with calmer editorial storytelling.
- Use asymmetry on desktop where it supports the focal image; preserve clear linear reading order on mobile.
- Let some photography escape a conventional card grid, but keep product-card data aligned.
- Use section spacing as rhythm: campaign, collection, proof/craft, fulfillment, support.

### Transactional areas

- Reduce decorative layers in cart, fulfillment selection, checkout, tracking, and cancellation.
- Keep totals, deadlines, errors, and the next action in stable positions.
- Use status colour only as reinforcement; pair it with iconography and text.
- Avoid background imagery behind forms and policy acknowledgements.

### Admin

- Use the same type and colour tokens but a denser operational scale.
- Prefer clear grouping, strong table/list hierarchy, sticky filters/actions where helpful, and restrained motion.
- Never force the owner to decode decorative status treatments.

## Art-direction review

Before approving a new page, ask:

1. Could this page belong to an unrelated SaaS, salon, florist, or template bakery after swapping the logo?
2. Is there one clear visual idea, or only a pile of fashionable effects?
3. Does the product remain the most appetising visual element?
4. Can a customer identify the item, price, quantity rule, availability, and next action quickly?
5. Does the mobile composition feel intentionally designed?
6. Are the type, crop, colour, and motion choices consistent with the chosen brand premise?
7. Is every trust claim real and every photograph representative?
8. Does removing animation leave a complete, elegant page?

If the answer to the first question is yes or any of the others is no, revise the art direction before adding more polish.
