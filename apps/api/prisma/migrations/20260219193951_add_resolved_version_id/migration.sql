-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "resolvedVersionId" INTEGER;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_resolvedVersionId_fkey" FOREIGN KEY ("resolvedVersionId") REFERENCES "Version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
