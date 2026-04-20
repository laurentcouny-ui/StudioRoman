# PRIVACY — Data processing in Studio Roman

Studio Roman is designed as a **desktop/local-first** application.

## Scope

- No central account is required to use the core app.
- Main user data is stored locally (SQLite + local files).
- Optional cloud backup integrations (Google Drive / Dropbox) are user-initiated.

## User rights endpoints (backend)

To support portability and local data deletion in a contributor-ready way:

- `GET /api/v1/user/export`
  - Returns a JSON export payload of local primary data (current scope: characters + bible entries).
  - Response is sent as JSON attachment.

- `DELETE /api/v1/user/me`
  - Deletes local user data from primary backend tables (current scope: characters + bible entries).
  - Returns deletion summary counts.

## Important limitations

- Context is local-first desktop, not multi-tenant SaaS.
- These endpoints operate on **local workstation data**.
- Optional third-party backup providers are governed by their own privacy policies.

## Security baseline

- API can be loopback-only (`scriptor.api.loopback-only=true`).
- Token protection can be enforced (`scriptor.api.require-token=true`).
- Rate limiting is enabled by default for IA mutating endpoints.

## Contact

For privacy questions, use project maintainers and issue tracker policy.
