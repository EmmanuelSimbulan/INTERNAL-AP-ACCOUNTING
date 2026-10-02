# Legacy PDF field mapping

The source `Internal AP Accounting Document.pdf` was inspected as data with `pdf-lib`. It has two pages and 50 canonical AcroForm fields. No embedded JavaScript or action is executed or used by this application.

| Application field | Legacy AcroForm name | Notes |
|---|---|---|
| `request.requesterDisplayName` | `REQUESTOR` | PDF spelling retained |
| `request.payeeDisplayName` | `PAYEE` | Visible payee name only |
| `request.companyName` | `COMPANY NAME` | Legacy dropdown; app uses configured company |
| `request.requestDate` | `Date_af_date` | Server-formatted business date |
| `request.currency` | `CURRENCY` | Legacy dropdown |
| `request.natureOfPayment` | `NATURE OF PAYMENT` | Legacy radio group |
| `request.paymentOtherText` | `OTHER` | Required for Other |
| `request.totalAmount` | `AMOUNTTOTAL AMOUNT` | Recalculated server-side |
| `request.requesterAttestation` | `REQUESTOR'S SIGNATURE` | Rendered electronic-attestation block, not copied signature data |
| `request.approverAttestation` | `APPROVER'S SIGNATURE` | Rendered only after approval |
| `lines[n].projectCode` | `PROJECT CODERow1` ... `PROJECT CODERow10` | First ten lines |
| `lines[n].account` | `ACCOUNTRow1` ... `ACCOUNTRow10` | First ten lines |
| `lines[n].particulars` | `PARTICULARSRow1` ... `PARTICULARSRow10` | Wraps without truncation |
| `lines[n].amount` | `AMOUNTRow1` ... `AMOUNTRow10` | Decimal-formatted |

Lines 11 onward are placed on controlled continuation pages. The generated document is not dependent on the legacy field tree, appearance streams, calculations, or scripts.
