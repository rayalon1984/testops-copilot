-- AlterTable
ALTER TABLE "FailureArchive" ADD COLUMN "category" TEXT,
ADD COLUMN "categoryConfidence" DOUBLE PRECISION,
ADD COLUMN "filePath" TEXT;
