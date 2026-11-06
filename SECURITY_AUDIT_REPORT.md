# Security Audit Report

**Application:** Pizza Delivery System  
**Scope:** `Server/`, `Admin/`, and `client/`  
**Assessment date:** 2026-11-04  
**Approach:** Architecture/configuration review, AI-assisted code review, dependency audits, and post-change static/build validation. No production data was accessed or changed.

## Executive summary

The application is a React/Vite customer and admin frontend backed by an Express API, MongoDB/Mongoose, JWT cookies, Socket.IO, local image uploads, email-based password reset, and Razorpay payments.

The review confirmed authorization failures that allowed customer tokens to reach admin order endpoints, customer order IDs to be used across accounts, and Socket.IO clients to claim arbitrary user/admin identities. It also found an upload-before-authorization issue, client-influenced order pricing, and guessable password-reset OTPs. These code paths were changed to require server-side roles and ownership, authenticate sockets using the signed session cookie, validate uploaded image content, recalculate prices server-side, and enforce cryptographically random OTPs with atomic attempt limits.

No database-backed integration test suite is configured, so the role and cross-account behaviors were verified by reviewing the resulting route/query guards, not by running requests against a live database. Deployment settings and residual dependency advisories still require attention; see below.

## Severity summary

| Severity | Result |
|---|---|
| Critical | No confirmed application-runtime issue. `npm audit` still flags a critical install-tree `tar` advisory in the backend dependency tree. |
| High | Admin and order IDORs, socket identity spoofing, and upload authorization/type issues were confirmed and fixed. A high Nodemailer advisory remains. |
| Medium | Pricing and reset-code weaknesses were confirmed and fixed. Rate limiting, audit logging, deployment TLS verification, and several dependency advisories remain. |
| Low | No additional confirmed low-severity exploit was identified. |

## 19-point security checklist

| # | Security measure | Status | Severity | Evidence and security risk |
|---|---|---|---|---|
| 1 | Row-Level Security / ownership | Needs Improvement | Medium | MongoDB does not provide application-style row-level security in this setup. Order lookups now include the authenticated `userId` in [UserMiscControllers.js](./Server/Controllers/User/UserMiscControllers.js#L493), [UserMiscControllers.js](./Server/Controllers/User/UserMiscControllers.js#L546), and [UserMiscControllers.js](./Server/Controllers/User/UserMiscControllers.js#L609). Carts are also queried by user. Direct database access is not scoped by these API checks; keep MongoDB network access and credentials restricted. |
| 2 | Authentication on every private request | Already Secure | High — fixed | Private user routes use `verifyToken`; private admin routes now also require `verifyAdmin` in [AdminRoutes.js](./Server/Routes/Admin/AdminRoutes.js#L36) and [adminAuthRouteHandler.js](./Server/Routes/Admin/adminAuthRouteHandler.js#L9). Public catalog and authentication/recovery endpoints remain public by design. |
| 3 | Server-side validation and authorization | Already Secure | High — fixed | Admin roles are checked server-side; order/payment ownership is checked server-side; `calculatePrice` validates customization IDs, categories, and availability in [pizza-pricing.js](./Server/utils/pizza-pricing.js#L4). Checkout totals are recalculated from database prices in [UserMiscControllers.js](./Server/Controllers/User/UserMiscControllers.js#L319). Broader field-length and business-rule validation should continue to be reviewed as APIs evolve. |
| 4 | Rate limiting | Needs Improvement | Medium | Reset codes are now limited to five atomic failed attempts per active OTP in [userAuthController.js](./Server/Controllers/User/userAuthController.js#L236) and [AdminAuthController.js](./Server/Controllers/Admin/AdminAuthController.js#L235). There is no shared per-IP/account limiter for login, signup, forgot-password, or public endpoints. A process-local limiter would not reliably protect multi-instance/serverless deployment; configure a shared edge or datastore-backed limiter. |
| 5 | Input sanitization | Needs Improvement | Low | Email validation and ID/category checks are present, Mongo query filters are constructed by the server, and React renders text without a raw-HTML sink found in the reviewed frontends. Some free-text and numeric fields still need consistent type, length, and range validation. |
| 6 | Parameterized/safe database queries | Already Secure | Low | Mongoose operations use explicit query objects and do not pass request objects directly as filters. Order and payment queries now include owner constraints; see [UserMiscControllers.js](./Server/Controllers/User/UserMiscControllers.js#L505) and [RazorPay.js](./Server/Services/RazorPay.js#L21). |
| 7 | Restricted CORS | Already Secure | Medium | Express and Socket.IO use an explicit `CLIENT_URLS` origin allowlist in [index.js](./Server/index.js#L33) and [Socket.js](./Server/utils/Socket.js#L17), with credentials and a limited method list. The environment example now uses the expected variable name. Configure exact production origins; CORS is not an authorization control. |
| 8 | HTTPS and secure cookies | Needs Improvement | Medium | Authentication cookies use `httpOnly`, `secure`, and `SameSite=None`; HSTS is emitted when `NODE_ENV=production` in [index.js](./Server/index.js#L26). TLS termination, HTTP-to-HTTPS redirects, and the actual production environment configuration cannot be verified from this repository. |
| 9 | IDOR prevention | Already Secure | High — fixed | Customer order details, cancellation/refunds, payment completion, and payment verification are scoped to the authenticated owner. Admin order retrieval is role-protected. See [UserMiscControllers.js](./Server/Controllers/User/UserMiscControllers.js#L493), [RazorPay.js](./Server/Services/RazorPay.js#L21), and [AdminRoutes.js](./Server/Routes/Admin/AdminRoutes.js#L74). |
| 10 | Production debug mode | Needs Improvement | Low | The API returns generic errors in the reviewed controllers and disables `X-Powered-By`; Express stack exposure still depends on deployment setting `NODE_ENV=production`. Confirm this setting in every production environment. |
| 11 | CAPTCHA / bot protection | Not Applicable | Low | No public contact/lead form was found. Login and password-reset endpoints are abuse-prone, but shared rate limiting is the proportionate missing control; CAPTCHA is not added without evidence it is required. |
| 12 | Administrative audit logs | Needs Improvement | Medium | Admin-only user, inventory, pizza, and order operations exist, but no durable audit log was found. Record actor, action, target, timestamp, and outcome in an access-controlled log store before relying on the panel for regulated or sensitive operations. |
| 13 | Private storage buckets | Not Applicable | Low | No private user-file or cloud-storage workflow was found. Pizza images are intentionally served publicly by [index.js](./Server/index.js#L54); do not store sensitive files in that public path. |
| 14 | Administrative access protection | Already Secure | High — fixed | All non-public admin API endpoints now require a verified admin account; the upload route checks role before Multer writes a file. See [AdminRoutes.js](./Server/Routes/Admin/AdminRoutes.js#L50) and [AuthMiddleware.js](./Server/Middlewares/AuthMiddleware.js#L46). |
| 15 | Vulnerable dependencies | Needs Improvement | Critical / High / Medium | Compatible lockfile updates were applied without forcing major-version changes. Subsequent audits still reported: backend production tree 6 advisories (1 critical, 2 high, 3 moderate); admin tree 14 (2 high, 12 moderate); customer tree 15 (2 high, 13 moderate). Backend findings include `tar` (critical install-tree advisory) and `nodemailer` (high; remediation requires a major upgrade). Frontend findings include Vite/esbuild and React Router; fixes require major upgrades or further dependency review. |
| 16 | File-upload validation | Already Secure | High — fixed | Upload authorization precedes Multer; only JPEG/PNG/WebP with matching extension/MIME and file signatures are accepted, with a 5 MiB limit and generated filenames in [AdminRoutes.js](./Server/Routes/Admin/AdminRoutes.js#L50) and [ImageStorage.js](./Server/Services/ImageStorage.js#L26). Uploaded pizza images remain public intentionally. |
| 17 | AI-assisted security review | Already Secure | — | A separate security-review pass and follow-up code review were completed. No automated scanner or AI service was added to the application. |
| 18 | Security headers | Already Secure | Medium | The API sets CSP, `X-Content-Type-Options`, frame protection, `Referrer-Policy`, and `Permissions-Policy`, and emits HSTS in production in [index.js](./Server/index.js#L18). Confirm HSTS is only relied on when all production traffic is HTTPS. |
| 19 | Webhook signature verification | Not Applicable | Low | No inbound webhook endpoint or provider webhook integration was found. The Razorpay client payment flow verifies the HMAC signature in [RazorPay.js](./Server/Services/RazorPay.js#L21). |

## Confirmed vulnerabilities fixed

1. **High — admin order-data exposure:** Admin order routes accepted any valid account token; un-awaited `Admin.findById` checks did not enforce admin access. Admin routes now require an account verified as an admin, and the controller checks await their lookups.
2. **High — order IDOR and unauthorized refunds:** Customer order details, cancellation, refund, and payment-completion handlers previously looked up orders by ID alone. Queries and state changes now include the authenticated `userId`; cancellation state transitions are conditional and atomic.
3. **High — Socket.IO identity spoofing:** A socket client could supply an arbitrary `userId` query value and be treated as that account, including an admin. Sockets now validate the signed `pds` cookie, blocked-session list, account existence, password-change time, and database-derived role. Frontends no longer send identity claims in the socket query.
4. **High — upload before authorization and active-content risk:** Admin role verification now runs before file processing. Uploads are size-limited, get generated filenames, and must match an allowed image extension/MIME and recognized file signature before being served.
5. **Medium — customization-based underpricing:** Customizations now must reference available inventory of the correct category. Order placement recalculates each item and the total using current database prices rather than trusting the stored cart total.
6. **Medium — password-reset OTP guessing/replay:** OTP creation uses `crypto.randomInt`; incorrect attempts are atomically limited to five, OTPs are consumed once, and comparison is timing-safe. The user and admin flows are both covered.
7. **Medium — stale sessions after password changes:** HTTP and socket authentication reject tokens issued before `passwordChangedAt`. Password changes invalidate reset OTPs and issue a replacement cookie for the current session; logout waits for revocation persistence.
8. **Medium — payment verification scope:** Razorpay payment verification checks the authenticated user and a pending order owned by that user, performs a timing-safe signature comparison, and only updates the matching pending order.
9. **Low — missing API hardening and unsafe example secret:** Security headers were added, Express signature disclosure disabled, the example CORS variable corrected, and the example JWT key replaced with a generation placeholder. The actual `.env` file is ignored by Git.

## Remaining vulnerabilities and recommended actions

1. **Rate limiting — Medium:** Add shared, production-grade limits for login, signup, forgot-password, reset-password, and other public routes. Apply per-IP and per-account controls without relying on process-local memory.
2. **Dependencies — Critical/High/Medium:** Do not use `npm audit fix --force` blindly. Evaluate and test the required major upgrades, especially backend Nodemailer and the vulnerable install-tree `tar`, plus Vite/esbuild and React Router in both frontends. Re-run `npm audit` after selecting compatible versions.
3. **Administrative audit trail — Medium:** Persist sensitive admin actions to a restricted, tamper-resistant log destination; avoid logging passwords, tokens, or payment secrets.
4. **Deployment TLS/debug settings — Medium/Low:** Enforce HTTPS and HTTP-to-HTTPS redirect at the hosting/reverse-proxy layer; set `NODE_ENV=production`; set `CLIENT_URLS` to the exact deployed frontend origins and supply unique strong production secrets. The repository cannot verify these infrastructure settings.
5. **Database isolation — Medium:** Keep MongoDB inaccessible from public networks, use a least-privilege application account, and test that no other service or direct database credential bypasses application ownership checks.
6. **Input policy — Low:** Add consistent field-size/type/range validation where user-provided text and numbers are persisted, especially as new endpoints are introduced.

## Tests and verification

| Check | Result |
|---|---|
| `node --check` on all modified server JavaScript files | Passed |
| Admin frontend production build | Passed |
| Customer frontend production build | Passed |
| `git diff --check` | Passed |
| Focused ESLint on changed socket contexts | Existing lint errors: admin `react/prop-types`; customer `no-unused-vars` for an existing unused `Link` import and `react/prop-types`. The edits only removed the client-supplied socket identity query. |
| Server integration/auth tests | Not available: `Server/package.json` has a placeholder test script; no database-backed test harness or test fixtures are configured. Cross-account behavior therefore requires deployment/test-database integration tests. |
| Dependency audit | Completed after compatible lockfile updates; residual advisories are summarized in checklist item 15. |

## Manual deployment / infrastructure changes required

- Configure TLS and redirects at the hosting platform or reverse proxy. Verify production responses include HSTS and set `NODE_ENV=production`.
- Set `CLIENT_URLS` to a comma-separated exact allowlist of customer/admin frontend origins.
- Replace all example credentials with unique, high-entropy environment secrets; never deploy the JWT placeholder.
- Add shared API rate limiting and a durable administrator audit log.
- Restrict MongoDB network access and application credentials. Database-level row security is not implemented by Mongoose.
- Review current dependency advisories and plan tested major upgrades; no `--force` dependency update was applied.
