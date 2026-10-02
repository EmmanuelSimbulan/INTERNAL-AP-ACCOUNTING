# Phased implementation plan

## Increment 1 - Foundation

- Next.js App Router, TypeScript, Tailwind-style design tokens, Prisma/PostgreSQL, Docker Compose.
- Auth.js authentication, Argon2 password verification, session claims, RBAC and record-level authorization.
- Complete data model, initial migration, safe seed data, environment validation.

## Increment 2 - Request for Payment

- PDF-faithful header and field order, dynamic accounting lines, decimal-safe totals, conditional payment details and document rules.
- Draft/save/copy/submit/withdraw, version snapshots, requester attestation, permanent numbering, attachment metadata.
- Server-side validation and immutable audit/status history.

## Increment 3 - Approval and AP workflow

- Version-aware manager approval, return/reject/resubmit, comments, self-approval prevention.
- AP queue and validation workbench, original versus adjusted mappings, holds and accounting-review gates.
- Explicit permission checks and transactional state-machine transitions.

## Increment 4 - Documents and integrations

- Letter-size branded PDF, ten-row first page, continuation pages, signatures, verification code, hashes and versioning.
- Repository interface with local and S3-compatible implementations, retryable jobs and failure status.
- QuickBooks adapter with validated CSV/mock export, preview, checksum and duplicate-post prevention.

## Increment 5 - Payment, reconciliation, operations

- Multiple payments/evidence, reconciliation and variance controls, closure guards.
- Role-aware dashboards, global search, reports/CSV, notifications, timeline, administration screens.
- Unit, authorization, workflow, PDF and browser end-to-end tests.

## Verification gates

Each increment must pass lint, TypeScript, unit tests, Prisma validation/migration checks and production build. The generated PDF is rendered or independently inspected for field presence, pagination, clipping risks, hashes and signature accuracy.

## Phase 2

Enterprise SSO, live GFS protocol, live S3, QuickBooks Online OAuth/API, email delivery, delegation/escalation scheduling, legacy AcroForm import review, configurable template designer and expanded operational reports.

## Phase 3 design seams

OCR, suggestion-only AI, bank feeds, automatic reconciliation proposals, budgets, PO matching, portal/mobile clients and cryptographic signatures remain human-confirmed and adapter-driven.
