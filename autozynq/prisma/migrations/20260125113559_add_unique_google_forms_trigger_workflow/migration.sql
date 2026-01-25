/*
  Warnings:

  - A unique constraint covering the columns `[workflowId]` on the table `GoogleFormsTrigger` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ExecutionLock" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + interval '1 hour';

-- CreateIndex
CREATE UNIQUE INDEX "GoogleFormsTrigger_workflowId_key" ON "GoogleFormsTrigger"("workflowId");
