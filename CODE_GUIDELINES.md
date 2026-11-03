# Code Guidelines

These guidelines preserve the existing React, Express, and Mongoose stack and
favor incremental changes over architectural rewrites.

## Naming and organization

- Use PascalCase for React component files and component functions, for example
  `UserHeader.jsx`.
- Use camelCase for functions and variables; use descriptive names that express
  the role of the value.
- Keep server route files in `Routes/`, HTTP handlers in the appropriate
  `Controllers/` feature, schemas in `db/models/`, and provider or filesystem
  integrations in `Services/`.
- Keep shared UI primitives in `components/ui/`; keep feature-only UI close to
  its feature.
- Use focused utility modules named for one responsibility. Avoid adding
  unrelated exports to general-purpose files.
- Preserve the established naming and imports in nearby files when making a
  small change; avoid unrelated repository-wide renames.

## Module and SOLID practices

- Give components, controllers, services, and helpers one primary reason to
  change (SRP).
- Extend behavior through focused feature modules or explicit options when that
  avoids destabilizing existing flows (OCP); do not add patterns without a
  concrete need.
- Keep consumers dependent on the smallest useful contract. Prefer functions
  and composition over inheritance for this codebase.
- Keep provider-specific APIs and filesystem details in services; keep route
  registration declarative and business/presentation logic out of route files
  (DIP and separation of concerns).
- Avoid circular imports and avoid reaching into another feature's internal
  implementation.
- Reuse a helper only when the behavior and contract are genuinely shared.
  Similar-looking flows may differ in meaningful business rules.

## React and frontend conventions

- Keep visual rendering in components and move reusable stateful behavior to a
  hook or store only when it has a clear owner.
- Use the existing Axios client and endpoint constants for API requests.
- Keep navigation and authorization gates consistent with the SPA's existing
  route setup.
- Preserve current layout, responsive behavior, copy, and interaction patterns
  unless the task explicitly changes UX.
- Avoid duplicating derived state; derive values from the existing store or
  current props where practical.

## API, data, and integrations

- Keep Express routes responsible for HTTP method/path and middleware
  composition. Put request handling in controllers and provider interactions
  in services.
- Validate identifiers and required input before database writes. Preserve the
  current response status codes and payload shapes when refactoring.
- Keep database reads/writes in the existing Mongoose model/controller flow;
  introduce repositories only to address a demonstrated need.
- Preserve cookie names, authentication behavior, database schemas, and payment
  lifecycle semantics. Treat changes to these as compatibility-sensitive.
- Do not log credentials, tokens, payment secrets, or other sensitive values.
- Add environment variables to the matching `.env.example`; never commit actual
  secrets.

## Error handling

- Return or await asynchronous work so failures are not detached from the
  request that initiated it.
- Return immediately after sending an error response to prevent later work from
  continuing.
- Log useful server-side context without exposing sensitive data, and return a
  deliberate HTTP status and existing-compatible response body.
- Avoid empty `catch` blocks, broad success-shaped fallbacks, and silently
  swallowed errors. When touching a legacy handler with these patterns, fix the
  relevant error path without changing unrelated behavior.

## Verification and contributions

- Run the affected frontend's `npm run lint` and `npm run build`.
- The server currently has no automated test suite. Run syntax checks and add
  focused tests for new business logic or compatibility-sensitive workflows
  when a suitable test setup exists; do not treat the placeholder `npm test`
  command as a passing suite.
- For changes spanning the UI and API, verify the request contract and the
  user/admin workflows they affect.
- Keep changes incremental and reviewable. Update architecture or structure
  documentation when responsibilities or files move.
