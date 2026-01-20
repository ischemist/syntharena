/*
  Warnings:

  - You are about to drop the column `algorithmId` on the `ModelInstance` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `ModelInstance` table. All the data in the column will be lost.
  - Made the column `modelFamilyId` on table `ModelInstance` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModelInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelFamilyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "versionMajor" INTEGER NOT NULL DEFAULT 0,
    "versionMinor" INTEGER NOT NULL DEFAULT 0,
    "versionPatch" INTEGER NOT NULL DEFAULT 0,
    "versionPrerelease" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelInstance_modelFamilyId_fkey" FOREIGN KEY ("modelFamilyId") REFERENCES "ModelFamily" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ModelInstance" ("createdAt", "description", "id", "metadata", "modelFamilyId", "slug", "versionMajor", "versionMinor", "versionPatch", "versionPrerelease") SELECT "createdAt", "description", "id", "metadata", "modelFamilyId", "slug", "versionMajor", "versionMinor", "versionPatch", "versionPrerelease" FROM "ModelInstance";
DROP TABLE "ModelInstance";
ALTER TABLE "new_ModelInstance" RENAME TO "ModelInstance";
CREATE UNIQUE INDEX "ModelInstance_slug_key" ON "ModelInstance"("slug");
CREATE INDEX "ModelInstance_modelFamilyId_idx" ON "ModelInstance"("modelFamilyId");
CREATE UNIQUE INDEX "ModelInstance_modelFamilyId_versionMajor_versionMinor_versionPatch_versionPrerelease_key" ON "ModelInstance"("modelFamilyId", "versionMajor", "versionMinor", "versionPatch", "versionPrerelease");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
