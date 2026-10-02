# API and action surface

Most mutations are Next.js server actions and require an authenticated session plus a role/record check.

| Operation | Entry point | Authorization |
|---|---|---|
| Sign in | `POST /api/auth/*` | Credentials + active user |
| Create/save/submit request | `createRequestAction` | Requester/Admin |
| Approval decision | `decisionAction` | Assigned Approver/Admin; self-approval denied |
| Status transition | `transitionAction` | State-machine role + record scope |
| Upload document | `uploadDocumentAction` | Authorized record reader, file validation |
| Download document | `GET /api/documents/:id` | Record-level access; no raw path |
| Generate PDF | `generatePdfAction` | AP Processor/Admin |
| Generate QB CSV | `quickBooksAction` | AP Processor/AP Reviewer |
| Record payment | `recordPaymentAction` | AP Processor/Admin; posting prerequisite |
| Reconcile | `reconcileAction` | AP Processor/AP Reviewer/Admin |
| CSV report | `GET /api/reports/requests.csv` | Reporting roles |

Errors are sanitized at the platform boundary in production. External APIs should add structured problem responses, request IDs, rate limiting and OpenAPI generation.

