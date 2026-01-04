/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `Execution` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExecutionStatus" ADD VALUE 'CANCEL_REQUESTED';
ALTER TYPE "ExecutionStatus" ADD VALUE 'ABORTED';

-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "abortReason" TEXT,
ADD COLUMN     "abortedAt" TIMESTAMP(3),
ADD COLUMN     "abortedBy" TEXT,
ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Execution_idempotencyKey_key" ON "Execution"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Execution_idempotencyKey_idx" ON "Execution"("idempotencyKey");
