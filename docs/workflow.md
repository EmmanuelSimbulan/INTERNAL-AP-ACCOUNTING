# Workflow

The default state machine is implemented in `src/lib/workflow.ts`. Every transition is allow-listed by source status and role. Return/rejection/hold require comments. Self-approval is checked server-side.

Draft submission allocates a permanent number, records the requester attestation, creates a version-specific assignment and writes status/audit events in one serializable transaction. Material changes are identified by the significant-field policy and require approval invalidation plus new assignments. AP validation may route to accounting review or document generation according to company configuration.

Closure requires a confirmed posting, paid total, settled total and approved zero/accepted variance. A QuickBooks file alone never marks a request posted. Human confirmation remains mandatory for approval, posting, payment, reconciliation and closure.

