-- CreateTable
CREATE TABLE "BenchmarkSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stockName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
CREATE TABLE "Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predictionRunId" TEXT,
    "targetId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signature" TEXT,
    "length" INTEGER NOT NULL,
    "isConvergent" BOOLEAN NOT NULL,
    "metadata" TEXT,
    CONSTRAINT "Route_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "BenchmarkTarget" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    CONSTRAINT "RouteNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RouteNode" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkSet_name_key" ON "BenchmarkSet"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkTarget_groundTruthRouteId_key" ON "BenchmarkTarget"("groundTruthRouteId");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkTarget_benchmarkSetId_targetId_key" ON "BenchmarkTarget"("benchmarkSetId", "targetId");

-- CreateIndex
CREATE INDEX "Route_targetId_rank_idx" ON "Route"("targetId", "rank");

-- CreateIndex
CREATE INDEX "Route_contentHash_idx" ON "Route"("contentHash");

-- CreateIndex
CREATE INDEX "RouteNode_routeId_idx" ON "RouteNode"("routeId");
