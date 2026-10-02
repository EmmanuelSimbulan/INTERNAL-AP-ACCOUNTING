# Assumptions

1. The repository was empty on 30 September 2026. The requested empty-repository stack is therefore authoritative.
2. PostgreSQL is the production datastore. Docker Compose provides the local instance; tests isolate pure domain logic and do not require production credentials.
3. Company and accounting administrators own master data. Historical labels are snapshotted on request versions so later renames do not rewrite history.
4. Monetary values are stored as PostgreSQL `Decimal(19,4)` and handled as decimal strings/`decimal.js`, never JavaScript floating point.
5. Phase 1 uses credential-based demonstration authentication. Passwords are Argon2 hashes and sessions are signed, HTTP-only cookies. Enterprise SSO is a deployment integration.
6. The local repository adapter writes outside the public web root and serves files only through authorized handlers. S3 and GFS adapters are interfaces/configuration until credentials and protocols are supplied.
7. The QuickBooks mock creates versioned CSV output and requires an explicit manual-posting record; it never claims an API posting occurred.
8. Request submission routes to the seeded company approver. Rule evaluation is deterministic by company, amount, payment type, department, and priority.
9. The supplied PDF is reference data only. Embedded actions and JavaScript are never executed or copied into generated documents.
10. PDF generation uses a controlled server-side layout with ten rows on page one and continuation pages. The legacy form dictionary is documentation, not appended output.
11. “Requestor” is retained only in user-visible/PDF labels; internal identifiers use `requester`.
12. Sensitive demo values are fictitious. Full card and bank numbers are never accepted; mobile/bank references are encrypted-capable fields and masked in views.
13. Actual malware scanning is represented by a fail-closed adapter contract; the local adapter marks uploads `PENDING` unless the development mock scanner is enabled.
14. Email delivery, real GFS, real S3, and QuickBooks Online require deployment credentials and remain adapter-backed Phase 2 integrations.
15. Approval invalidation creates new version-aware assignments; immutable decisions and earlier request versions remain readable to authorized users.

