-- CreateTable
CREATE TABLE "ModelFamily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "algorithmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "ModelFamily_algorithmId_fkey" FOREIGN KEY ("algorithmId") REFERENCES "Algorithm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModelInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "algorithmId" TEXT NOT NULL,
    "modelFamilyId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "versionMajor" INTEGER NOT NULL DEFAULT 0,
    "versionMinor" INTEGER NOT NULL DEFAULT 0,
    "versionPatch" INTEGER NOT NULL DEFAULT 0,
    "versionPrerelease" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelInstance_algorithmId_fkey" FOREIGN KEY ("algorithmId") REFERENCES "Algorithm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ModelInstance_modelFamilyId_fkey" FOREIGN KEY ("modelFamilyId") REFERENCES "ModelFamily" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ModelInstance" ("algorithmId", "createdAt", "description", "id", "metadata", "name", "slug", "versionMajor", "versionMinor", "versionPatch", "versionPrerelease") SELECT "algorithmId", "createdAt", "description", "id", "metadata", "name", "slug", "versionMajor", "versionMinor", "versionPatch", "versionPrerelease" FROM "ModelInstance";
DROP TABLE "ModelInstance";
ALTER TABLE "new_ModelInstance" RENAME TO "ModelInstance";
CREATE UNIQUE INDEX "ModelInstance_slug_key" ON "ModelInstance"("slug");
CREATE INDEX "ModelInstance_modelFamilyId_idx" ON "ModelInstance"("modelFamilyId");
CREATE UNIQUE INDEX "ModelInstance_name_versionMajor_versionMinor_versionPatch_versionPrerelease_key" ON "ModelInstance"("name", "versionMajor", "versionMinor", "versionPatch", "versionPrerelease");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ModelFamily_name_key" ON "ModelFamily"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ModelFamily_slug_key" ON "ModelFamily"("slug");

-- CreateIndex
CREATE INDEX "ModelFamily_algorithmId_idx" ON "ModelFamily"("algorithmId");
