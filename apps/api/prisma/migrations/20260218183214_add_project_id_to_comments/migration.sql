-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_versionId_fkey";

-- Step 1: Add projectId as nullable first so we can backfill
ALTER TABLE "Comment" ADD COLUMN "projectId" INTEGER;

-- Step 2: Backfill projectId from the related Version's projectId
UPDATE "Comment" c
SET "projectId" = v."projectId"
FROM "Version" v
WHERE c."versionId" = v."id";

-- Step 3: Delete any orphaned comments (where version was already deleted)
DELETE FROM "Comment" WHERE "projectId" IS NULL;

-- Step 4: Now make it NOT NULL
ALTER TABLE "Comment" ALTER COLUMN "projectId" SET NOT NULL;

-- Step 5: Make versionId optional
ALTER TABLE "Comment" ALTER COLUMN "versionId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Comment_projectId_idx" ON "Comment"("projectId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
