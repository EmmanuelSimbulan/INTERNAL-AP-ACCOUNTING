# Backup and recovery

- PostgreSQL: encrypted daily snapshots plus continuous WAL/PITR; retain per policy and test restore quarterly.
- Object repository: bucket versioning/object lock or equivalent GFS retention; replicate to a separate failure domain.
- Secrets and configuration: export encrypted configuration metadata, not plaintext secrets.
- Recovery order: database, repository, application, integration worker, then external reconciliation.
- After restore, compare `GeneratedDocument`, `SupportingDocument`, `QuickBooksExport` and repository checksums; pause outbound posting/payment until reconciliation passes.
- Recovery drills must prove target RPO/RTO, sequence uniqueness, idempotent job replay and audit continuity.

