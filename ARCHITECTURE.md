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
3. Controllers validate request-specific inputs, use Mongoose models for
   persistence, and call service/helper modules for integrations and reusable
   calculations. The browser stores session/cart state with Zustand.
4. Customer order requests may create Razorpay payments. Payment verification
   and order operations use the existing server payment integration.
5. Socket.IO connections carry the client identity used by the server to route
   order events; the two SPAs display their respective realtime notifications.

## Architectural decisions and constraints

- The two SPAs remain separate deployable applications. Their similar
  components and API clients are not automatically shared because they have
  independent builds and user experiences.
- Existing routes, request/response shapes, cookie names, database schemas,
  order workflows, and UI behavior are compatibility boundaries for
  refactoring.
- The server uses a pragmatic routes/controllers/models/services structure;
  additional repository or domain layers should be introduced only when a
  concrete feature benefits from them.
- Feature controllers and several page components are currently large. Split
  them incrementally with behavior-focused tests rather than making broad
  unverified moves.
- Environment-specific values belong in each application's local `.env` file.
  The committed `.env.example` files document required variables; never commit
  real credentials.
- There is no configured automated server test suite at present. The server
  package's `test` script is a placeholder that exits with an error.
