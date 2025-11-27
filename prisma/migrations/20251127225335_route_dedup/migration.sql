/*
  Warnings:

  - You are about to drop the column `metadata` on the `Route` table. All the data in the column will be lost.
  - You are about to drop the column `predictionRunId` on the `Route` table. All the data in the column will be lost.
  - You are about to drop the column `rank` on the `Route` table. All the data in the column will be lost.
  - You are about to drop the column `targetId` on the `Route` table. All the data in the column will be lost.
  - You are about to drop the column `routeId` on the `RouteSolvability` table. All the data in the column will be lost.
  - Made the column `signature` on table `Route` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `predictionRouteId` to the `RouteSolvability` table without a default value. This is not possible if the table is not empty.

*/
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signature" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "isConvergent" BOOLEAN NOT NULL
);
INSERT INTO "new_Route" ("contentHash", "id", "isConvergent", "length", "signature") SELECT "contentHash", "id", "isConvergent", "length", "signature" FROM "Route";
DROP TABLE "Route";
ALTER TABLE "new_Route" RENAME TO "Route";
CREATE UNIQUE INDEX "Route_signature_key" ON "Route"("signature");
CREATE UNIQUE INDEX "Route_contentHash_key" ON "Route"("contentHash");
CREATE INDEX "Route_signature_idx" ON "Route"("signature");
CREATE INDEX "Route_contentHash_idx" ON "Route"("contentHash");
CREATE TABLE "new_RouteSolvability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predictionRouteId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "isSolvable" BOOLEAN NOT NULL,
    "isGtMatch" BOOLEAN NOT NULL,
    CONSTRAINT "RouteSolvability_predictionRouteId_fkey" FOREIGN KEY ("predictionRouteId") REFERENCES "PredictionRoute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RouteSolvability_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RouteSolvability" ("id", "isGtMatch", "isSolvable", "stockId") SELECT "id", "isGtMatch", "isSolvable", "stockId" FROM "RouteSolvability";
DROP TABLE "RouteSolvability";
ALTER TABLE "new_RouteSolvability" RENAME TO "RouteSolvability";
CREATE UNIQUE INDEX "RouteSolvability_predictionRouteId_stockId_key" ON "RouteSolvability"("predictionRouteId", "stockId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

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
