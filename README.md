# Internal Accounts Payable Workflow System

A production-oriented Next.js application that converts SVI's Request for Payment form into an authenticated, database-backed request-to-close workflow. The original PDF terminology, ten-row first page, payment choices and signature blocks are preserved; workflow, validation, storage and audit controls run server-side.

## Quick start

Requirements: Node.js 22+, Docker with Compose, and a modern browser.

```powershell
Copy-Item .env.example .env
docker compose up -d db
npm ci
npm run db:setup
npm run dev
```

Open `http://localhost:3000`. All demo accounts use `DemoPass!2026`:

- `requester1@svi.demo`
- `approver@svi.demo`
- `ap@svi.demo`
- `reviewer@svi.demo`
- `admin@svi.demo`
- `auditor@svi.demo`

The sign-in screen also provides a one-click picker for every demo role. The seed stores role-to-permission grants in PostgreSQL and creates requests across the full workflow—from draft and approval through QuickBooks, payment, reconciliation, and close—so each queue can be exercised immediately.

Change or remove every seeded credential before a shared deployment.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

The database schema is in `prisma/schema.prisma`; the immutable initial migration is in `prisma/migrations/202609300001_initial/migration.sql`. Use `npm run pdf:inspect -- "..\Internal AP Accounting Document.pdf"` to safely enumerate legacy fields without executing PDF JavaScript.

## Key controls

- Argon2 password hashes, signed HTTP-only sessions, role and record-level checks.
- PostgreSQL decimals and server-recalculated totals.
- Explicit state-machine transitions with comments and role checks.
- Version-aware attestations, approvals, generated PDFs and exports.
- Private file repository keys, checksum verification, type/size validation and malware-scanner seam.
- Append-only audit API surface; no audit update/delete action.
- Mock/local repository and QuickBooks CSV produce real artifacts without claiming an external posting.

## Deployment

Set production secrets through the platform secret store, terminate TLS at the ingress, use managed PostgreSQL, object storage encryption, malware scanning, scheduled database backups, and a worker process for `IntegrationJob`. Run `prisma migrate deploy` once per release before switching traffic. See `docs/deployment.md` and `docs/security.md`.

## Documentation

- [docs/application-features.md](docs/application-features.md) — end-to-end guide to the app's request, workflow, settings, import/export, notifications, audit, and reporting features.
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/workflow.md`
- `docs/security.md`
- `docs/integrations.md`
- `docs/pdf-field-mapping.md`
- `docs/role-permission-matrix.md`
- `docs/api.md`
- `docs/deployment.md`
- `docs/backup-recovery.md`
- `docs/known-limitations.md`
