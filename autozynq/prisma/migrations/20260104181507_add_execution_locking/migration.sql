-- CreateTable
CREATE TABLE "ExecutionLock" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT NOW() + interval '1 hour',

    CONSTRAINT "ExecutionLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionLock_workflowId_key" ON "ExecutionLock"("workflowId");

-- CreateIndex
CREATE INDEX "ExecutionLock_workflowId_idx" ON "ExecutionLock"("workflowId");

-- CreateIndex
CREATE INDEX "ExecutionLock_expiresAt_idx" ON "ExecutionLock"("expiresAt");
