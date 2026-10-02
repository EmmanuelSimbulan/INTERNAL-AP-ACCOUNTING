CREATE TABLE "PrototypeWorkspace" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "requests" JSONB NOT NULL,
    "masterData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrototypeWorkspace_pkey" PRIMARY KEY ("id")
);
