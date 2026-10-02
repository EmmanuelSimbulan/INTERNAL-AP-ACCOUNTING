# Architecture

The application uses Next.js App Router with server components for reads and server actions/route handlers for mutations and authorized downloads. Auth.js issues signed, HTTP-only sessions. Prisma mediates PostgreSQL access. Financial and workflow rules are framework-independent modules under `src/lib`.

```text
Browser -> Next.js UI -> Auth/RBAC -> Server actions -> Domain validation/state machine
                                             |       -> Prisma -> PostgreSQL
                                             |       -> Repository adapter -> local/S3/GFS
                                             |       -> PDF generator -> immutable document version
                                             +       -> QuickBooks adapter -> CSV/mock/QBO
Background worker <- IntegrationJob retry/dead-letter queue
```

Trust boundaries exist at authentication, every record load, uploads, generated artifacts and external adapters. UI visibility is never the authorization mechanism. Mutations use database transactions; sequence allocation uses serializable transactions and unique constraints.

The local repository is private to the server and files are returned through authorization handlers. Production should use an encrypted S3-compatible bucket with object lock/versioning or the approved GFS API.

