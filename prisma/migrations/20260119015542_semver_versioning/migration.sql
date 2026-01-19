/*
  Warnings:

  - You are about to drop the column `version` on the `ModelInstance` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Algorithm` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Algorithm" ADD COLUMN "bibtex" TEXT;
ALTER TABLE "Algorithm" ADD COLUMN "codeUrl" TEXT;
ALTER TABLE "Algorithm" ADD COLUMN "description" TEXT;
ALTER TABLE "Algorithm" ADD COLUMN "slug" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModelInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "algorithmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "versionMajor" INTEGER NOT NULL DEFAULT 0,
    "versionMinor" INTEGER NOT NULL DEFAULT 0,
    "versionPatch" INTEGER NOT NULL DEFAULT 0,
    "versionPrerelease" TEXT,
    "metadata" TEXT,
    CONSTRAINT "ModelInstance_algorithmId_fkey" FOREIGN KEY ("algorithmId") REFERENCES "Algorithm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ModelInstance" ("algorithmId", "id", "metadata", "name") SELECT "algorithmId", "id", "metadata", "name" FROM "ModelInstance";
DROP TABLE "ModelInstance";
ALTER TABLE "new_ModelInstance" RENAME TO "ModelInstance";
CREATE UNIQUE INDEX "ModelInstance_slug_key" ON "ModelInstance"("slug");
CREATE INDEX "ModelInstance_name_idx" ON "ModelInstance"("name");
CREATE UNIQUE INDEX "ModelInstance_name_versionMajor_versionMinor_versionPatch_versionPrerelease_key" ON "ModelInstance"("name", "versionMajor", "versionMinor", "versionPatch", "versionPrerelease");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Algorithm_slug_key" ON "Algorithm"("slug");
