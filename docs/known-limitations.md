# Known limitations and Phase 2 recommendations

- Live GFS, S3, email and QuickBooks Online require organization-specific credentials/protocols. Phase 1 ships fail-closed interfaces and working local/CSV mocks.
- Credential login is for the runnable baseline; deploy enterprise SSO/MFA before production.
- The environment used to build this repository did not expose Docker, so PostgreSQL container startup and browser E2E execution require a developer/CI host with Docker and Playwright browsers.
- Legacy PDF import is designed but deferred to Phase 2. The source field map and safe inspector are included.
- The PDF uses the controlled SVI text mark because no separately licensed logo image was supplied. Administrators can connect an approved branding asset.
- Advanced parallel approvals, delegation scheduling, reminders/escalations, PDF template designer and cryptographic signatures are Phase 2.
- Rate limiting and background workers need the deployment platform's Redis/queue/ingress services for multi-instance operation.

