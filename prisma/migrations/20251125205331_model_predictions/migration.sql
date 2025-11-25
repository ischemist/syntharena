-- CreateTable
CREATE TABLE "Algorithm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "paper" TEXT
);

-- CreateTable
CREATE TABLE "ModelInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "algorithmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "metadata" TEXT,
    CONSTRAINT "ModelInstance_algorithmId_fkey" FOREIGN KEY ("algorithmId") REFERENCES "Algorithm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PredictionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelInstanceId" TEXT NOT NULL,
    "benchmarkSetId" TEXT NOT NULL,
    "retrocastVersion" TEXT,
    "commandParams" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalTimeMs" REAL,
    "totalRoutes" INTEGER NOT NULL,
    CONSTRAINT "PredictionRun_modelInstanceId_fkey" FOREIGN KEY ("modelInstanceId") REFERENCES "ModelInstance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PredictionRun_benchmarkSetId_fkey" FOREIGN KEY ("benchmarkSetId") REFERENCES "BenchmarkSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RouteSolvability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "isSolvable" BOOLEAN NOT NULL,
    "isGtMatch" BOOLEAN NOT NULL,
    CONSTRAINT "RouteSolvability_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RouteSolvability_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predictionRunId" TEXT,
    "targetId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signature" TEXT,
    "length" INTEGER NOT NULL,
    "isConvergent" BOOLEAN NOT NULL,
    "metadata" TEXT,
    CONSTRAINT "Route_predictionRunId_fkey" FOREIGN KEY ("predictionRunId") REFERENCES "PredictionRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Route_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "BenchmarkTarget" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Route" ("contentHash", "id", "isConvergent", "length", "metadata", "predictionRunId", "rank", "signature", "targetId") SELECT "contentHash", "id", "isConvergent", "length", "metadata", "predictionRunId", "rank", "signature", "targetId" FROM "Route";
DROP TABLE "Route";
ALTER TABLE "new_Route" RENAME TO "Route";
CREATE INDEX "Route_targetId_rank_idx" ON "Route"("targetId", "rank");
CREATE INDEX "Route_contentHash_idx" ON "Route"("contentHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Algorithm_name_key" ON "Algorithm"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ModelInstance_name_key" ON "ModelInstance"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionRun_modelInstanceId_benchmarkSetId_key" ON "PredictionRun"("modelInstanceId", "benchmarkSetId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteSolvability_routeId_stockId_key" ON "RouteSolvability"("routeId", "stockId");
