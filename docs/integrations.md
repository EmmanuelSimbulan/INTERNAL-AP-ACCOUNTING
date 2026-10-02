# Integrations

## Repository

`RepositoryAdapter` supports `put`, `get` and health checks. `LocalRepositoryAdapter` is working for development. S3 and GFS implementations deliberately fail closed until endpoint, authentication and protocol details are configured. `RepositoryRecord` and `IntegrationJob` support idempotency, checksums, attempts, errors and retry/dead-letter handling.

## QuickBooks

The working mock produces a human-readable, versioned CSV with checksum after validating every account/project mapping and total. `QuickBooksPosting` is unique per request and the external transaction ID is unique, preventing duplicate posting. A live QBO adapter must use OAuth, idempotency keys and API-confirmed posting before changing status.

## Email

The Phase 1 adapter target is structured notification logging plus in-app notifications. Connect the Phase 2 provider using metadata-only templates; never include payroll, bank or employee confidential details.

## Malware scanning and jobs

Uploads have a scan status and fail-closed integration point. A worker should claim due `IntegrationJob` rows with a lease, use exponential backoff and move exhausted work to `DEAD_LETTER`. Administrators can inspect failures; retry must preserve idempotency keys.

