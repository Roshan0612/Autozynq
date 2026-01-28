-- AlterTable
ALTER TABLE "ExecutionLock" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + interval '1 hour';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT;
