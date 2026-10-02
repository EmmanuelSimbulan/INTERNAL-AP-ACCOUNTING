# Deployment

1. Provision PostgreSQL 17 with encryption, PITR and an application role without schema-owner privileges.
2. Provision private S3-compatible storage/GFS, KMS keys, malware scanning, email and optional QBO OAuth application.
3. Set `.env.example` variables in the deployment secret manager. Generate at least 32 random bytes for `AUTH_SECRET` and encryption keys.
4. Build the immutable container: `docker build -t svi-iap:<version> .`.
5. Run `npx prisma migrate deploy` as a one-off release job.
6. Run smoke checks, then start the application and job worker behind TLS ingress/WAF.
7. Seed only disposable environments. Production users should come from SSO/controlled provisioning.
8. Monitor HTTP errors, authentication failures, job failures, repository health, queue age and database capacity.

Rollback the application image independently. Database rollback uses a reviewed forward-fix migration; never automatically reverse a migration containing financial records.

