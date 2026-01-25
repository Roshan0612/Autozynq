-- AlterTable
ALTER TABLE "ExecutionLock" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + interval '1 hour';

-- CreateTable
CREATE TABLE "GoogleFormsTrigger" (
    "id" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "lastResponseId" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleFormsTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleFormsTrigger_triggerId_key" ON "GoogleFormsTrigger"("triggerId");

-- CreateIndex
CREATE INDEX "GoogleFormsTrigger_userId_idx" ON "GoogleFormsTrigger"("userId");

-- CreateIndex
CREATE INDEX "GoogleFormsTrigger_workflowId_idx" ON "GoogleFormsTrigger"("workflowId");

-- CreateIndex
CREATE INDEX "GoogleFormsTrigger_formId_idx" ON "GoogleFormsTrigger"("formId");

-- CreateIndex
CREATE INDEX "GoogleFormsTrigger_active_idx" ON "GoogleFormsTrigger"("active");

-- AddForeignKey
ALTER TABLE "GoogleFormsTrigger" ADD CONSTRAINT "GoogleFormsTrigger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleFormsTrigger" ADD CONSTRAINT "GoogleFormsTrigger_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleFormsTrigger" ADD CONSTRAINT "GoogleFormsTrigger_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
