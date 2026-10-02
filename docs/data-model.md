# Data model

```mermaid
erDiagram
  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : grants
  ROLE ||--o{ ROLE_PERMISSION : contains
  PERMISSION ||--o{ ROLE_PERMISSION : maps
  COMPANY ||--|| COMPANY_BRANDING : brands
  COMPANY ||--o{ REQUEST : owns
  USER ||--o{ REQUEST : requests
  PAYEE ||--o{ REQUEST : receives
  NATURE_OF_PAYMENT ||--o{ REQUEST : classifies
  REQUEST ||--o{ REQUEST_VERSION : versions
  REQUEST ||--|{ REQUEST_LINE : contains
  REQUEST ||--o{ SUPPORTING_DOCUMENT : supports
  SUPPORTING_DOCUMENT ||--o{ DOCUMENT_VERSION : versions
  REQUEST ||--o{ APPROVAL_ASSIGNMENT : routes
  APPROVAL_ASSIGNMENT ||--o{ APPROVAL_DECISION : decides
  REQUEST ||--o{ GENERATED_DOCUMENT : generates
  REQUEST ||--o{ ACCOUNTING_ADJUSTMENT : adjusts
  REQUEST ||--o{ QUICKBOOKS_EXPORT : exports
  REQUEST ||--o| QUICKBOOKS_POSTING : posts
  REQUEST ||--o{ PAYMENT : pays
  REQUEST ||--o| RECONCILIATION : reconciles
  REQUEST ||--o{ STATUS_HISTORY : transitions
  REQUEST ||--o{ AUDIT_EVENT : audits
```

All monetary columns use `Decimal(19,4)`. Master data is deactivated instead of destructively removed. Request versions contain snapshots. Approval assignments and decisions carry the request version. Generated artifacts use unique `(request, type, version)` constraints and SHA-256 hashes.

