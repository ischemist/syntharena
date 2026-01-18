-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BenchmarkSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stockId" TEXT NOT NULL,
    "hasAcceptableRoutes" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "series" TEXT NOT NULL DEFAULT 'OTHER',
    "isListed" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "BenchmarkSet_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BenchmarkSet" ("createdAt", "description", "hasAcceptableRoutes", "id", "name", "stockId") SELECT "createdAt", "description", "hasAcceptableRoutes", "id", "name", "stockId" FROM "BenchmarkSet";
DROP TABLE "BenchmarkSet";
ALTER TABLE "new_BenchmarkSet" RENAME TO "BenchmarkSet";
CREATE UNIQUE INDEX "BenchmarkSet_name_key" ON "BenchmarkSet"("name");
CREATE INDEX "BenchmarkSet_series_isListed_name_idx" ON "BenchmarkSet"("series", "isListed", "name");
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
    "submissionType" TEXT NOT NULL DEFAULT 'COMMUNITY_SUBMITTED',
    "isRetrained" BOOLEAN,
    CONSTRAINT "PredictionRun_modelInstanceId_fkey" FOREIGN KEY ("modelInstanceId") REFERENCES "ModelInstance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PredictionRun_benchmarkSetId_fkey" FOREIGN KEY ("benchmarkSetId") REFERENCES "BenchmarkSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PredictionRun" ("avgRouteLength", "benchmarkSetId", "commandParams", "executedAt", "hourlyCost", "id", "modelInstanceId", "retrocastVersion", "totalCost", "totalRoutes") SELECT "avgRouteLength", "benchmarkSetId", "commandParams", "executedAt", "hourlyCost", "id", "modelInstanceId", "retrocastVersion", "totalCost", "totalRoutes" FROM "PredictionRun";
DROP TABLE "PredictionRun";
ALTER TABLE "new_PredictionRun" RENAME TO "PredictionRun";
CREATE UNIQUE INDEX "PredictionRun_modelInstanceId_benchmarkSetId_key" ON "PredictionRun"("modelInstanceId", "benchmarkSetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
