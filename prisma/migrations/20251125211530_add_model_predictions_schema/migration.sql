-- CreateTable
CREATE TABLE "ModelRunStatistics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predictionRunId" TEXT NOT NULL,
    "benchmarkSetId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "statisticsJson" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelRunStatistics_predictionRunId_fkey" FOREIGN KEY ("predictionRunId") REFERENCES "PredictionRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ModelRunStatistics_benchmarkSetId_fkey" FOREIGN KEY ("benchmarkSetId") REFERENCES "BenchmarkSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ModelRunStatistics_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StratifiedMetricGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statisticsId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "groupKey" INTEGER,
    "value" REAL NOT NULL,
    "ciLower" REAL NOT NULL,
    "ciUpper" REAL NOT NULL,
    "nSamples" INTEGER NOT NULL,
    "reliabilityCode" TEXT NOT NULL,
    "reliabilityMessage" TEXT NOT NULL,
    CONSTRAINT "StratifiedMetricGroup_statisticsId_fkey" FOREIGN KEY ("statisticsId") REFERENCES "ModelRunStatistics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BenchmarkSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stockName" TEXT,
    "hasGroundTruth" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_BenchmarkSet" ("createdAt", "description", "id", "name", "stockName") SELECT "createdAt", "description", "id", "name", "stockName" FROM "BenchmarkSet";
DROP TABLE "BenchmarkSet";
ALTER TABLE "new_BenchmarkSet" RENAME TO "BenchmarkSet";
CREATE UNIQUE INDEX "BenchmarkSet_name_key" ON "BenchmarkSet"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ModelRunStatistics_predictionRunId_idx" ON "ModelRunStatistics"("predictionRunId");

-- CreateIndex
CREATE INDEX "ModelRunStatistics_stockId_idx" ON "ModelRunStatistics"("stockId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelRunStatistics_predictionRunId_stockId_key" ON "ModelRunStatistics"("predictionRunId", "stockId");

-- CreateIndex
CREATE INDEX "StratifiedMetricGroup_statisticsId_metricName_idx" ON "StratifiedMetricGroup"("statisticsId", "metricName");

-- CreateIndex
CREATE INDEX "StratifiedMetricGroup_metricName_groupKey_idx" ON "StratifiedMetricGroup"("metricName", "groupKey");
