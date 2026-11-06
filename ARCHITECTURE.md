# Architecture

## Overview

Pizza Delivery System is a MERN application deployed as three independently
configured applications: a customer-facing React SPA, an admin React SPA, and a
Node.js API. The customer and admin interfaces share the same API and MongoDB
data but have separate route trees, state stores, and frontend builds.

## Technology stack

| Area | Technologies |
| --- | --- |
| Customer UI | React 18, Vite, React Router, Tailwind CSS, Zustand, Axios |
| Admin UI | React 18, Vite, React Router, Tailwind CSS, Zustand, Axios, Chart.js |
| API | Node.js (ES modules), Express 4 |
| Persistence | MongoDB with Mongoose |
| Authentication | JWT in the `pds` cookie; blocked-cookie records support logout/session invalidation |
| Realtime | Socket.IO server and browser clients |
| Payments | Razorpay |
| Email and uploads | Nodemailer and Multer |

Dependency versions and scripts are defined independently in each application's
`package.json`. Each frontend is built with Vite; the server starts from
`Server/index.js`.

## Major modules

### Customer SPA (`client/`)

- `src/App.jsx` defines customer routes, authentication gates, and initial
  session loading.
- `src/pages/UserPages/` contains customer authentication, catalog, cart, and
  order screens.
- `src/components/` contains shared presentation pieces and reusable UI
  primitives.
- `src/Store/` holds Zustand session and cart state.
- `src/Context/SocketContext.jsx` manages the customer Socket.IO connection and
  order-status notifications.
- `src/utils/` contains the API client, endpoint constants, and payment UI
  integration helpers.

### Admin SPA (`Admin/`)

- `src/App.jsx` defines admin routes, role gates, session loading, and the
  small-screen notice.
- `src/pages/AdminPages/` contains dashboard, inventory, pizza, order, and user
  management screens.
- `src/components/` contains shared admin UI, charts, and UI primitives.
- `src/Store/` holds admin session state.
- `src/Context/SocketContext.jsx` manages admin realtime notifications.
- `src/Services/` contains frontend integrations such as image upload.
- `src/utils/` contains the API client and endpoint constants.

### API (`Server/`)

- `index.js` configures Express, middleware, API mounts, HTTP serving, and
  Socket.IO startup.
- `Routes/` maps the existing `/api/v1/admin` and `/api/v1/user` contracts to
  middleware and controllers.
- `Controllers/` handles HTTP requests for authentication and application
  features.
- `db/models/` defines Mongoose schemas and persistence behavior.
- `db/dbConfig.js` owns MongoDB connection management.
- `Middlewares/AuthMiddleware.js` verifies cookies/JWTs and returns session
  identity.
- `Services/` contains integrations and infrastructure operations such as
  Razorpay, email, and local image storage.
- `utils/` contains focused authentication, pricing, and cart-formatting
  helpers.
- `utils/Socket.js` configures realtime connections and socket identity maps.

## Data flow

1. A browser SPA makes HTTP requests through its Axios client to the configured
   API host. The server mounts customer and admin routers under `/api/v1`.
2. Authentication endpoints set or clear the `pds` cookie. On startup, each
   SPA requests `/api/v1/auth/get-user-info`; protected API routes verify the
   cookie and attach the authenticated ID to the request.
   Customers can update their profile name through
   `/api/v1/user/auth/profile`; email remains read-only until ownership
   verification is implemented. Customers and admins can change passwords
   through their authenticated password-change endpoints. Admin display names
   are updated through `/api/v1/admin/auth/profile`.
3. Controllers validate request-specific inputs, use Mongoose models for
   persistence, and call service/helper modules for integrations and reusable
   calculations. The browser stores session/cart state with Zustand.
4. Customer order requests may create Razorpay payments. Payment verification
   and order operations use the existing server payment integration. Checkout
   conditionally reserves ingredient stock, creates the pending order, then
   clears the cart. Razorpay calls happen after the reservation; a failed
   payment remains a pending, cancellable reservation.
5. Socket.IO connections carry the client identity used by the server to route
   order events; the two SPAs display their respective realtime notifications.
6. Admin dashboard metrics and charts are derived from persisted orders,
   inventory, users, and pizzas. The dashboard refreshes automatically every
   minute; inventory management supports client-side search, category/stock
   filters, and deterministic sorting.

## Order and inventory consistency

- Standalone MongoDB is supported. Stock decrements are conditional atomic
  updates to individual inventory documents, preventing negative stock under
  competing checkouts. The workflow compensates prior updates when subsequent
  checkout or cancellation steps fail.
- Reservation quantities are stored on the order so later pizza edits do not
  change the quantities released on cancellation. Cancellation first claims the
  order state atomically to avoid duplicate stock restoration.
- The order, cart, and multiple inventory documents cannot be committed as one
  atomic unit on a standalone server. Process crashes or failed compensation
  can leave state requiring reconciliation; use a replica set/Atlas when
  stronger multi-document atomicity is required.
- Stock changes synchronize ingredient status and the availability of pizzas
  that use those ingredients, without triggering inventory model email/socket
  hooks for every reservation update.
- Payment creation and refunds are external Razorpay operations. Captured
  payments are checked against the Razorpay order, amount, and currency before
  the order is placed.
- New orders persist pizza and customization display snapshots. Legacy orders
  without snapshots use their current referenced records when displayed; their
  original recipe cannot be reconstructed if it was previously edited.
- A failed/abandoned payment can retain a reservation until the customer or
  administrator cancels it. Automated reservation expiry and durable refund
  retries remain deployment work.
- Public order-history formatting omits internal inventory movement details;
  new order records keep those movements for safe cancellation and auditing.

## Architectural decisions and constraints

- The two SPAs remain separate deployable applications. Their similar
  components and API clients are not automatically shared because they have
  independent builds and user experiences.
- Existing routes, request/response shapes, cookie names, database schemas,
  order workflows, and UI behavior are compatibility boundaries for
  refactoring.
- The customer cancellation and payment-recovery endpoints use `POST` (same
  paths, query IDs retained) because they mutate order/payment state; clients
  calling these actions must use the updated method.
- Customer logout also uses `POST`. API clients have a bounded timeout, and
  database connection failures return `503` rather than leaving requests
  pending. Concurrent initial requests share one MongoDB connection attempt.
- The server uses a pragmatic routes/controllers/models/services structure;
  additional repository or domain layers should be introduced only when a
  concrete feature benefits from them.
- Feature controllers and several page components are currently large. Split
  them incrementally with behavior-focused tests rather than making broad
  unverified moves.
- Environment-specific values belong in each application's local `.env` file.
  The committed `.env.example` files document required variables; never commit
  real credentials.
- The server uses Node's built-in test runner for unit tests. Standalone
  database-backed checkout/cancellation, failure-compensation, concurrency,
  and payment-provider integration tests remain necessary.
