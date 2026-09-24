# Business Owner Discovery Responses

## Document purpose

This document is the persistent project memory for the business owner's answers. It records the original questions, her responses, the current interpretation, and anything that must be clarified before implementation.

- Source: Business owner responses supplied by the project owner.
- Recorded: August 28, 2026.
- Latest owner update: September 17, 2026.
- Status: Implementation in progress. Pickup has been withdrawn; the site is delivery-only.
- The Product Requirements Document has not been changed.
- The **Current authoritative decisions** section near the end of this document supersedes conflicting earlier answers and conflicting rules in the current PRD.
- The monetary delivery-fee formula is a temporary working rule and will be replaced when the owner provides updated pricing.
- Before implementing a related feature, read this document together with the PRD and resolve any item marked **Still required**.

---

## First discovery round — historical record

This section preserves the original questions and answers. Some statuses and interpretations below were later superseded. Do not implement from this section without checking **Current authoritative decisions** near the end of the document.

### 1. Business location

**Question:** Which city and province in Canada is the business located in?

**Sister's response:** Toronto, Ontario.

**Current understanding:** The business operates in Toronto, Ontario, Canada.

**Status:** Confirmed.

### 2. Business timezone

**Question:** What timezone does the business use?

**Sister's response:** Eastern Daylight Time (EDT).

**Current understanding:** Use the Toronto timezone, `America/Toronto`. This automatically changes between EST and EDT when daylight-saving time changes. Do not permanently store the business as fixed EDT.

**Status:** Confirmed through location.

### 3. Delivery time options

**Question:** What delivery time options should customers choose from?

**Sister's response:** All.

**Current understanding:** She wants morning, afternoon, and evening availability, subject to closed days and blocked evening periods.

**Status:** Needs clarification. Exact morning, afternoon, and evening start/end times are still required.

### 4. Evening start time

**Question:** What time should “evening” begin on Tuesdays and Saturdays?

**Sister's response:** Evenings should begin at 4:00 p.m.

**Current understanding:** Evening begins at 4:00 p.m. Toronto time. Tuesday and Saturday fulfillment at or after 4:00 p.m. is unavailable.

**Status:** Confirmed.

### 5. How far ahead customers can order

**Question:** How far in advance should customers be allowed to place an order?

**Sister's response:** 1–2 days.

**Current understanding:** This answer may refer to minimum preparation notice rather than how many months into the future customers may book.

**Status:** Needs clarification. It conflicts with the original four-day minimum notice rule and does not answer whether a customer can book an event several weeks or months ahead.

### 6. Pickup

**Question:** Will customers be able to pick up their orders, or will the website offer delivery only?

**Sister's response:** They will be able to pick up as well.

**Current understanding:** MVP must support both delivery and pickup.

**Status:** Confirmed. Pickup address, pickup hours, instructions, and missed-pickup policy are still needed.

### 7. Delivery area

**Question:** Which cities, neighbourhoods, or postal codes will the business deliver to?

**Sister's response:** The Greater Toronto Area (GTA).

**Current understanding:** Delivery is limited to the GTA.

**Status:** Partially confirmed. The exact cities or postal-code zones must be listed before address validation is built.

### 8. Delivery fee

**Question:** How much should delivery cost? Will delivery become free above a certain order amount?

**Sister's response:** Delivery fee will depend on location.

**Current understanding:** Delivery pricing will be zone-based or distance-based, not one flat fee.

**Status:** Needs clarification. Define the locations/zones, price for each, and whether free delivery will exist.

### 9. Minimum-four rule and mixed flavours

**Question:** Does the minimum of four apply to each product, each flavour, or the whole box? Can two chocolate and two vanilla satisfy the minimum?

**Sister's response:** The whole box. Yes, they can.

**Current understanding:** The minimum is four total pieces in the box. Customers may mix flavours within the box, such as two chocolate and two vanilla.

**Status:** Confirmed, subject to the final menu defining which products/flavours may be mixed together.

### 10. Quantities above four

**Question:** After ordering the minimum of four, can customers order any additional amount, or only multiples of four?

**Sister's response:** After four, they can order any amount.

**Current understanding:** Valid quantities are 4, 5, 6, 7, and so on. The quantity step is one after the minimum.

**Status:** Confirmed.

### 11. Item exempt from the minimum

**Question:** Which item does not require a minimum of four?

**Sister's response:** The cheesecake does not need a minimum of four. Mini cheesecakes require a minimum of four.

**Current understanding:** A regular cheesecake may be ordered as one item. Mini cheesecakes require at least four, after which any additional whole-number quantity is allowed.

**Status:** Confirmed, subject to final menu names and variants.

### 12. Large orders

**Question:** When should an order be considered too large for normal online checkout?

**Sister's response:** 50 pieces is the minimum.

**Current understanding:** She may mean that orders of 50 pieces or more are considered large and require manual discussion/approval.

**Status:** Needs clarification. Confirm whether the rule is “50 or more requires a quote” or something else. The word “minimum” is ambiguous here.

### 13. Capacity across ordering channels

**Question:** Should website, phone, Instagram, and manually entered orders all count toward the four-orders-per-day limit?

**Sister's response:** Yes.

**Current understanding:** Every confirmed order, regardless of where it was received, consumes the same daily capacity. Pickup and delivery should also share this capacity unless she later says otherwise.

**Status:** Confirmed.

### 14. Capacity override

**Question:** Should the owner be allowed to accept more than four orders for a day?

**Sister's response:** No going past the limit.

**Current understanding:** Four confirmed orders is a hard daily maximum. Admin cannot override it.

**Status:** Confirmed.

### 15. Customizations

**Question:** Can customers request custom messages, sizes, toppings, flavours, or allergy-related changes?

**Sister's response:** Yes, they can.

**Current understanding:** Products may support owner-approved customization choices and customer notes.

**Status:** Partially confirmed. The menu must define allowed choices, extra prices, character limits, and which requests require manual approval. Allergy requests must not be treated as a guarantee of an allergen-free product.

### 16. Apple Pay/card checkout reservation

**Question:** If someone starts paying with Apple Pay/card but does not finish, how long should the date remain reserved?

**Sister's response:** Fifteen minutes.

**Current understanding:** Apple Pay/card checkout holds one capacity place for 15 minutes. Failed, cancelled, or expired attempts release it.

**Status:** Confirmed.

### 17. E-transfer reservation

**Question:** If someone chooses e-transfer but has not paid, how long should the date remain reserved?

**Sister's response:** At the end of the day, if they have not paid, remove their spot.

**Current understanding:** The proposed deadline is the end of the same Toronto calendar day.

**Status:** Needs clarification. A customer choosing e-transfer near midnight could receive only a few minutes. Confirm whether she means the same day, the next day, or a fixed number of hours.

### 18. Incorrect, late, or duplicate e-transfer

**Question:** What should happen if an e-transfer is late, has the wrong amount, is sent twice, or does not contain the order number?

**Sister's response:** “Hdhhd.”

**Current understanding:** No usable answer was provided.

**Status:** Unanswered. This policy must be defined before e-transfer checkout is implemented.

### 19. E-transfer bank confirmation

**Question:** Which bank account will receive e-transfers, and does the bank offer automatic online payment confirmation?

**Sister's response:** The bank offers instant confirmation.

**Current understanding:** The bank may instantly notify the account holder that money arrived.

**Status:** Needs verification. We still need the bank/business-payment product name and confirmation that it provides an API or webhook to the website. A bank-app notification is not automatically a website integration.

### 20. Ordinary card fallback

**Question:** Should customers be able to pay with a regular debit or credit card when Apple Pay is unavailable?

**Sister's response:** Yes.

**Current understanding:** Checkout should offer regular supported card payment in addition to Apple Pay and e-transfer.

**Status:** Confirmed.

### 21. Refund cutoff answer

**Question:** Which costs are refundable, and how long should refunds take?

**Sister's response:** It should not be refunded if they cancel the evening, beginning at 4:00 p.m., before the delivery date.

**Current understanding:** She is describing a cancellation/refund cutoff rather than which fees are refundable or refund processing time.

**Status:** Needs clarification. This also conflicts with the original 72-hour rule and the later less-than-24-hours answer.

### 22. Automatic or owner-approved cancellation

**Question:** When a customer cancels an eligible order, should it be cancelled immediately or should the owner approve it?

**Sister's response:** “What does eligible order mean?”

**Explanation:** An eligible order is an order the customer is still allowed to cancel under the final cancellation rule. For example, if the rule is “more than 24 hours before delivery,” an order with two days remaining is eligible, but one with only five hours remaining is not.

**Status:** Unanswered. She still needs to choose immediate self-service cancellation or an owner-approved cancellation request.

### 23. Failed delivery

**Question:** What happens when nobody receives the delivery, the address is wrong, or another attempt is needed?

**Sister's response:** If nobody receives the delivery, the customer has two days to pick it up. They can call and provide the correct address.

**Current understanding:** After an unsuccessful delivery, the order is held for customer pickup for two days. Customer may call with a corrected address.

**Status:** Partially confirmed. Clarify whether redelivery is offered, whether it costs extra, when the two-day period begins/ends, storage conditions, and what happens after two days.

### 24. Attaching guest orders to a later account

**Question:** If a guest creates an account later, should they be able to add previous orders after confirming their email?

**Sister's response:** Yes.

**Current understanding:** After email ownership is verified, historical guest orders using that email may be linked to the customer's account.

**Status:** Confirmed.

### 25. Data retention

**Question:** How long should the website keep guest links, accounts, addresses, delivery notes, and order records?

**Sister's response:** It should not keep them after three weeks.

**Current understanding:** The owner prefers short retention of customer-facing access and sensitive delivery information.

**Status:** Needs compliance adjustment. Guest links and unnecessary delivery notes may expire after three weeks, but legally required order, payment, refund, tax, and audit records may need to remain for years. Separate retention periods are required.

### 26. Admin-editable website information

**Question:** What information should the owner be able to edit?

**Sister's response:** All of it, including menu prices.

**Current understanding:** Owner can manage structured homepage content, contact information, FAQ, policies, menu items, availability, options, and prices.

**Status:** Confirmed. Paid historical orders must keep their original price snapshots.

### 27. Order emails

**Question:** Which order updates should send email, and should Payment received and Order confirmed be one or two emails?

**Sister's response:** Order confirmed, because an order cannot be placed without payment.

**Current understanding:** Payment received and Order confirmed should be combined into one confirmation email.

**Status:** Partially confirmed. Clarify whether customers should also receive Preparing, Ready, Out for delivery, Delivered, Cancelled, and Refunded emails, as requested in the original business description.

### 28. Admin users

**Question:** Will anyone besides the owner use the admin dashboard at launch?

**Sister's response:** No one else.

**Current understanding:** There is one owner/admin account at launch. No staff-role system is required for the MVP beyond keeping future expansion possible.

**Status:** Confirmed.

### 29. Final cancellation/refund rule answer

**Question:** What should the final cancellation and refund policy say?

**Sister's response:** If orders are cancelled less than 24 hours before the order date and time, a refund will not be issued.

**Current understanding:** Her latest stated rule is that cancellations less than 24 hours before the fulfillment date/window are non-refundable.

**Status:** Needs final decision. This conflicts with the original rule requiring cancellation more than 72 hours before fulfillment and with the 4:00 p.m.-the-evening-before response.

### 30. Customer support and alerts

**Question:** Which support email/phone should customers see, and who receives alerts?

**Sister's response:** Customers should contact her phone number for support. She should receive alerts.

**Current understanding:** Publish the approved business-support phone number and send operational alerts to the owner.

**Status:** Partially confirmed. Actual phone number and alert email/phone destination are still required and should be stored securely/appropriately when supplied.

---

## Second clarification round

These are the business owner's newest answers. They supersede conflicting earlier answers. The original clarification prompts are restated in simple language so each answer remains understandable later.

### 1. Minimum preparation notice example

**Clarification:** If a customer completes and pays for an order on Monday, what is the earliest fulfillment day they may choose?

**Sister's response:** Wednesday.

**Historical understanding:** This answer was initially implemented as a two-calendar-day lead time.

**Latest project-owner correction — September 16, 2026:** Restore the original four-calendar-day minimum. For example, September 16 produces a minimum date of September 20; ordinary closure rules still apply, so a closed Sunday is not made selectable.

**Current authoritative result:** Require four Toronto calendar days of notice.

### 2. Maximum future booking range

**Clarification:** How far into the future may a customer choose a date?

**Sister's response:** Two months ahead.

**Current understanding:** The booking horizon is two calendar months ahead in Toronto time.

### 3. Earliest fulfillment time

**Clarification:** What is the earliest fulfillment time?

**Sister's response:** 6:00 a.m.

**Current understanding:** Fulfillment may begin at 6:00 a.m., subject to the selected day and delivery/pickup rules.

### 4. Evening boundary

**Clarification:** What time does evening begin?

**Sister's response:** 4:00 p.m.

**Current understanding:** Evening begins at 4:00 p.m. Toronto time.

### 5. Tuesday and Saturday cutoff

**Clarification:** What is the Tuesday/Saturday evening restriction?

**Sister's response:** They cannot place orders past 4:00 p.m.

**Current understanding:** The final clarification confirms that Tuesday and Saturday orders must be scheduled strictly before 4:00 p.m. A 4:00 p.m. time and every later time are unavailable.

### 6. Delivery cities

**Clarification:** Which exact areas receive delivery?

**Sister's response:** Toronto, Markham, and Mississauga.

**Current understanding:** Delivery is limited to valid addresses in Toronto, Markham, and Mississauga.

### 7. Delivery-fee calculation

**Clarification:** How should the delivery fee be calculated?

**Sister's response:** Based on the distance from the business.

**Current understanding:** Delivery pricing is calculated from the private origin postal code `M1W 2Y3`. The temporary working fee is CAD $5.00 for the first three kilometres and CAD $1.50 per additional kilometre. The owner has explicitly said this monetary formula will change later, so it must not be hard-coded. Addresses more than 30 kilometres away are unavailable. The origin remains private and is never displayed to customers.

### 8. Free delivery

**Clarification:** When should delivery be free?

**Sister's response:** If the customer spends $100.

**Current understanding:** Delivery is free when the products and paid customizations total at least CAD $100 before tax and before the delivery fee. The 30-kilometre service limit still applies.

### 9. Pickup location

**Clarification:** Where will customers collect pickup orders?

**Sister's response:** Any public space of their choice. She does not want to publish her home address.

**Current understanding:** Never publish the owner's home address. A customer requests a public meeting location, and the owner must approve it before the customer can pay for the pickup order.

### 10. Pickup availability

**Clarification:** Which days and hours is pickup available?

**Sister's response:** Mondays, Tuesdays, Thursdays, Fridays, and Saturdays from 9:00 a.m. to 7:00 p.m.

**Current understanding:** Pickup is available on those days and hours in Toronto time. Pickup is unavailable on Wednesdays and Sundays.

### 11. Large orders

**Clarification:** Must an order of 50 pieces or more request a quote, or can the customer complete checkout normally?

**Sister's response:** They can pay for it normally.

**Current understanding:** Orders of 50 pieces or more are allowed through ordinary online checkout and still consume one of the four daily order spaces. No manual-quote threshold is currently required.

### 12. Products that support customization

**Clarification:** Which products can customers customize?

**Sister's response:** All.

**Current understanding:** Every product may support an approved customization request, subject to the options configured for that product.

### 13. Paid customizations

**Clarification:** Which customizations should cost extra?

**Sister's response:** Decorations for cakes, cookies, and cupcakes, and non-plain cheesecakes.

**Current understanding:** Those customizations may add to the product price. Exact choices and prices will come from the final menu/configuration.

### 14–18. Historical e-transfer decisions

The owner answered that an e-transfer reservation would last until the end of the same day, a near-end-of-day customer could have until 5:00 a.m., exception outcomes would vary by case, the receiving bank would be RBC, and confirmation would be a banking-app notification rather than a website API.

**Latest payment decision:** E-transfer has now been removed completely. These answers are retained only as decision history and must not be implemented.

### 19. Cancellation and refund cutoff

**Clarification:** Which cancellation rule is final: 72 hours or 24 hours?

**Sister's response:** The 24-hour rule.

**Current understanding:** A customer may cancel for a refund only when at least 24 hours remain before the fulfillment date and time. A cancellation with less than 24 hours remaining receives no refund. Exact behaviour at precisely 24 hours should be treated as eligible unless the owner says otherwise.

### 20. Eligible cancellation behaviour

**Clarification:** Should an eligible cancellation happen immediately or wait for owner approval?

**Sister's response:** It should cancel immediately.

**Current understanding:** An eligible customer cancellation is immediate, releases capacity once, starts the applicable wallet refund, and notifies the owner.

### 21. Refundable amounts

**Clarification:** Which parts of an eligible cancelled order should be refunded?

**Sister's response:** Everything.

**Current understanding:** An eligible cancellation refunds the full amount paid, including products, tax, and delivery charges.

### 22. Wallet refund timing

**Clarification:** How long should an Apple Pay/card refund take?

**Sister's response:** Three days.

**Current understanding:** The business wants the refund initiated immediately and expects it within approximately three days. The website must not guarantee a bank-arrival time that the payment provider or customer's bank does not guarantee.

### 23. Historical e-transfer refund timing

**Sister's response:** Three days.

**Latest payment decision:** Obsolete because e-transfer has been removed.

### 24. Redelivery

**Clarification:** Can the customer request another delivery attempt after a failed delivery, and who pays?

**Sister's response:** Yes; the customer pays another delivery fee.

**Current understanding:** Redelivery is allowed only after collecting a new distance-based delivery fee.

### 25. Failed-delivery pickup deadline

**Clarification:** When does the two-day pickup period begin?

**Sister's response:** Immediately after the failed delivery.

**Current understanding:** The two-calendar-day pickup period begins at the recorded failed-delivery time.

### 26. Uncollected order

**Clarification:** What happens if the customer does not collect the order within the two-day period?

**Sister's response:** It will be discarded.

**Current understanding:** After the deadline, the order is marked uncollected/discarded and is no longer available for pickup. The customer should be warned clearly before checkout and after failed delivery.

### 27. Customer-information retention

**Clarification:** Should customer information be removed after three weeks?

**Sister's response:** Actually, leave the customer information.

**Current understanding:** The earlier three-week deletion preference is withdrawn. The final retention schedule must still follow Canadian privacy and financial-record requirements; customer information should not be kept forever without a documented purpose.

### 28. Status emails

**Clarification:** Which order stages should send customer emails?

**Sister's response:** All except refund emails.

**Current understanding:** Send customer emails for order confirmation and applicable fulfillment/cancellation stages, but do not send separate refund-status emails. Refund status should still be available securely in order tracking.

### 29–30. Support phone

**Clarification:** Which support contact should be published?

**Sister's response:** Her personal phone number for now: +1 (437) 332-7263.

**Current understanding:** Use this as the temporary public customer-support number and owner alert destination where technically appropriate. Store it as configurable business content rather than hard-coding it into components.

### Final payment-method decision

**Sister's response:** No e-transfer. Payments will use Apple Pay and Google Pay only.

**Current understanding:**

- Remove Interac e-transfer from the launch scope.
- Remove all e-transfer instructions, pending-payment holds, reconciliation, exception handling, and e-transfer refunds from the implementation backlog.
- Do not offer ordinary manual card entry at launch.
- Offer Apple Pay and Google Pay through the selected wallet-capable payment provider.
- Show a clear device/browser compatibility message when neither wallet is available.
- Confirm an order only from an authoritative, signature-verified payment-provider event.
- Keep the existing 15-minute wallet checkout capacity hold.
- Return approved refunds to the original wallet-funded payment method through the payment provider.

---

## Latest scheduling, delivery, and pickup clarification round

These answers resolve the scheduling and pickup questions. The recorded delivery-fee amounts are a temporary working rule and are not the final production prices.

### 1. Exactly 4:00 p.m. on Tuesday and Saturday

**Question:** Can an order be scheduled for exactly 4:00 p.m. on Tuesday or Saturday?

**Sister's response:** The order must be scheduled before 4:00 p.m.

**Final decision:** Exactly 4:00 p.m. is unavailable. The selected time must be earlier than 4:00 p.m.

### 2. Latest delivery time on the other open days

**Question:** When do deliveries end on Monday, Thursday, and Friday?

**Sister's response:** They end at 7:00 p.m.

**Final decision:** Delivery operates from 6:00 a.m. through 7:00 p.m. on Monday, Thursday, and Friday. On Tuesday and Saturday, delivery begins at 6:00 a.m. and the selected time must be before 4:00 p.m.

### 3. Time selection style

**Question:** Does the customer choose an exact time or a broad time range?

**Sister's response:** They have to choose an exact time.

**Final decision:** The customer chooses one exact fulfillment time rather than Morning/Afternoon/Evening. The engineering default may use 30-minute selectable increments unless the owner later requests a different increment.

### 4. Private delivery-distance origin

**Question:** Which private location should distance calculations start from?

**Sister's response:** `M1W 2Y3`.

**Final decision:** Use postal code `M1W 2Y3` as the private origin for route-distance calculation. It must be stored in protected server/business configuration and must never be shown as a public pickup or business address.

### 5. Delivery pricing — subject to change

**Question:** How much should delivery cost at different distances?

**Sister's response:** Starting from three kilometres, CAD $5.00; each extra kilometre is CAD $1.50 more. More than 30 kilometres is not allowed.

**Temporary working decision:**

- Up to and including 3 km: CAD $5.00.
- Above 3 km and up to and including 30 km: CAD $5.00 plus CAD $1.50 for each kilometre beyond 3 km.
- More than 30 km: delivery is unavailable.
- Use route distance from the private origin to the customer address.
- For a fractional extra kilometre, calculate the additional charge proportionally and round the final fee to the nearest cent unless the owner later requests whole-kilometre rounding.
- Reaching the free-delivery threshold makes the fee CAD $0 but never bypasses the 30-kilometre limit or the allowed-city requirement.
- The owner has said the monetary fee formula will change later. Store it as server-managed business configuration rather than hard-coding the amounts into customer or admin components.

### 6. Free-delivery threshold

**Question:** Is the CAD $100 requirement measured before or after tax?

**Sister's response:** CAD $100 before tax.

**Final decision:** Products and paid customizations must total at least CAD $100 before tax and before delivery. Tax and delivery charges do not help the customer reach the threshold.

### 7. Public pickup-location approval

**Question:** Must the owner approve the customer's requested public pickup location before payment?

**Sister's response:** She will approve it first.

**Final decision:**

1. The customer requests an exact public meeting location and fulfillment time.
2. The request is shown to the owner for approval before payment.
3. If rejected, the customer must choose another public location.
4. If approved, the customer is notified and proceeds to Apple Pay or Google Pay.
5. Approval alone does not create a paid/confirmed order. Availability is revalidated and the ordinary 15-minute wallet hold begins when payment starts.
6. The owner's home address is never revealed.

---

## Current authoritative decisions

Use this section as the implementation source of truth when it conflicts with the older response history or the current PRD:

1. The business operates from Toronto, Ontario, using `America/Toronto`.
2. The minimum notice is four Toronto calendar days. Closed dates still apply; satisfying minimum notice does not make a Wednesday, Sunday, December 25, or another closed date available.
3. Customers may book up to two calendar months ahead.
4. Customers choose a delivery date only. The September 17 decision removes customer-facing exact-time selection and its slot logic.
5. Wednesdays, Sundays, and December 25 are unavailable.
6. Monday, Tuesday, Thursday, Friday, and Saturday are open delivery dates. Because customers no longer choose a delivery time, the former daily start/end-time and Tuesday/Saturday evening rules are retired from checkout.
7. Delivery only. The September 10 decision removes pickup, pickup hours, public meeting places, and pickup approval from the product. Earlier pickup answers are historical, not active requirements.
8. Delivery is limited to Toronto, Markham, and Mississauga and to route distances of no more than 30 km.
9. Google Maps Platform validates delivery addresses and calculates driving distance privately from postal code `M1W 2Y3`. Never publish the origin or an exact home address.
10. The current temporary delivery fee is CAD $5.00 for the first 3 km, then CAD $1.50 for each additional kilometre through 30 km. Fractional distance is charged proportionally and the result rounded to cents. The owner will change this monetary formula later, so treat it as configurable working data, not a hard-coded final rule.
11. Delivery is free when products and paid customizations total at least CAD $100, excluding the delivery fee. Free delivery never bypasses area or distance limits.
12. Customers enter contact and delivery details, review the verified address and fee, and explicitly confirm them before the later wallet-payment step. Address confirmation is not a paid order or capacity hold. Checkout accepts valid Canadian phone numbers only. The phone country-code selector contains Canada (`+1`), the country selector contains Canada, and the province selector contains Ontario; unsupported values remain rejected by server validation.
13. All deliveries share the hard limit of four confirmed orders per delivery day across website, phone, Instagram, and admin orders. There is no override.
14. Orders of 50 pieces or more may complete ordinary checkout and still count as one order.
15. Applicable boxes have a minimum of four total pieces and may mix flavours; after four, quantity increases by one. Regular cheesecake has a minimum of one, while mini cheesecakes have a minimum of four.
16. All products may offer configured customizations. Decorations for cakes, cookies, and cupcakes and non-plain cheesecakes may cost extra.
17. September 24 update: accept credit/debit cards through Stripe's hosted Payment Element on desktop and mobile, alongside Apple Pay and Google Pay where available. This replaces the earlier wallet-only decision. No e-transfer, Link, PayPal, or buy-now-pay-later methods.
18. Card and wallet checkout hold capacity for 15 minutes. Only verified provider confirmation creates a paid, confirmed order.
19. With date-only delivery, the deterministic cancellation cutoff is the start of the selected Toronto delivery date minus 24 hours. No delivery time is promised or inferred.
20. An eligible cancellation happens immediately and refunds the entire amount paid to the original payment method.
21. Refunds should be initiated immediately; approximately three days is the owner's desired customer expectation, subject to provider/bank timing.
22. After failed delivery, redelivery is allowed only after the customer pays a new delivery fee.
23. The former collection fallback after a failed delivery is withdrawn with pickup. Do not offer collection. The final unclaimed-order/discard policy must be confirmed before implementing failed-delivery handling.
24. The earlier three-week customer-data deletion preference is withdrawn; use a legally approved retention schedule.
25. Send customer emails for all applicable order and fulfillment stages except separate refund emails.
26. Payment received and order confirmed are one email/event because an order is confirmed only after verified payment.
27. Guests may order without an account and may later link verified historical orders to an account.
28. Only the owner uses the admin dashboard at launch.
29. The owner can manage all structured website and menu content, including prices, while historical orders retain their original snapshots.
30. The temporary public support number is +1 (437) 332-7263.
31. Checkout does not calculate, display, or collect tax. The payable total is the authoritative pastry subtotal plus the confirmed delivery fee.

---

## Clarifications still required before related features are finalized

The scheduling questions are resolved, and pickup has been withdrawn. The current delivery-fee formula remains deliberately provisional. The other remaining items are menu, provider, compliance, or engineering configuration rather than repeats of those owner questions.

### A. Product customization configuration

The final menu must define each allowed option, price, character limit, lead-time effect, and any request requiring owner review.

### B. Wallet availability

Wallets appear only on eligible devices/browsers. Ordinary card entry remains available through Stripe when neither wallet is supported. Test cards and wallets independently, including bank authentication and declined payments. Card details never pass through the application server.

### C. Refund timing wording

Confirm the customer-facing wording after checking the payment provider's actual refund estimates. Initiate refunds immediately, but do not promise arrival in exactly three days unless the provider guarantees it.

### D. Data retention

Approve a privacy retention schedule before production.

### E. Engineering configuration

- Exact-time increments are retired; owner acceptance testing should verify date-only delivery selection.
- Replace the provisional delivery-fee amounts when the owner supplies the final pricing. Keep the formula in protected server-managed configuration so this change does not require redesigning the storefront.
- Google Maps Platform is selected: server-side Address Validation and Routes APIs. Provider failures keep entered details but do not invent an address, fee, or eligible route.
- Keep the postal-code origin and any more precise coordinate private.
- Do not implement pickup or pickup approval. Revalidate delivery availability when wallet checkout begins.

---

## Implementation instruction for future work

Use **Current authoritative decisions** above instead of conflicting earlier answers or PRD rules. Do not implement e-transfer. The recorded monetary delivery-fee formula is provisional: use it only as configurable working data and replace it when the owner supplies the final pricing. Do not implement any other ambiguous rule until its matching item under **Clarifications still required** is resolved. Update the PRD only when the project owner explicitly requests it.

---

## Storefront presentation decisions — August 29, 2026

1. Use the square purple-and-yellow “Suga and Spies pastries” artwork supplied by the owner as the current logo. Do not recreate or substitute the discarded interlocking-S monogram.
2. The storefront display font is expected to change to the font used by Magnolia Bakery. Confirm the exact font family and its web/commercial licence before changing the implementation; do not guess the family or copy unlicensed font files.
3. Every homepage menu product must eventually open its own real product-order page. Stable product slugs are prepared in the homepage catalogue, but cards must not pretend to be links until those destination routes exist.
4. The hero’s “Explore the menu” control must jump down to the homepage menu and visually use a downward arrow.
5. Homepage menu presentation should remain image-led, bright, food-specific, and immediately scannable, with the product image, name, starting price, and minimum quantity kept together.
6. Use one unified homepage catalogue rather than repeating a separate favourites section. The catalogue displays two products per row on mobile and three per row on desktop, with a consistent Porto-inspired image/card hierarchy adapted to Suga & Spies rather than copied.
7. The pastry catalogue must appear immediately after the hero. Do not place the “Order ahead / Choose your time / Across the GTA” operational strip between the hero and products.
8. Keep the currently selected licensed product images. Remove customer-facing “reference photography” and “owner photos coming” labels; retain source and product-representation review information in internal documentation.

---

## Launch menu decisions — August 30, 2026

1. The launch catalogue has two customer-facing categories. **Sweet bakes** contains cheesecakes, cookies, scones, muffins, and the tart. **Savoury bakes** contains meat pies, chicken pies, and sausage rolls. A category is only a clear way for customers to browse related products; it does not change price or quantity rules.
2. The owner supplied these per-item Canadian-dollar prices:
   - 9" Cheesecake: CAD $40.00 and up.
   - 2" Mini Cheesecake: CAD $4.50 each.
   - Chocolate Chip/Chunk Cookie: CAD $2.50 each.
   - Red Velvet Cookie: CAD $3.00 each.
   - Scone: CAD $3.50 each.
   - Muffin: CAD $4.00 each.
   - 9" Tart: CAD $20.00 each.
   - Meat Pie: CAD $3.50 each.
   - Chicken Pie: CAD $4.00 each.
   - Sausage Roll: CAD $3.75 each.
3. Store each price as its true per-item integer-cent value. For products with a minimum of four, the storefront also shows the minimum purchasable total: CAD $18.00, $10.00, $12.00, $14.00, $16.00, $80.00, $14.00, $16.00, and $15.00 respectively. Never replace the database unit price with the multiplied total, because cart calculations require the unit value.
4. The flyer and the previously confirmed exception agree that the regular 9" Cheesecake has a minimum of one. Every other launch product has a minimum of four. After four, customers may add one at a time, so 4, 5, 6, 7, and higher whole-number quantities are valid.
5. All ten products are intended to be published and available at launch.
6. The currently selected licensed photographs remain approved for use and are mapped to their matching menu items. They are still stock photographs; the production representation review in `docs/storefront-image-sources.md` remains required.
7. No flavour, filling, decoration, ingredient, or allergen claim should be inferred from a stock photograph. Only the flavour names explicitly present in the supplied menu are currently confirmed.
8. Ingredient research is recorded in `docs/menu-ingredient-research-for-owner-review.md`. It is a recipe-verification checklist, not approved customer-facing product data. The owner must provide or approve the exact recipe, every packaged ingredient label, substitutions, and shared-kitchen cross-contact information before ingredients or allergen statements are published.
9. The remaining item the owner identified as “number 12” will be supplied later; do not invent or publish it in the meantime.
