# Motion and interaction

Use this when introducing or reviewing animation, transitions, scroll effects, gesture behaviour, and micro-interactions.

## Motion premise

World-class motion is choreographed restraint. It creates continuity, directs attention, confirms an action, or expresses one recognisable brand gesture. It does not exist to prove the site can animate.

For Suga Spies, the recommended signature is a **soft reveal with tactile finish**: content settles into place with a quiet editorial ease, while add-to-cart and status actions use a brief, precise feedback response. Avoid bouncy toy-like movement unless the final brand intentionally chooses that personality.

## Motion layers

### 1. Immediate interaction feedback

Use for hover, press, focus, selection, quantity changes, cart updates, validation, and success acknowledgement.

- Feedback begins immediately.
- Keep travel distance small.
- Preserve text and layout readability during the effect.
- Never use motion as the only confirmation.
- Do not animate disabled controls as though they accepted input.

### 2. Component transitions

Use for drawers, dialogs, accordions, menus, filters, cart previews, and state changes.

- Animate opacity plus transform where useful.
- Maintain focus correctly before, during, and after.
- Do not animate height through expensive frame-by-frame layout when a simpler reveal works.
- Background scroll locks must not cause a horizontal page jump.
- Exit motion must never postpone an urgent next action.

### 3. Page and section choreography

Use sparingly for a hero, collection introduction, product gallery, or storytelling section.

- Establish one sequence: image, headline, supporting copy/action—not every child independently.
- Reveal only once unless replay has a clear meaning.
- Content remains available without JavaScript animation.
- Do not hide essential above-the-fold content for a long entrance.
- Avoid applying the same fade-up to every section; repeated motion quickly looks generated.

### 4. Branded signature

One motif may carry through selected moments: an icing-line draw, ribbon unfold, pastry-box opening, dusting mask, or monogram crop. It must derive from the real identity and remain lightweight.

Use it in at most a few high-value locations. Do not turn it into a loader shown on every navigation.

## Timing and easing

Use these as starting ranges, then tune in the rendered interface:

| Interaction                                | Typical duration | Intent                      |
| ------------------------------------------ | ---------------: | --------------------------- |
| Press, toggle, colour, focus reinforcement |       100–180 ms | Immediate response          |
| Small component movement or menu item      |       160–240 ms | Continuity without delay    |
| Drawer, dialog, cart panel                 |       220–360 ms | Spatial relationship        |
| Hero/section editorial reveal              |       400–700 ms | Deliberate pacing           |
| Success acknowledgement                    |       300–600 ms | Noticeable but non-blocking |

Prefer a small easing vocabulary. A decelerating curve similar to `cubic-bezier(0.22, 1, 0.36, 1)` can suit entrances; exits should be slightly faster. Do not copy durations mechanically across elements with very different size or distance.

Stagger only a small number of meaningful peers. Long cascades make product grids feel slow and cause customers to chase moving targets.

## Performance rules

- Prefer CSS transitions/keyframes for simple state motion.
- Animate compositor-friendly opacity and transform when practical.
- Avoid animating layout properties such as large-scale width, height, top, left, margin, or grid geometry on every frame.
- Keep the largest contentful image stable; do not make LCP wait behind animation JavaScript.
- Reserve space for images, banners, validation, and status updates to prevent layout shift.
- Lazy-load animation libraries and media that are not needed for initial interaction.
- Do not add a motion library for effects that native CSS handles clearly.
- If a library is justified for orchestration or gestures, isolate it to the smallest client boundary and measure bundle/performance impact.
- Use short, muted, poster-backed video only when it materially improves brand storytelling. Never autoplay sound.

Web performance guidance warns against animations that trigger layout and highlights responsive dimensions as protection against layout shift: [CSS for Web Vitals](https://web.dev/articles/css-web-vitals) and [Optimize CLS](https://web.dev/articles/optimize-cls).

## Reduced motion

Respect `prefers-reduced-motion: reduce` everywhere, including third-party or library motion.

- Remove large translation, parallax, zoom, rotation, and continuous movement.
- Replace spatial entrances with immediate display or a brief opacity change when appropriate.
- Stop autoplay decorative video/animated loops or provide a static poster.
- Keep essential progress and state feedback understandable without movement.
- Do not globally remove all transition time if doing so breaks focus, state, or component logic; provide intentional alternatives.

Reference: [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).

## Scroll behaviour

- Preserve native scrolling and browser history.
- Do not hijack scroll speed, direction, or snapping for normal commerce pages.
- Gentle image parallax may be used only on larger screens, at low amplitude, outside critical interaction, and disabled for reduced motion.
- Sticky elements need a clear end boundary and cannot cover focused fields, validation, or footer content.
- Intersection-triggered reveals must not leave content invisible when observers fail or JavaScript is delayed.

## Food-specific interaction ideas

Good candidates:

- a product image crossfade when a flavour or finish selection has a truthful corresponding image;
- a restrained count-fill response while building a mixed box;
- a small cart confirmation tied spatially to the cart icon;
- gallery zoom that reveals real texture and returns focus correctly;
- a timeline state transition that explains order progress;
- a subtle line/ribbon motif that connects story sections.

Avoid:

- rotating 3D pastries when regular images would be clearer;
- crumbs, sprinkles, confetti, or particles following the cursor;
- constant floating cakes;
- wobbling buttons, elastic form fields, and bouncing prices;
- animated scarcity or false urgency;
- dramatic transitions inside checkout, cancellation, payment processing, or admin operations.

## Interaction quality checks

For each animated component, verify:

1. What user understanding improves because of this motion?
2. Does the control respond within the first frame of interaction?
3. Can keyboard and touch users trigger and dismiss it?
4. Is focus visible and never trapped or obscured?
5. Does it remain correct when clicked repeatedly or interrupted?
6. Does it work at 320px, wide desktop, 200% zoom, and with reduced motion?
7. Does it preserve stable layout and acceptable main-thread responsiveness?
8. If all animation is removed, is the state still clear?

If the first answer is unclear or the final answer is no, remove or redesign the animation.
