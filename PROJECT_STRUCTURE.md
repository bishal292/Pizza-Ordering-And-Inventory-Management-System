# Project Structure

## Repository map

```text
Admin/
  public/
  src/
    Context/             Admin Socket.IO context
    Services/            Browser-side integrations (for example image upload)
    Store/               Zustand store and slices
    assets/              Static and sample dashboard assets
    components/
      ui/                Reusable UI primitives
    lib/                 Styling and component helpers
    pages/
      AdminPages/        Admin feature screens
    utils/               API client and endpoint constants
    App.jsx              Admin routes, session gate, responsive notice
    main.jsx             Browser entry point and providers
  package.json           Admin SPA dependencies and scripts
  vite.config.js         Vite configuration
  .env.example           Admin SPA environment-variable template

client/
  public/
  src/
    Context/             Customer Socket.IO context
    Store/               Zustand session and cart stores
    assets/              Static assets
    components/
      ui/                Reusable UI primitives
    lib/                 Styling and component helpers
    pages/
      UserPages/         Customer feature screens
    utils/               API client, endpoints, payment helpers
    App.jsx              Customer routes and session gate
    main.jsx             Browser entry point and providers
  package.json           Customer SPA dependencies and scripts
  vite.config.js         Vite configuration
  .env.example           Customer SPA environment-variable template

Server/
  Controllers/
    Admin/               Admin HTTP handlers
    User/                Customer HTTP handlers
  Data/                  JSON data exports and fixtures
  Middlewares/           Express authentication middleware
  Routes/
    Admin/               Admin API route registration
    User/                Customer API route registration
  Services/              External integrations and infrastructure
    EmailService.js
    ImageStorage.js
    RazorPay.js
  db/
    models/              Mongoose schemas and model behavior
    dbConfig.js          MongoDB connection lifecycle
  utils/
    auth-utils.js        JWT creation and password-strength checks
    cart-formatting.js   Cart response formatting and inventory lookups
    pizza-pricing.js     Custom pizza price calculation
    Socket.js            Socket.IO setup and identity maps
  index.js               Express and HTTP server entry point
  package.json           API dependencies and scripts
  .env.example           API environment-variable template

SnapShots/               UI workflow screenshots
README.MD                Product overview and local setup
ARCHITECTURE.md          System architecture and data flow
PROJECT_STRUCTURE.md     Directory guide
CODE_GUIDELINES.md       Contribution conventions
REFACTORING_REPORT.md    Refactoring outcomes and follow-up work
```

## Where to make changes

- **Add a customer workflow:** place its screen in `client/src/pages/UserPages/`;
  add reusable presentation in `client/src/components/`, and register the URL
  in `client/src/App.jsx`.
- **Add an admin workflow:** place its screen in `Admin/src/pages/AdminPages/`;
  add reusable presentation in `Admin/src/components/`, and register the URL
  in `Admin/src/App.jsx`.
- **Change an API contract:** update the appropriate `Server/Routes/` entry,
  the corresponding `Server/Controllers/` handler, and its frontend caller
  (`src/utils/api-client.js` plus the relevant feature). Keep request and
  response formats compatible unless an API change is explicitly intended.
- **Change persistence:** update the relevant schema in `Server/db/models/` and
  check all controller and order/cart call sites before deployment.
- **Add an external integration:** put provider-specific operations under
  `Server/Services/`; keep HTTP request/response handling in controllers.
- **Add reusable server logic:** put domain-specific calculations and
  transformations in a focused module under `Server/utils/`. Do not grow a
  catch-all utility module.
- **Add configuration:** update the relevant `.env.example` and configuration
  consumer. Keep real credentials only in ignored local environment files or
  the deployment secret store.
- **Add UI primitives:** use the relevant SPA's `src/components/ui/`; keep
  feature-specific UI with its owning feature.

The customer and admin projects intentionally have separate copies of some
infrastructure. Promote code to a shared package only when the build/deployment
requirements and ownership are designed explicitly.
