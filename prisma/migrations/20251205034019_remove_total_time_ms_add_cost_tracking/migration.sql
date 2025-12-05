/*
  Warnings:

  - You are about to drop the column `totalTimeMs` on the `PredictionRun` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PredictionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelInstanceId" TEXT NOT NULL,
    "benchmarkSetId" TEXT NOT NULL,
    "retrocastVersion" TEXT,
    "commandParams" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hourlyCost" REAL,
    "totalCost" REAL,
    "totalRoutes" INTEGER NOT NULL,
    "avgRouteLength" REAL,
    CONSTRAINT "PredictionRun_modelInstanceId_fkey" FOREIGN KEY ("modelInstanceId") REFERENCES "ModelInstance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PredictionRun_benchmarkSetId_fkey" FOREIGN KEY ("benchmarkSetId") REFERENCES "BenchmarkSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PredictionRun" ("avgRouteLength", "benchmarkSetId", "commandParams", "executedAt", "id", "modelInstanceId", "retrocastVersion", "totalRoutes") SELECT "avgRouteLength", "benchmarkSetId", "commandParams", "executedAt", "id", "modelInstanceId", "retrocastVersion", "totalRoutes" FROM "PredictionRun";
DROP TABLE "PredictionRun";
ALTER TABLE "new_PredictionRun" RENAME TO "PredictionRun";
CREATE UNIQUE INDEX "PredictionRun_modelInstanceId_benchmarkSetId_key" ON "PredictionRun"("modelInstanceId", "benchmarkSetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
