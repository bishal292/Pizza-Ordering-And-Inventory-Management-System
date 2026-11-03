# Refactoring Report

## 1. Original architecture assessment

The repository contains two independently built React/Vite applications
(`client/` for customers and `Admin/` for administrators) and an Express API
(`Server/`). The API uses Mongoose models, JWT cookies, Socket.IO, Razorpay,
Nodemailer, and Multer. The overall separation into applications, routes,
controllers, models, and integrations is understandable and was retained.

## 2. Major problems identified

- `Server/utils/util-functions.js` combined authentication helpers, email,
  image upload/deletion, pizza pricing, and cart formatting.
- The order model imported the server entry point to initialize Socket.IO,
  creating a cycle through the route/controller imports.
- Pizza and inventory model files imported each other to access the other
  model's hooks.
- Server controllers and frontend pages are oversized. For example,
  `AdminMiscController.js` is about 1,100 lines and
  `UserMiscControllers.js` is about 630 lines. Several individual screens are
  also several hundred lines long.
- Frontend session, API-client, and state patterns are repeated between the
  separately deployed SPAs; the existing empty store slices add little value.
- The server does not have a configured automated test suite.

## 3. SOLID improvements applied

- **SRP:** Split authentication, email, image storage, pizza pricing, and cart
  formatting into focused server modules.
- **OCP/DIP:** Controllers and routes now depend on focused helpers/services
  rather than the former catch-all utility module. Image filesystem and Multer
  concerns are isolated in `Services/ImageStorage.js`.
- **Dependency direction:** Removed the order model's import of `index.js`.
  Socket.IO is initialized by the application entry point as before; models no
  longer bootstrap the HTTP server.
- **Decoupling:** Replaced direct Pizza/Inventory model imports in their
  respective hooks with Mongoose's registered-model lookup, eliminating their
  static import cycle.
- **KISS/YAGNI:** Kept the existing route/controller/model architecture and API
  contracts; no new framework or unnecessary repository layer was introduced.

No inheritance or interface hierarchy was added; those patterns do not provide
value for these focused JavaScript modules.

## 4. Original versus updated directory structure

The three-application layout was retained. The server utility area changed from
one mixed `utils/util-functions.js` file to focused modules:

```text
Before:
Server/
  Services/RazorPay.js
  utils/Socket.js
  utils/util-functions.js

After:
Server/
  Services/
    EmailService.js
    ImageStorage.js
    RazorPay.js
  utils/
    auth-utils.js
    cart-formatting.js
    pizza-pricing.js
    Socket.js
```

The complete current repository guide is in `PROJECT_STRUCTURE.md`.

## 5. Files created, modified, or removed

**Created**

- `Server/Services/EmailService.js`
- `Server/Services/ImageStorage.js`
- `Server/utils/auth-utils.js`
- `Server/utils/cart-formatting.js`
- `Server/utils/pizza-pricing.js`
- `ARCHITECTURE.md`
- `PROJECT_STRUCTURE.md`
- `CODE_GUIDELINES.md`
- `REFACTORING_REPORT.md`

**Modified**

- `README.MD` to correct the customer directory name and link to the new
  project documentation.
- Server auth and feature controllers, admin routes, and `Server/index.js` to
  use the focused modules and remove the entry-point/controller coupling.
- `Server/db/models/InventoryModel.js`, `PizzaModels.js`, and `Orders.js` to
  remove the static model and server-entry import cycles.

**Removed**

- `Server/utils/util-functions.js`, after all of its call sites were moved.

No UI files, external routes, database schemas, dependencies, or response
contracts were changed.

## 6. Duplication and complexity reductions

- The duplicated Nodemailer transport configuration now has one constructor in
  the email service.
- The email helper returns its send promise so existing awaited callers can
  receive and handle delivery failures instead of losing them.
- The catch-all utility module and its unrelated import dependencies were
  removed; the former functionality is grouped by responsibility.
- Unused cart-formatting ID collections and a commented-out obsolete
  implementation were removed during extraction.
- Two static import cycles and a model-to-server-entry dependency were removed.

The large controllers and screens were not split in this pass because their
behavior is not covered by automated workflow tests.

## 7. Reusability and maintainability improvements

- Routes and controllers can import only the image, email, authentication,
  pricing, or formatting functionality they use.
- Local image storage configuration and deletion now have one infrastructure
  owner.
- The new root documentation describes architecture, module ownership, change
  locations, and contribution conventions.
- The existing UI, API paths and payloads, cookie behavior, persistence schema,
  and deployment layout remain unchanged.

## 8. Verification results

- **Passed:** `node --check` for all 25 server JavaScript modules.
- **Passed:** Static check that all server-relative imports resolve.
- **Passed:** Static dependency graph check; no relative import cycles remain.
- **Passed:** `git diff --check`.
- **Blocked:** Customer and admin `npm run lint` and `npm run build`; their
  dependencies are not installed. An attempted lockfile-based `npm ci` stopped
  with `EPERM` while npm tried to remove a locked package under the parent
  `VS_code\node_modules` directory, outside this repository. No dependency
  manifests or lockfiles were changed.
- **Not available:** Server automated tests. `Server/package.json` defines a
  placeholder test script that exits with an error.
- **Not run:** End-to-end API, database, authentication, payment, and browser
  workflows; these require installed runtime dependencies and configured
  services/credentials.

## 9. Remaining technical debt

- Admin and customer controllers still combine multiple feature responsibilities.
- Large React pages still combine presentation and workflow state/requests.
- Authentication/session bootstrapping and API-client setup are duplicated
  between the separate SPAs.
- Some Mongoose hooks still perform cross-model persistence and external
  notification side effects.
- Server handlers have inconsistent error response patterns, and there is no
  server test framework or frontend component/workflow test suite.

## 10. Recommendations for future development

1. Add server unit/integration tests and fixtures for inventory, cart, order,
   authentication, and payment workflows before splitting large controllers.
2. Decompose admin and customer handlers one feature at a time while asserting
   the existing HTTP status codes and payloads.
3. Extract repeated page behavior into focused hooks/components only where the
   customer/admin semantics are genuinely shared.
4. Move persistence-triggered notification side effects behind explicit
   application/service operations, with tests for ordering and failure behavior.
5. Restore each frontend's locked dependencies in a workspace-local,
   permission-safe environment and run its lint and production-build checks.
