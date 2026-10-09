# Application Feature Guide

This guide describes the user-facing features available in the Internal AP Accounting application. The supported entry point is `/prototype`; the site root redirects there. The guide focuses on the current prototype workflow and notes where a feature is simulated or depends on environment setup.

## Roles and navigation

The prototype provides a role/profile selector for Requester, Approver, AP Processor, AP Reviewer, Administrator, and Auditor. It is useful for exercising role-specific screens during UAT, but it is not authentication: selecting a profile is not proof of identity and does not replace production sign-in or server-side authorization. The application also contains authenticated server actions for the normalized application flows; see [API](api.md), [security](security.md), and [role/permission matrix](role-permission-matrix.md).

The main prototype areas are the dashboard, request queue, request creation and detail views, reports, configuration settings, notifications, and audit trail. Administrators and accounting roles see additional controls according to the selected prototype profile.

## Dashboard and request queue

The dashboard summarizes request activity and status, recent requests, and workflow progress. Use the recent-request Show all action to open the full queue.

The request queue supports searching by request number, payee, requester, nature of payment, invoice number, or company; filtering by company, date range, and status; and sorting by date or company. The queue adapts to the selected role, including approval and accounting work queues. Authorized prototype profiles can edit supported fields inline or apply bulk edits with a reason. Bulk changes are validated and recorded in the activity/audit data. A request can be opened to inspect its details, documents, and workflow history.

## Creating an AP request

The New Request form collects company, request date, currency, payee/vendor, nature of payment, invoice information, and one or more expense lines. Payee choices respect the vendor's configured currency (PHP, USD, or both). Company-dependent form headings and request numbering follow the selected company.

Each expense line includes a project code, chart-of-accounts/expense account, particulars, and amount. Account options are filtered by the selected project code using the account-to-project-code assignments in Settings. Changing the project code clears an account selection that is no longer applicable. The server validates the project/account pair as well, so a stale or manually altered combination is rejected.

The request number is predicted from the current numbering sequence and finalized with server-side sequencing when saved, so concurrent requests do not rely solely on a browser-generated number. USD requests include an FX conversion rate based on the BSP rate feed configured by the application; the rate and source information are stored with the request. If that feed is unavailable, USD submission may be blocked rather than silently using an invented rate.

Supporting documents can be attached to a request. The authenticated upload flow accepts multiple files in one submission, checks file constraints and duplicate content, and records scan status. The prototype UI persists its workspace state separately; do not treat its browser-selected role as a security boundary.

## Approval and processing workflow

The standard path is:

`Requester -> Manager/Approver -> AP Processor (validation) -> AP Reviewer (second review) -> AP Processor (CSV and posting) -> payment/recipient and close-out steps`

The request detail view exposes the next action appropriate to the current workflow stage and role. Actions include approval, return for correction, rejection, AP validation, reviewer decision, generation of the accounting CSV/posting step, and later payment/reconciliation/closure actions where configured. The request timeline shows status progression and actor/action history. Where available, the user can undo or return the most recent workflow action; this is a controlled workflow action, not a general database rollback.

Each request retains a snapshot of the workflow selected at submission. Workflow changes are intended to affect new submissions or resubmissions rather than silently rewriting in-flight approvals. See [workflow](workflow.md) for the state model and transition rules.

## Workflow configuration

Administrators and authorized accounting profiles can configure workflows by Nature of Payment. The editor supports role/stage nodes, movable diagram layout, connecting and removing arrows, branching to multiple next steps, and conditional paths such as amount thresholds. Workflow controls can enable or bypass selected approval/validation stages and configure accounting-review thresholds and service targets. Diagram edges define the path; the timeline remains step-by-step for each request. The workflow implementation bounds repeated-cycle traversal to avoid an uncontrolled loop.

The canonical starting path keeps the accounting duties separate: requester submission, manager approval, AP Processor validation, AP Reviewer approval, and return to AP Processor for final CSV generation/posting.

## Settings and master data

Settings presents independent, vertically arranged sections for Project Codes, Accounts/Chart of Accounts, Payees/Vendors, and Nature of Payment. Each section has its own add/edit and save interactions with a visible save confirmation; there is no single page-wide save operation.

- **Project Codes:** add, edit, and remove codes used on expense lines.
- **Accounts:** manage expense accounts and assign multiple Project Codes to each account. The many-to-many mapping drives the New Request account filter. Select All and Clear All speed up assignment.
- **Payees/Vendors:** manage vendors and their supported currency, including PHP, USD, and both where supported. Currency is a vendor attribute, not a separate configuration.
- **Nature of Payment:** manage the payment categories that drive request classification and configurable workflows.

Each configuration type has its own CSV template, import, preview, and export. Import preview distinguishes new, existing, duplicate, invalid, and empty rows and surfaces validation errors. Existing values are not silently overwritten; invalid and duplicate rows are not inserted. Templates and exports use the fields supported by the existing configuration model. In particular, vendor currency is part of Payees/Vendors import/export, and account exports/imports can include applicable Project Codes. These prototype configuration endpoints use the selected profile; production authorization must be enforced through the authenticated API layer.

## Notifications, audit, and reports

Notifications surface work that is waiting for the current role/profile, such as a manager decision or an accounting review, and provide the next supported action from the notification experience. Availability is tied to request workflow state and the active profile.

The audit trail records request/configuration activity with actor, action, and relevant before/after changes where available. The audit view is intended for Administrator, Auditor, and accounting roles. In a fresh local database, audit access may require provisioned `User` and `Role` records even though the prototype workspace itself can initialize without seeded users.

Reports summarize workflow status, payment amounts, nature-of-payment totals, and activity over time. They reflect the data available in the active workspace/database.

## Exports and integrations

The request detail workflow can generate a QuickBooks-compatible CSV using the shared SaaSAnt bill CSV formatter, so the CSV produced by the final AP processing action matches the dedicated SaaSAnt Bill CSV export. Invoice PDFs and supporting-document downloads are available where the request has the necessary data/files. The exact CSV field mapping is documented in [PDF/CSV field mapping](pdf-field-mapping.md) and [integrations](integrations.md).

## Data, local use, and production

The prototype workspace is stored as a JSON state record in the configured database, with request transactions and audit events persisted through the application APIs. A new local PostgreSQL database starts with an empty workspace and default master-data initialization; it does not automatically copy data from Neon or another environment. Local database files and connection secrets are intentionally excluded from Git. To use the app locally, configure the local `DATABASE_URL`, apply Prisma migrations, and start the application using the repository's normal scripts. See [deployment](deployment.md), [data model](data-model.md), and [backup/recovery](backup-recovery.md).

The prototype role selector and prototype API profile checks are for UAT interaction and should not be presented as production-grade identity or RBAC. Before production use, configure the authenticated identity provider, provision roles/users, secure database credentials, and verify backend authorization for every write and export operation. See [security](security.md) and [known limitations](known-limitations.md).

## Related documentation

- [Architecture](architecture.md)
- [API and server actions](api.md)
- [Data model](data-model.md)
- [Workflow](workflow.md)
- [Role/permission matrix](role-permission-matrix.md)
- [Security](security.md)
- [Integrations](integrations.md)
- [Deployment](deployment.md)
- [Known limitations](known-limitations.md)
