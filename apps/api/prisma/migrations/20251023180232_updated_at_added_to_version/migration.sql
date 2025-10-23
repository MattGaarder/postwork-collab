/*
  Warnings:

  - You are about to drop the column `projectId` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "projectId";

-- AlterTable
ALTER TABLE "Version" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
