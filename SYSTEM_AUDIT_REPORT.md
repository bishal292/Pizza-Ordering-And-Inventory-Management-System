# Pizza Delivery System Audit

## Executive summary

The application is a pair of React/Vite applications backed by an Express,
Mongoose, and MongoDB API. The most serious defects were in order checkout and
cancellation: order model hooks changed inventory outside the order write,
stock deductions were not conditional, and cancellation recomputed ingredients
from the current pizza recipe. Payment state also relied too heavily on browser
callbacks, while analytics included hardcoded chart data.

Checkout and eligible cancellation use conditional single-document stock
updates and compensating operations that support standalone MongoDB; reservation
quantities and display snapshots are saved with new orders, payment verification
checks Razorpay's captured payment, and dashboard charts use server aggregates.
Without a replica set, order/cart/inventory changes are not a single atomic
operation. Process or database failures during compensation can require manual
reconciliation. Database-backed integration coverage, payment webhooks,
reservation expiry, and durable refund reconciliation remain necessary.

## 1. Application architecture

- **Customer SPA (`client/`)**: React, Vite, React Router, Zustand, and Axios
  for catalog, cart, account, checkout, and order history.
- **Admin SPA (`Admin/`)**: a separate React/Vite application for inventory,
  pizza, user, order, and dashboard management.
- **API (`Server/`)**: Express routes call controllers, which use Mongoose
  models and integration services. JWTs are carried in cookies; Socket.IO
  carries order and inventory notifications.
- **Persistence and integrations**: MongoDB/Mongoose stores users, admins,
  pizzas, inventory, carts, orders, blocked sessions, and daily order sequence
  values. Razorpay handles payment orders, captured-payment verification, and
  refunds. Nodemailer sends email notifications.
- **Primary workflow dependencies**: cart contents reference pizzas and
  inventory customizations; orders reference users, pizzas, and inventory;
  payment-provider IDs and statuses are stored on orders; order snapshots and
  inventory movements preserve checkout-time details.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the module map and database
consistency tradeoffs.

## 2. Corrected business workflows

### Pizza management

Pizza creation and updates validate referenced inventory categories and
positive menu prices. Checkout re-reads current pizza/inventory data and
calculates prices on the server. New orders store pizza/customization display
snapshots and immutable item prices. Pizza and inventory records referenced by
order history cannot be deleted. Ingredient stock changes refresh availability
for affected pizzas.

Legacy orders have no checkout-time snapshots, so their original names, recipe,
and display image cannot be reconstructed if they were already edited.

### Order and inventory management

1. Checkout loads the authenticated user's cart, current pizza configurations,
   and inventory from MongoDB.
2. The server validates quantities and availability, calculates prices, and
   conditionally decrements each aggregated ingredient requirement, preventing
   an individual stock value from going negative. If a later checkout step
   fails, the service attempts to restore prior stock updates and remove the
   incomplete order.
3. The order and its reservation movements are saved, then the cart is removed
   only if it has not changed since checkout began. Daily order IDs use an
   atomic per-day sequence.
4. Payment creation happens after stock reservation and order persistence. A
   successful provider order ID is saved to the pending order.
5. Payment verification checks the HMAC signature and confirms with Razorpay
   that the payment is captured for the expected provider order, amount, and
   INR currency before moving the order to `placed`.
6. Admin progression is constrained to `placed → preparing → prepared →
   completed`. Cancellation is limited to eligible states, atomically claims
   the order document to prevent duplicate restoration, and restores the exact
   saved reservation quantities with compensation on failure.

Inventory reservations currently happen before payment. Abandoned and failed
payments therefore hold stock until a user or admin cancels the order.

### Cancellation and refunds

Cancellation state and each stock update are individually atomic in MongoDB,
but their multi-document changes are not atomic together on a standalone
server. Compensation attempts to reverse partial stock restoration and reopen
the order when possible. A paid order becomes `refund_pending`; the Razorpay
refund is issued after stock release and the order is marked refunded if the
provider operation and database update both succeed. If refund or state
reconciliation fails, the API reports a pending/support-follow-up result.

The provider operation is outside MongoDB, so this is not a distributed
transaction. There is not yet a durable refund retry/reconciliation worker.

### Admin analytics

Dashboard totals, UTC day boundaries, monthly revenue, and order-status counts
are calculated from MongoDB data. Revenue excludes unpaid and refunded orders;
pending refunds remain included until their refund is recorded. The dashboard
charts now consume these APIs instead of demo values.

Legacy payment records without `paidAt`, and refunds that were never recorded,
can make historical revenue estimates inaccurate.

### Customer/admin workflow follow-up

- Pizza deletion is rejected when an order references the pizza, including
  supported legacy order-reference shapes; the detail screen reports when
  history prevents deletion.
- Customer order lists and detail pages handle missing/deleted legacy
  references without crashing. Profile editing changes only the display name;
  email remains read-only until ownership verification is available.
- User/admin order-detail responses now include legacy pizza size details and
  a calculated total quantity. Empty cart/order/list responses use JSON shapes
  matching their successful responses; `204` responses no longer attempt to
  carry a body.
- Admin user-order lookup now returns the user with an empty orders array when
  appropriate, and returns `404` for a missing user. The admin-info controller
  no longer calls `next()` after sending its response.
- Checkout now reports payment-provider initialization failures explicitly and
  links the customer to the reserved order so payment can be retried. The
  browser distinguishes payment-window launch from payment confirmation.
- Customer cart quantity updates have a bounded Socket.IO acknowledgement
  wait, and failed/disconnected requests produce visible feedback.
- Customer/admin catalog, order, and detail screens have responsive layouts
  and explicit loading, empty, and error states.

## 3. Prioritized audit findings

| Priority | Finding and root cause | Change / disposition |
|---|---|---|
| Critical | Inventory and order/cart operations span MongoDB documents and standalone servers cannot transact across them. Failures may leave partial workflow state. | Checkout and cancellation use conditional inventory updates, order/cart compare-and-remove safeguards, cancellation claims, and compensating rollback. Use a replica set/Atlas where full multi-document atomicity is required; failed compensation must be reconciled. |
| High | Cancellation recomputed ingredient usage from the live pizza recipe. Pizza edits could restore the wrong stock quantities. | New orders persist reservation movements and cancellation uses those persisted quantities. Legacy orders remain limited by missing historical movement data. |
| High | Client callback/signature alone did not establish the provider payment was captured for the right amount/currency. | Payment verification checks the provider payment record and makes the local pending-to-placed update conditional. |
| High | Cancellation and payment-order recovery used GET endpoints despite changing order/payment state, creating unsafe HTTP semantics and CSRF exposure. | Both endpoints now use POST at the same paths; the customer SPA was updated. This is a method-level API compatibility change. |
| High | Refunds can succeed at Razorpay while the database write fails; there is no webhook or durable retry path. | The API no longer reports success-shaped refund state on persistence failure. Durable recovery remains a required follow-up. |
| High | Pending orders can reserve inventory indefinitely after abandoned or failed payment. | Documented as unresolved; add a scheduled expiry/reconciliation workflow before production. |
| Medium | Order detail output could expose internal reservation fields, and live pizza references could alter history. | New orders use snapshots; public order formatting omits internal inventory movement fields. |
| Medium | Invalid prices, quantities, inventory references, and order status transitions were insufficiently guarded. | Added server-side price/quantity/reference validation and conditional order transitions. |
| Medium | Pizza availability could remain stale after stock restoration; inventory notification hooks could run for workflow updates. | Availability is recomputed for affected pizzas; stock updates avoid model save hooks. |
| Medium | Revenue chart data was hardcoded and analytics had inconsistent date boundaries. | Replaced demo values with database aggregates and UTC boundaries. Historical legacy financial data is still not fully reconcilable. |
| Medium | Mutating routes needed stronger request-origin controls and cookie/token expiry alignment. | Trusted-origin checks were applied to state-changing routes and session expiry configuration was aligned. Password-reset/login rate limiting remains outstanding. |
| Low | Internal order model fields and live references made response shapes harder to reason about. | Snapshot formatting is centralized; existing paths and principal response shapes are retained except the documented HTTP method change. |

## 4. Data consistency report

- New checkout writes stock reservations, the order, and cart deletion as
  separate standalone-compatible operations. A later failure triggers
  compensation, but a crash or failed compensation may leave partial state.
- Conditional stock decrements prevent negative stock under concurrent orders.
- Cancellation uses the saved per-order inventory movement list and claims the
  order status before restoring stock to prevent duplicate cancellation
  requests from restoring stock twice.
- Order item prices and presentation snapshots are persisted at checkout.
- Payment state is only moved to paid after provider confirmation and a
  conditional state update. Refund state is tracked as `refund_pending` or
  `refunded`.
- Ingredient and pizza availability are synchronized for order stock changes
  and normal inventory saves.
- The default local URI supports standalone MongoDB. Replica-set/Atlas
  deployments are still recommended where multi-document transaction
  guarantees are required.

**Remaining consistency gaps:** Razorpay calls cannot share MongoDB
transactions; there is no payment webhook, idempotent refund reconciliation
worker, reservation expiry job, or append-only ledger for manual inventory
adjustments. Legacy order reservations cannot be recovered exactly.

## 5. Performance report

- Checkout aggregates inventory requirements by ingredient before issuing
  conditional stock updates, avoiding per-ingredient mutations for repeated
  recipe items.
- Dashboard KPI queries run concurrently and chart endpoints aggregate in
  MongoDB.
- Dashboard date ranges are bounded to the requested reporting windows.
- Existing N+1 patterns remain in admin user-list/search workflows, and some
  endpoints return unbounded result sets. Address these with pagination and
  measured query/index plans rather than speculative indexing.
- Vite reports bundles above 500 kB for both SPAs. The unused server-side
  Razorpay package import was removed from the customer cart; bundle
  code-splitting and size analysis remain worthwhile follow-up work.

## 6. Security report

- Server-side price computation prevents clients from supplying trusted order
  totals.
- Payment verification compares the signature and provider payment status,
  order ID, amount, and currency.
- Authenticated user order reads/cancellations are scoped to the current user;
  admin order transitions require the admin route's authentication.
- State-changing customer actions use POST and trusted-origin middleware.
- Profile updates accept only a validated display name; email remains
  read-only until an email ownership-verification flow is implemented.
- Cookie and JWT lifetimes are aligned; order responses omit internal stock
  movements.
- API requests have a bounded client timeout, database connection attempts are
  shared, and database connection failures return an explicit `503` response.
- Password reset and login still need shared rate limiting and abuse monitoring.
- No authenticated Razorpay webhook is implemented. Until one exists, a
  captured payment that is not followed by the browser verification request may
  remain unrecorded.
- A security review of deployment configuration, provider dashboard settings,
  and live infrastructure was not possible from repository code alone.

## 7. Testing report

Executed successfully:

- `npm --prefix Server test`: **4 passed** (inventory aggregation, snapshot
  formatting, legacy quantity totals, and partial snapshot fallback).
- `node --check`: **28 server JavaScript files** passed syntax checking.
- Focused ESLint on changed customer/admin frontend files: passed.
- `npm --prefix Admin run build`: passed.
- `npm --prefix client run build`: passed.
- `git diff --check`: passed.

The server test runner emits a dependency deprecation warning for
`url.parse()`. Both frontend builds emit a bundle-size warning.

No database-backed checkout/cancellation tests, concurrent checkout tests,
Razorpay test-mode requests, refund tests, or webhook tests were run. The unit
tests do not establish compensation or concurrency behavior against a real
database.

## 8. Remaining work before production

1. Add a verified Razorpay webhook with event deduplication and reconcile
   provider-captured payments even when the browser callback is lost.
2. Add durable refund retries/reconciliation and reservation expiry with
   explicit business-approved timeout and cancellation rules.
3. Add standalone database integration tests for checkout/cancellation,
   insufficient inventory, concurrent reservations, payment transitions,
   duplicate callbacks, refunds, and compensation failure scenarios.
4. Add an append-only inventory adjustment ledger with actor, reason, quantity,
   and timestamp; protect manual stock updates with appropriate controls.
5. Plan a safe migration/backfill for legacy orders that lack snapshots,
   payment timestamps, and exact reservation movements.
6. Add rate limiting to login, OTP, and password reset; review admin
   registration and operational audit logging.
7. Paginate user/order lists and profile measured query plans before adding
   indexes.
8. Reconcile historical revenue against Razorpay/provider records before using
   it for accounting or financial reporting.

The worktree already contained unrelated modified files and an untracked
`SECURITY_AUDIT_REPORT.md` before this audit. That report was preserved and not
overwritten; changes here should be reviewed against the pre-existing worktree
before committing.
