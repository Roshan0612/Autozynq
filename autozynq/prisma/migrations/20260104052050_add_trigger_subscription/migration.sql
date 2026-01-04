-- CreateTable
CREATE TABLE "TriggerSubscription" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "webhookPath" TEXT NOT NULL,
    "lastPayload" JSONB,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriggerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TriggerSubscription_webhookPath_key" ON "TriggerSubscription"("webhookPath");

-- CreateIndex
CREATE INDEX "TriggerSubscription_workflowId_idx" ON "TriggerSubscription"("workflowId");

-- AddForeignKey
ALTER TABLE "TriggerSubscription" ADD CONSTRAINT "TriggerSubscription_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
