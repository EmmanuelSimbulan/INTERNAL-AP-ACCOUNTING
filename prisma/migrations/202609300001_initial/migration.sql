-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('REQUESTER', 'APPROVER', 'AP_PROCESSOR', 'AP_REVIEWER', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'RETURNED_FOR_REVISION', 'RESUBMITTED', 'REJECTED', 'MANAGER_APPROVED', 'PENDING_AP_VALIDATION', 'RETURNED_BY_AP', 'ON_HOLD', 'PENDING_ACCOUNTING_REVIEW', 'ACCOUNTING_APPROVED', 'READY_FOR_DOCUMENT_GENERATION', 'DOCUMENT_GENERATED', 'REPOSITORY_SAVE_PENDING', 'REPOSITORY_SAVE_FAILED', 'READY_FOR_QUICKBOOKS', 'QUICKBOOKS_FILE_GENERATED', 'QUICKBOOKS_POSTING_PENDING', 'POSTED_TO_QUICKBOOKS', 'PAYMENT_SCHEDULED', 'PAYMENT_PROCESSING', 'PAID', 'RECONCILIATION_PENDING', 'RECONCILED', 'CLOSED', 'CANCELLED', 'INTEGRATION_ERROR');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APPROVED', 'RETURNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'REJECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "Confidentiality" AS ENUM ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED_PAYROLL', 'RESTRICTED_BANKING');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "RepositoryStatus" AS ENUM ('PENDING', 'STORED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "departmentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "companyId" TEXT,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'PHP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBranding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "legalDisplayName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "fax" TEXT,
    "logoStorageKey" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#111827',
    "pdfAfterApValidation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProjectCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qbAccountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingClass" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AccountingClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NatureOfPayment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NatureOfPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NatureOfPaymentRule" (
    "id" TEXT NOT NULL,
    "natureOfPaymentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "ruleType" TEXT NOT NULL,
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NatureOfPaymentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "externalRef" TEXT,
    "maskedBankRef" TEXT,
    "encryptedDetails" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Payee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "draftIdentifier" TEXT NOT NULL,
    "requestNumber" TEXT,
    "invoiceNumber" TEXT,
    "apvNumber" TEXT,
    "companyId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "departmentId" TEXT,
    "payeeId" TEXT NOT NULL,
    "natureOfPaymentId" TEXT NOT NULL,
    "paymentOtherText" TEXT,
    "requestDate" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "totalAmount" DECIMAL(19,4) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'INTERNAL',
    "conditionalData" JSONB,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestVersion" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "projectCodeId" TEXT,
    "projectCodeText" TEXT,
    "accountId" TEXT,
    "accountText" TEXT,
    "particulars" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "adjustedProjectCodeId" TEXT,
    "adjustedAccountId" TEXT,
    "qbClass" TEXT,
    "departmentCode" TEXT,
    "costCenterCode" TEXT,
    "customerProject" TEXT,
    "taxCode" TEXT,

    CONSTRAINT "RequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestAttestation" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "textVersion" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "sessionIdHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportingDocument" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "safeFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'INTERNAL',
    "scanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupportingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "conditions" JSONB NOT NULL,
    "stageKeys" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStage" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "requiredRole" "RoleCode" NOT NULL,
    "threshold" DECIMAL(19,4),

    CONSTRAINT "ApprovalStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAssignment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "assignedById" TEXT,
    "requestVersion" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "Decision" NOT NULL,
    "comment" TEXT,
    "attestationText" TEXT,
    "attestationVersion" TEXT,
    "requestVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL,
    "delegatorId" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "resetPeriod" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryRecord" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "localObjectId" TEXT NOT NULL,
    "destinationRef" TEXT,
    "checksum" TEXT NOT NULL,
    "status" "RepositoryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingAdjustment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "lineId" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "mappingType" TEXT NOT NULL,
    "sourceValue" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AccountingMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickBooksExport" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuickBooksExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickBooksPosting" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "externalTransactionId" TEXT,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "postingDate" DATE NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,
    "evidenceStorageKey" TEXT,
    "postedById" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuickBooksPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "method" TEXT NOT NULL,
    "dueDate" DATE,
    "paidAt" TIMESTAMP(3),
    "reference" TEXT,
    "maskedBankReference" TEXT,
    "batch" TEXT,
    "processedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvidence" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "bankReference" TEXT,
    "settlementDate" DATE,
    "requestedAmount" DECIMAL(19,4) NOT NULL,
    "postedAmount" DECIMAL(19,4) NOT NULL,
    "paidAmount" DECIMAL(19,4) NOT NULL,
    "settledAmount" DECIMAL(19,4) NOT NULL,
    "variance" DECIMAL(19,4) NOT NULL,
    "varianceReason" TEXT,
    "evidenceStorageKey" TEXT,
    "reconciledById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recordType" TEXT,
    "recordId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "requestVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_companyId_key" ON "UserRole"("userId", "roleId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBranding_companyId_key" ON "CompanyBranding"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_code_key" ON "Department"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCode_companyId_code_key" ON "ProjectCode"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Account_companyId_code_key" ON "Account"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingClass_code_key" ON "AccountingClass"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_code_key" ON "CostCenter"("code");

-- CreateIndex
CREATE UNIQUE INDEX "NatureOfPayment_code_key" ON "NatureOfPayment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "NatureOfPaymentRule_natureOfPaymentId_key_key" ON "NatureOfPaymentRule"("natureOfPaymentId", "key");

-- CreateIndex
CREATE INDEX "Payee_companyId_displayName_idx" ON "Payee"("companyId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Request_draftIdentifier_key" ON "Request"("draftIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "Request_requestNumber_key" ON "Request"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Request_invoiceNumber_key" ON "Request"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Request_apvNumber_key" ON "Request"("apvNumber");

-- CreateIndex
CREATE INDEX "Request_companyId_status_createdAt_idx" ON "Request"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Request_requesterId_status_idx" ON "Request"("requesterId", "status");

-- CreateIndex
CREATE INDEX "Request_payeeId_requestDate_idx" ON "Request"("payeeId", "requestDate");

-- CreateIndex
CREATE UNIQUE INDEX "RequestVersion_requestId_version_key" ON "RequestVersion"("requestId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RequestLine_requestId_position_key" ON "RequestLine"("requestId", "position");

-- CreateIndex
CREATE INDEX "RequestAttestation_requestId_requestVersion_idx" ON "RequestAttestation"("requestId", "requestVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SupportingDocument_storageKey_key" ON "SupportingDocument"("storageKey");

-- CreateIndex
CREATE INDEX "SupportingDocument_requestId_category_idx" ON "SupportingDocument"("requestId", "category");

-- CreateIndex
CREATE INDEX "SupportingDocument_sha256_idx" ON "SupportingDocument"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStage_workflowId_key_key" ON "ApprovalStage"("workflowId", "key");

-- CreateIndex
CREATE INDEX "ApprovalAssignment_approverId_completedAt_dueAt_idx" ON "ApprovalAssignment"("approverId", "completedAt", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_storageKey_key" ON "GeneratedDocument"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_requestId_type_version_key" ON "GeneratedDocument"("requestId", "type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequence_companyId_kind_periodKey_key" ON "NumberSequence"("companyId", "kind", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryRecord_adapter_objectType_localObjectId_key" ON "RepositoryRecord"("adapter", "objectType", "localObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingMapping_companyId_mappingType_sourceValue_key" ON "AccountingMapping"("companyId", "mappingType", "sourceValue");

-- CreateIndex
CREATE UNIQUE INDEX "QuickBooksExport_requestId_version_key" ON "QuickBooksExport"("requestId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "QuickBooksPosting_requestId_key" ON "QuickBooksPosting"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "QuickBooksPosting_externalTransactionId_key" ON "QuickBooksPosting"("externalTransactionId");

-- CreateIndex
CREATE INDEX "Payment_requestId_status_idx" ON "Payment"("requestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_requestId_key" ON "Reconciliation"("requestId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "StatusHistory_requestId_createdAt_idx" ON "StatusHistory"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_requestId_createdAt_idx" ON "AuditEvent"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationJob_status_runAfter_idx" ON "IntegrationJob"("status", "runAfter");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBranding" ADD CONSTRAINT "CompanyBranding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCode" ADD CONSTRAINT "ProjectCode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NatureOfPaymentRule" ADD CONSTRAINT "NatureOfPaymentRule_natureOfPaymentId_fkey" FOREIGN KEY ("natureOfPaymentId") REFERENCES "NatureOfPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payee" ADD CONSTRAINT "Payee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_natureOfPaymentId_fkey" FOREIGN KEY ("natureOfPaymentId") REFERENCES "NatureOfPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestVersion" ADD CONSTRAINT "RequestVersion_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestLine" ADD CONSTRAINT "RequestLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestLine" ADD CONSTRAINT "RequestLine_projectCodeId_fkey" FOREIGN KEY ("projectCodeId") REFERENCES "ProjectCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestLine" ADD CONSTRAINT "RequestLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestLine" ADD CONSTRAINT "RequestLine_adjustedProjectCodeId_fkey" FOREIGN KEY ("adjustedProjectCodeId") REFERENCES "ProjectCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestLine" ADD CONSTRAINT "RequestLine_adjustedAccountId_fkey" FOREIGN KEY ("adjustedAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttestation" ADD CONSTRAINT "RequestAttestation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttestation" ADD CONSTRAINT "RequestAttestation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportingDocument" ADD CONSTRAINT "SupportingDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportingDocument" ADD CONSTRAINT "SupportingDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SupportingDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStage" ADD CONSTRAINT "ApprovalStage_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAssignment" ADD CONSTRAINT "ApprovalAssignment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAssignment" ADD CONSTRAINT "ApprovalAssignment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ApprovalStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAssignment" ADD CONSTRAINT "ApprovalAssignment_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAssignment" ADD CONSTRAINT "ApprovalAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ApprovalAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegatorId_fkey" FOREIGN KEY ("delegatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSequence" ADD CONSTRAINT "NumberSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryRecord" ADD CONSTRAINT "RepositoryRecord_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingAdjustment" ADD CONSTRAINT "AccountingAdjustment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingAdjustment" ADD CONSTRAINT "AccountingAdjustment_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingMapping" ADD CONSTRAINT "AccountingMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickBooksExport" ADD CONSTRAINT "QuickBooksExport_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickBooksPosting" ADD CONSTRAINT "QuickBooksPosting_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvidence" ADD CONSTRAINT "PaymentEvidence_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
