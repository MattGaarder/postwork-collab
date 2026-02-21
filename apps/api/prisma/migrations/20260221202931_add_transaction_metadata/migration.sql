-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionType" ADD VALUE 'INVITATION_SENT';
ALTER TYPE "ActionType" ADD VALUE 'INVITATION_ACCEPTED';
ALTER TYPE "ActionType" ADD VALUE 'INVITATION_DECLINED';

-- AlterTable
ALTER TABLE "PointsTransaction" ADD COLUMN     "commentId" INTEGER,
ADD COLUMN     "line" INTEGER,
ADD COLUMN     "performerId" INTEGER,
ADD COLUMN     "projectId" INTEGER,
ADD COLUMN     "versionId" INTEGER;
