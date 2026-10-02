# Security

- Argon2id-compatible password hashing through `argon2`; session cookies are HTTP-only, same-site and secure in production.
- Server-side role and record-level access checks cover company scope, ownership, assignment and restricted payroll access.
- Zod validates form payloads; Prisma parameterizes database access; React escapes rendered values.
- Security headers include CSP, frame denial, MIME sniff prevention and restrictive browser permissions.
- Uploads use an allow-list, size limit, safe generated storage keys, SHA-256 duplicate checks and a malware-scanner status. Production must connect a real scanner and deny downloads until `CLEAN` where policy requires.
- Storage paths and credentials are never exposed. Banking/mobile references are masked; deployments should encrypt `encryptedDetails` with a managed KMS envelope key.
- Rate limiting should be enforced at ingress and backed by Redis for multi-instance deployments.
- Audit events have no application update/delete path. Database roles should deny those operations to the application role after insert.
- Secrets belong in a secret manager, never `.env` in source control. Rotate `AUTH_SECRET`, database, S3, email and QuickBooks credentials.
- Retention and legal hold are configuration responsibilities; document erasure jobs must preserve required audit tombstones.

