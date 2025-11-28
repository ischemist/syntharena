-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Molecule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inchikey" TEXT NOT NULL,
    "smiles" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "BenchmarkSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stockId" TEXT NOT NULL,
    "hasGroundTruth" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BenchmarkSet_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenchmarkTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchmarkSetId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "moleculeId" TEXT NOT NULL,
    "routeLength" INTEGER,
    "isConvergent" BOOLEAN,
    "metadata" TEXT,
    "groundTruthRouteId" TEXT,
    CONSTRAINT "BenchmarkTarget_benchmarkSetId_fkey" FOREIGN KEY ("benchmarkSetId") REFERENCES "BenchmarkSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BenchmarkTarget_moleculeId_fkey" FOREIGN KEY ("moleculeId") REFERENCES "Molecule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BenchmarkTarget_groundTruthRouteId_fkey" FOREIGN KEY ("groundTruthRouteId") REFERENCES "Route" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "avgRouteLength" REAL,
    CONSTRAINT "PredictionRun_modelInstanceId_fkey" FOREIGN KEY ("modelInstanceId") REFERENCES "ModelInstance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PredictionRun_benchmarkSetId_fkey" FOREIGN KEY ("benchmarkSetId") REFERENCES "BenchmarkSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signature" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "isConvergent" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "PredictionRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "predictionRunId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "metadata" TEXT,
    CONSTRAINT "PredictionRoute_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PredictionRoute_predictionRunId_fkey" FOREIGN KEY ("predictionRunId") REFERENCES "PredictionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PredictionRoute_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "BenchmarkTarget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RouteNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "moleculeId" TEXT NOT NULL,
    "parentId" TEXT,
    "isLeaf" BOOLEAN NOT NULL DEFAULT false,
    "reactionHash" TEXT,
    "template" TEXT,
    "metadata" TEXT,
    CONSTRAINT "RouteNode_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RouteNode_moleculeId_fkey" FOREIGN KEY ("moleculeId") REFERENCES "Molecule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RouteNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RouteNode" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

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

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockId" TEXT NOT NULL,
    "moleculeId" TEXT NOT NULL,
    CONSTRAINT "StockItem_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockItem_moleculeId_fkey" FOREIGN KEY ("moleculeId") REFERENCES "Molecule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RouteSolvability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predictionRouteId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "isSolvable" BOOLEAN NOT NULL,
    "isGtMatch" BOOLEAN NOT NULL,
    CONSTRAINT "RouteSolvability_predictionRouteId_fkey" FOREIGN KEY ("predictionRouteId") REFERENCES "PredictionRoute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RouteSolvability_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Molecule_inchikey_key" ON "Molecule"("inchikey");

-- CreateIndex
CREATE INDEX "Molecule_smiles_idx" ON "Molecule"("smiles");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkSet_name_key" ON "BenchmarkSet"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkTarget_groundTruthRouteId_key" ON "BenchmarkTarget"("groundTruthRouteId");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkTarget_benchmarkSetId_targetId_key" ON "BenchmarkTarget"("benchmarkSetId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Algorithm_name_key" ON "Algorithm"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ModelInstance_name_key" ON "ModelInstance"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionRun_modelInstanceId_benchmarkSetId_key" ON "PredictionRun"("modelInstanceId", "benchmarkSetId");

-- CreateIndex
CREATE UNIQUE INDEX "Route_signature_key" ON "Route"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "Route_contentHash_key" ON "Route"("contentHash");

-- CreateIndex
CREATE INDEX "PredictionRoute_targetId_rank_idx" ON "PredictionRoute"("targetId", "rank");

-- CreateIndex
CREATE INDEX "PredictionRoute_predictionRunId_idx" ON "PredictionRoute"("predictionRunId");

-- CreateIndex
CREATE INDEX "PredictionRoute_routeId_idx" ON "PredictionRoute"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionRoute_predictionRunId_targetId_rank_key" ON "PredictionRoute"("predictionRunId", "targetId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionRoute_routeId_predictionRunId_targetId_key" ON "PredictionRoute"("routeId", "predictionRunId", "targetId");

-- CreateIndex
CREATE INDEX "RouteNode_routeId_idx" ON "RouteNode"("routeId");

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

-- CreateIndex
CREATE UNIQUE INDEX "Stock_name_key" ON "Stock"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_stockId_moleculeId_key" ON "StockItem"("stockId", "moleculeId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteSolvability_predictionRouteId_stockId_key" ON "RouteSolvability"("predictionRouteId", "stockId");
