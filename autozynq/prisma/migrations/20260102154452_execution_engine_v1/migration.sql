-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "error" JSONB,
ADD COLUMN     "result" JSONB,
ADD COLUMN     "steps" JSONB,
ADD COLUMN     "userId" TEXT;
