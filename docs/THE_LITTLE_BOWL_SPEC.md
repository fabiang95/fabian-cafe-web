# The Little Bowl — Web App Product & Implementation Brief

**Status:** MVP requirements baseline  
**Purpose:** Hand this file to Claude Code as the product specification for implementation.  
**Important:** Distinguish *confirmed decisions* from *suggestions / open questions*. Do not silently implement optional features.

## 1. Product summary

Build **The Little Bowl**, a responsive **web application** (not a native mobile app) for a small, home-based café operating on selected dates. Customers select an open date, customise pork rice bowls, add one or more configurations to a session-based cart, check out without an account, and see a payment QR code. If they supplied an email address, email them the QR code as well.

### Confirmed branding and landing copy
- Header / brand: **THE LITTLE BOWL**
- Address: **Block 269, Singapore 600269**
- **Do not use** the tagline “Homemade Japanese Rice Bowls.”
- A short message such as “Freshly prepared on selected days” was proposed, **not explicitly confirmed**. Keep optional.
- Singapore context: display currency in **SGD**; example prices are placeholders, **not approved prices**.

## 2. Confirmed customer journey

```text
Landing page (calendar)
    → Select an available café date
    → Menu for selected date
    → Configure pork rice bowl + quantity
    → Add to cart (repeat for other configurations)
    → Review/edit cart
    → Guest checkout (phone required; name/email optional)
    → Submit order to backend
    → Display payment QR code
       ↳ If email entered, also send QR code by email
```

Customer accounts, registration and login **are not required**.

## 3. MVP pages and UX

### A. Landing / calendar
- Prominently display **THE LITTLE BOWL** and **Block 269, Singapore 600269**.
- Show a calendar with highlighted **café operating dates**.
- Clicking an available date opens that date’s menu.
- Show clear visual distinction between selectable and unavailable dates; never rely on colour alone.
- Dates and their availability must come from an API, **not hard-coded in the React component**.
- Source may initially be backend configuration / Kubernetes ConfigMap, with possible database migration later.
- Make the calendar responsive and accessible via keyboard.
- Suggested, not mandatory: distinguish closed from sold-out dates, show a list of upcoming open dates.

### B. Menu for chosen date
- Display selected café date prominently.
- Initial single main item: **pork rice bowl**.
- Optional, independently selectable add-ons:
  - **Onsen egg**
  - **Vegetables**
- Quantity selector (minimum 1).
- Update total based on base price + selected add-ons, multiplied by quantity.
- “Add to cart” adds **that exact configuration and quantity**.
- Stay on menu to let users add different configurations; offer visible cart access.
- No real prices, photographs, descriptions or menu naming details were finalised; use configuration or placeholders.

### C. Cart — Option 2 (confirmed)
Support different configurations as separate cart lines, e.g.:

```text
2 × Pork rice bowl + onsen egg
1 × Pork rice bowl + vegetables
```

- Repeated additions of **identical** product + add-on configurations automatically **merge** quantities.
- Different add-ons remain different lines.
- Support changing quantities, editing customisations, and removing lines.
- Show per-line totals, total bowl count, and grand total.
- **One café date per cart** is a recommended rule from the earlier design, not explicitly confirmed; if implementing it, warn before replacing an existing date’s cart.
- No account or cross-device cart sync.

### D. Guest checkout
- **Phone number: required.** Singapore `+65` input/prefix appropriate; validate sensibly.
- **Name: optional.**
- **Email address: optional.** Validate format if supplied.
- Show date, order summary and final total before submitting.
- Backend must validate availability, add-ons and prices and calculate authoritative totals.
- On success: generate/persist order and navigate to payment QR page.
- On request failure: preserve cart and show a recoverable error.
- Do not make email optionality a barrier to completing checkout.

### E. Payment QR page
- **Display the payment QR code** after successful order creation. Keep payment instructions minimal.
- Show **order reference** and **amount** near QR as recommended helpful context.
- **If and only if** a valid email address was supplied, send the payment QR code to that address.
- Email delivery is a backend responsibility and should not block display of the payment page if sending fails.
- A displayed/emailed QR code **does not constitute payment confirmation**.
- Manual payment verification is the **MVP approach previously accepted**.
- Suggested payment state: `PENDING_PAYMENT` until a human verifies payment.
- QR specifics (static vs dynamic, PayNow account/payee, generation, reference encoding) **are not decided**. Never assume automatic reconciliation from a static QR.
- **Do not** mark an order paid just because a customer loaded the QR page or clicked any “I paid” button.
- No requirement for a separate “I've Made Payment” button; the latest direction is simply to show the QR.

## 4. Session-based cart (confirmed)

- Guest-only cart; **valid only within a browsing session**.
- Suggested implementation: React state + browser `sessionStorage`.
- Expected basic behaviour:
  - Same-tab page navigation and refresh: retain cart.
  - No server-side cart needed before checkout.
  - New independent session: starts empty.
- Browser caveat: duplicated tabs may inherit initial `sessionStorage`; browser restore can restore a previous tab session. If strict expiry is necessary, a separate strategy is needed.
- Once order submitted, persist the **order** server-side even if user closes browser.
- Protect against duplicate submits (button disabling and/or request idempotency).
- Do not lose cart on failed order submission. After successful creation, retain payment/order reference for the payment page before clearing cart.

## 5. Suggested data contracts (illustrative, not fixed API)

### Café operating date
```json
{
  "date": "2026-11-14",
  "status": "AVAILABLE",
  "collectionStart": "12:00",
  "collectionEnd": "15:00"
}
```
Only `date` and availability are core requirements; collection windows and sold-out logic are future/options.

### Menu item
```json
{
  "id": "pork-rice-bowl",
  "name": "Pork Rice Bowl",
  "basePriceCents": 1200,
  "addons": [
    {"id": "onsen-egg", "name": "Onsen Egg", "priceCents": 200},
    {"id": "vegetables", "name": "Vegetables", "priceCents": 150}
  ]
}
```
**All numeric prices above are examples only.**

### Session cart item
```json
{
  "menuItemId": "pork-rice-bowl",
  "quantity": 2,
  "addons": ["onsen-egg"]
}
```
Interpretation: two bowls, **each** with onsen egg. Canonicalise/sort selected add-on IDs when determining a merge key; do not merge distinct configurations.

### Order submission
```json
{
  "cafeDate": "2026-11-14",
  "customer": {
    "phone": "+6591234567",
    "name": null,
    "email": null
  },
  "items": [
    {"menuItemId": "pork-rice-bowl", "quantity": 2, "addons": ["onsen-egg"]},
    {"menuItemId": "pork-rice-bowl", "quantity": 1, "addons": ["vegetables"]}
  ]
}
```
**Do not trust frontend-submitted prices or totals.** Reprice against backend menu and snapshot prices into the stored order.

### Possible order states
- `PENDING_PAYMENT` — QR displayed, payment not confirmed.
- `CONFIRMED` — payment verified manually.
- `CANCELLED` — order cancelled.
- `FULFILLED` — order collected/served.
An extra `PAYMENT_REVIEW` state was previously proposed but **is not needed unless a customer payment-submission feature is chosen**.

## 6. Suggested API surface (not final contract)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/cafe-dates?month=YYYY-MM` | Available dates |
| GET | `/api/cafe-dates/{date}/menu` | Date-specific menu |
| POST | `/api/orders` | Validate and create pending order |
| GET | `/api/orders/{orderReference}` | Retrieve order/payment display details |
| Internal/admin | TBD | Manually mark payment confirmed |

Implementation notes:
- Frontend is planned in **React**.
- Backend technology and persistence engine have **not been explicitly selected**.
- Keep frontend independent of whether dates are backed by a ConfigMap or database.
- Store orders in a durable database from the MVP, not in a ConfigMap.
- Design order-reference access securely: avoid predictable public access to personal details. A long random lookup token or scoped payment-page token is preferable to an enumerable ID.

## 7. Emails

Only send a payment QR email when a customer supplies an email address. Include:
- The Little Bowl branding.
- Order reference.
- Selected café date.
- Payable amount.
- Payment QR image (inline or reliably accessible attachment).

The recipient is the checkout email address. If no email was supplied, skip entirely. Do not present the email as a paid-order confirmation. Email provider, templates and delivery/retry infrastructure remain to be selected.

## 8. UX and operational safeguards

- Mobile-browser friendly, desktop friendly; **not** a native mobile application.
- Keep dates and add-on choices easy to recognise with disabled states and clear labels.
- Cart summary should remain accessible during configuration.
- Check that the selected date is still orderable at checkout; inventory/limits have not been decided.
- Prevent inconsistent price display by working in integer cents where practical.
- Record timestamps and timezone consistently (**Asia/Singapore** for date presentation).
- Validate and protect submitted phone/email data; do not expose them through guessable order URLs.
- Payment is **manual verification**, not proof of payment from displaying/emailing a QR.
- If static QR is used, operational reconciliation may be difficult; evaluate before going live.

## 9. Future enhancements (explicitly out of MVP unless requested)

- **Add selected café date to customer's calendar**.
- Admin dashboard to configure dates, menus and review orders.
- Database-managed scheduling instead of ConfigMap.
- Order capacity limits / “fully booked” status.
- Collection time slots and scheduling.
- Automated payment verification via supported payment provider.
- Order confirmation email (distinct from emailing payment QR).
- More dishes, add-ons and richer menu management.

## 10. Open decisions — ask before implementing assumptions with business impact

1. **Collection vs dine-in:** Customers’ fulfilment model has not been confirmed.
2. **Pricing:** Actual base bowl and add-on prices.
3. **Payment QR:** Static vs per-order dynamic QR; payee/account, amount/reference expectations.
4. **Manual payment review:** How the owner checks and marks orders paid (simple admin or manual backend operation).
5. **Date capacity:** Whether café dates or order quantities have limits.
6. **Order expiry/cancellation:** How long pending-payment orders remain valid.
7. **Tech choices:** React framework/build tool, backend stack, database, hosting, email service.
8. **Cart date switching:** Whether to restrict to one date per cart; recommended, not expressly agreed.
9. **Address precision:** Display the supplied address exactly; don't invent unit number or pickup instructions.

## 11. Acceptance criteria for the first usable version

1. Home page shows THE LITTLE BOWL and **Block 269, Singapore 600269**, without the removed tagline.
2. Calendar marks server-provided available operating dates; available dates can be selected.
3. Selecting a date opens that date's menu.
4. Customer can select onsen egg and/or vegetables and quantity for a pork bowl.
5. Customer can add a configuration, return to configure another, and see both in cart.
6. Adding a duplicate configuration increments its line quantity rather than duplicating the line.
7. Quantity changes and cart removals update totals correctly.
8. Refreshing within the same browser tab retains cart.
9. Guest checkout succeeds with **phone number alone**; name/email remain optional.
10. Checkout rejects invalid provided email and missing/invalid phone.
11. Successful checkout stores a persistent pending order with backend-calculated prices.
12. Payment page shows QR code for the newly created order.
13. If email was provided, backend sends that QR via email; if absent, sends none.
14. Email failure does not erase the order or prevent QR display.
15. An order is **not automatically marked paid** after QR display or email delivery.
16. Failed order submission preserves the cart for retry.
17. No login, signup, or native mobile app is required.

## 12. Suggested Claude Code implementation instruction

> Read this specification as the source of truth. First inspect the existing repository and summarise the current stack. Identify decisions that are confirmed versus open. Implement the MVP incrementally, prioritising landing calendar, menu customisation, session cart, guest checkout, then backend order creation, QR display, and conditional email delivery. Do not implement future features or assume payment automation. Keep business configuration outside frontend components, write tests for cart merging/pricing and checkout validation, and document any assumptions made.
