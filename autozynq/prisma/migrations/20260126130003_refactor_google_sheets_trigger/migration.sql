-- AlterTable
ALTER TABLE "ExecutionLock" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + interval '1 hour';

-- CreateTable
CREATE TABLE "GoogleSheetsTrigger" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "headerRowIndex" INTEGER NOT NULL DEFAULT 1,
    "lastProcessedRow" INTEGER NOT NULL,
    "startMode" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleSheetsTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleSheetsTrigger_workflowId_idx" ON "GoogleSheetsTrigger"("workflowId");

-- CreateIndex
CREATE INDEX "GoogleSheetsTrigger_spreadsheetId_sheetName_idx" ON "GoogleSheetsTrigger"("spreadsheetId", "sheetName");

-- AddForeignKey
ALTER TABLE "GoogleSheetsTrigger" ADD CONSTRAINT "GoogleSheetsTrigger_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
