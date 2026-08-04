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
    "hasAcceptableRoutes" BOOLEAN NOT NULL DEFAULT false,
    "sourcePath" TEXT,
    "sourceSha256" TEXT,
    "schemaVersion" TEXT,
    "defaultConstraintsJson" TEXT NOT NULL DEFAULT '[]',
    "targetConstraintsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "series" TEXT NOT NULL DEFAULT 'OTHER',
    "isListed" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "BenchmarkSet_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenchmarkTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchmarkSetId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "moleculeId" TEXT NOT NULL,
    "smiles" TEXT NOT NULL,
    "routeLength" INTEGER,
    "isConvergent" BOOLEAN,
    "metadata" TEXT,
    CONSTRAINT "BenchmarkTarget_benchmarkSetId_fkey" FOREIGN KEY ("benchmarkSetId") REFERENCES "BenchmarkSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BenchmarkTarget_moleculeId_fkey" FOREIGN KEY ("moleculeId") REFERENCES "Molecule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcceptableRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchmarkTargetId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "routeIndex" INTEGER NOT NULL,
    CONSTRAINT "AcceptableRoute_benchmarkTargetId_fkey" FOREIGN KEY ("benchmarkTargetId") REFERENCES "BenchmarkTarget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AcceptableRoute_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Algorithm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "paper" TEXT,
    "codeUrl" TEXT,
    "bibtex" TEXT
);

-- CreateTable
CREATE TABLE "ModelFamily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "algorithmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "ModelFamily_algorithmId_fkey" FOREIGN KEY ("algorithmId") REFERENCES "Algorithm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelFamilyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "versionMajor" INTEGER NOT NULL DEFAULT 0,
    "versionMinor" INTEGER NOT NULL DEFAULT 0,
    "versionPatch" INTEGER NOT NULL DEFAULT 0,
    "versionPrerelease" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelInstance_modelFamilyId_fkey" FOREIGN KEY ("modelFamilyId") REFERENCES "ModelFamily" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PredictionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelInstanceId" TEXT NOT NULL,
    "benchmarkSetId" TEXT NOT NULL,
    "retrocastVersion" TEXT,
    "commandParams" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hourlyCost" REAL,
    "totalCost" REAL,
    "executionStatsPath" TEXT,
    "executionStatsSha256" TEXT,
    "timedTargets" INTEGER,
    "totalWallTime" REAL,
    "totalCpuTime" REAL,
    "meanWallTime" REAL,
    "meanCpuTime" REAL,
    "totalCandidates" INTEGER NOT NULL DEFAULT 0,
    "totalFailures" INTEGER NOT NULL DEFAULT 0,
    "totalRoutes" INTEGER NOT NULL DEFAULT 0,
    "avgRouteLength" REAL,
    "submissionType" TEXT NOT NULL DEFAULT 'COMMUNITY_SUBMITTED',
    "isRetrained" BOOLEAN,
    CHECK ("timedTargets" IS NULL OR "timedTargets" >= 0),
    CHECK ("totalWallTime" IS NULL OR "totalWallTime" >= 0),
    CHECK ("totalCpuTime" IS NULL OR "totalCpuTime" >= 0),
    CHECK ("meanWallTime" IS NULL OR "meanWallTime" >= 0),
    CHECK ("meanCpuTime" IS NULL OR "meanCpuTime" >= 0),
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
CREATE TABLE "PredictionCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT,
    "predictionRunId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "benchmarkSetId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "metadata" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "failureDetails" TEXT,
    CHECK ("rank" >= 1),
    CHECK (
        ("routeId" IS NOT NULL AND "failureCode" IS NULL AND "failureMessage" IS NULL AND "failureDetails" IS NULL)
        OR ("routeId" IS NULL AND "failureCode" IS NOT NULL)
    ),
    CONSTRAINT "PredictionCandidate_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PredictionCandidate_predictionRunId_benchmarkSetId_fkey" FOREIGN KEY ("predictionRunId", "benchmarkSetId") REFERENCES "PredictionRun" ("id", "benchmarkSetId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PredictionCandidate_targetId_benchmarkSetId_fkey" FOREIGN KEY ("targetId", "benchmarkSetId") REFERENCES "BenchmarkTarget" ("id", "benchmarkSetId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReactionStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reactionHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RouteNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "moleculeId" TEXT NOT NULL,
    "smiles" TEXT NOT NULL,
    "parentId" TEXT,
    "reactionStepId" TEXT,
    "template" TEXT,
    "metadata" TEXT,
    "isLeaf" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RouteNode_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RouteNode_moleculeId_fkey" FOREIGN KEY ("moleculeId") REFERENCES "Molecule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RouteNode_reactionStepId_fkey" FOREIGN KEY ("reactionStepId") REFERENCES "ReactionStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RouteNode_parentId_routeId_fkey" FOREIGN KEY ("parentId", "routeId") REFERENCES "RouteNode" ("id", "routeId") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "RunEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predictionRunId" TEXT NOT NULL,
    "benchmarkSetId" TEXT NOT NULL,
    "stockId" TEXT,
    "metricLabel" TEXT NOT NULL,
    "evaluatedTiers" TEXT NOT NULL,
    "taskJson" TEXT NOT NULL,
    "parametersJson" TEXT NOT NULL,
    "analysisJson" TEXT NOT NULL,
    "manifestJson" TEXT NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "artifactSchema" TEXT NOT NULL,
    "retrocastVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunEvaluation_predictionRunId_benchmarkSetId_fkey" FOREIGN KEY ("predictionRunId", "benchmarkSetId") REFERENCES "PredictionRun" ("id", "benchmarkSetId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RunEvaluation_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TargetEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runEvaluationId" TEXT NOT NULL,
    "predictionRunId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "benchmarkSetId" TEXT NOT NULL,
    "effectiveConstraintsJson" TEXT NOT NULL,
    "wallTime" REAL,
    "cpuTime" REAL,
    CONSTRAINT "TargetEvaluation_runEvaluationId_predictionRunId_benchmarkSetId_fkey" FOREIGN KEY ("runEvaluationId", "predictionRunId", "benchmarkSetId") REFERENCES "RunEvaluation" ("id", "predictionRunId", "benchmarkSetId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TargetEvaluation_targetId_benchmarkSetId_fkey" FOREIGN KEY ("targetId", "benchmarkSetId") REFERENCES "BenchmarkTarget" ("id", "benchmarkSetId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CandidateEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runEvaluationId" TEXT NOT NULL,
    "targetEvaluationId" TEXT NOT NULL,
    "predictionRunId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "benchmarkSetId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "constraintStatus" TEXT NOT NULL,
    "constraintChecksJson" TEXT,
    "validityEvidenceJson" TEXT,
    "matchesAcceptable" BOOLEAN NOT NULL,
    "matchedAcceptableIndex" INTEGER,
    CHECK ("constraintStatus" IN ('PASS', 'FAIL', 'NOT_EVALUATED')),
    CHECK (
        ("matchesAcceptable" = 1 AND "matchedAcceptableIndex" IS NOT NULL AND "matchedAcceptableIndex" >= 0)
        OR ("matchesAcceptable" = 0 AND "matchedAcceptableIndex" IS NULL)
    ),
    CONSTRAINT "CandidateEvaluation_runEvaluationId_predictionRunId_benchmarkSetId_fkey" FOREIGN KEY ("runEvaluationId", "predictionRunId", "benchmarkSetId") REFERENCES "RunEvaluation" ("id", "predictionRunId", "benchmarkSetId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CandidateEvaluation_targetEvaluationId_runEvaluationId_predictionRunId_targetId_benchmarkSetId_fkey" FOREIGN KEY ("targetEvaluationId", "runEvaluationId", "predictionRunId", "targetId", "benchmarkSetId") REFERENCES "TargetEvaluation" ("id", "runEvaluationId", "predictionRunId", "targetId", "benchmarkSetId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CandidateEvaluation_candidateId_predictionRunId_targetId_benchmarkSetId_fkey" FOREIGN KEY ("candidateId", "predictionRunId", "targetId", "benchmarkSetId") REFERENCES "PredictionCandidate" ("id", "predictionRunId", "targetId", "benchmarkSetId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CandidateTierResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateEvaluationId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "checksJson" TEXT,
    CHECK ("tier" >= 0),
    CHECK ("status" IN ('PASS', 'FAIL', 'NOT_EVALUATED')),
    CONSTRAINT "CandidateTierResult_candidateEvaluationId_fkey" FOREIGN KEY ("candidateEvaluationId") REFERENCES "CandidateEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricEstimate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runEvaluationId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "stratum" TEXT NOT NULL DEFAULT '',
    "value" REAL NOT NULL,
    "ciLower" REAL,
    "ciUpper" REAL,
    "nSamples" INTEGER NOT NULL,
    "reliabilityCode" TEXT,
    "reliabilityMessage" TEXT,
    CHECK ("nSamples" >= 0),
    CHECK ("reliabilityCode" IS NULL OR "reliabilityCode" IN ('OK', 'LOW_N', 'EXTREME_P')),
    CONSTRAINT "MetricEstimate_runEvaluationId_fkey" FOREIGN KEY ("runEvaluationId") REFERENCES "RunEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourcePath" TEXT,
    "sourceSha256" TEXT,
    "schemaVersion" TEXT
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockId" TEXT NOT NULL,
    "moleculeId" TEXT NOT NULL,
    "smiles" TEXT NOT NULL,
    "ppg" REAL,
    "source" TEXT,
    "leadTime" TEXT,
    "link" TEXT,
    CONSTRAINT "StockItem_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockItem_moleculeId_fkey" FOREIGN KEY ("moleculeId") REFERENCES "Molecule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DatabaseMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'syntharena',
    "databaseSchemaVersion" INTEGER NOT NULL,
    "artifactSchemaVersion" TEXT NOT NULL,
    "inventorySchemaVersion" TEXT NOT NULL,
    "inventorySha256" TEXT NOT NULL,
    "retrocastVersion" TEXT NOT NULL,
    "publicationStatus" TEXT NOT NULL,
    "benchmarkCount" INTEGER NOT NULL,
    "modelCount" INTEGER NOT NULL,
    "expectedRunCount" INTEGER NOT NULL,
    "importedRunCount" INTEGER NOT NULL,
    "evaluationTargetCount" INTEGER NOT NULL,
    "candidateCount" INTEGER NOT NULL,
    "routeCount" INTEGER NOT NULL,
    "failureCount" INTEGER NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ("benchmarkCount" >= 0),
    CHECK ("modelCount" >= 0),
    CHECK ("expectedRunCount" >= 0),
    CHECK ("importedRunCount" >= 0 AND "importedRunCount" <= "expectedRunCount"),
    CHECK ("evaluationTargetCount" >= 0),
    CHECK ("candidateCount" >= 0),
    CHECK ("routeCount" >= 0),
    CHECK ("failureCount" >= 0 AND "routeCount" + "failureCount" = "candidateCount")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Molecule_inchikey_key" ON "Molecule"("inchikey");

-- CreateIndex
CREATE INDEX "Molecule_smiles_idx" ON "Molecule"("smiles");

-- CreateIndex
CREATE INDEX "Molecule_inchikey_smiles_idx" ON "Molecule"("inchikey", "smiles");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkSet_name_key" ON "BenchmarkSet"("name");

-- CreateIndex
CREATE INDEX "BenchmarkSet_series_isListed_name_idx" ON "BenchmarkSet"("series", "isListed", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkTarget_benchmarkSetId_targetId_key" ON "BenchmarkTarget"("benchmarkSetId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkTarget_id_benchmarkSetId_key" ON "BenchmarkTarget"("id", "benchmarkSetId");

-- CreateIndex
CREATE INDEX "AcceptableRoute_benchmarkTargetId_idx" ON "AcceptableRoute"("benchmarkTargetId");

-- CreateIndex
CREATE INDEX "AcceptableRoute_routeId_idx" ON "AcceptableRoute"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptableRoute_benchmarkTargetId_routeId_key" ON "AcceptableRoute"("benchmarkTargetId", "routeId");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptableRoute_benchmarkTargetId_routeIndex_key" ON "AcceptableRoute"("benchmarkTargetId", "routeIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Algorithm_name_key" ON "Algorithm"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Algorithm_slug_key" ON "Algorithm"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModelFamily_name_key" ON "ModelFamily"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ModelFamily_slug_key" ON "ModelFamily"("slug");

-- CreateIndex
CREATE INDEX "ModelFamily_algorithmId_idx" ON "ModelFamily"("algorithmId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelInstance_slug_key" ON "ModelInstance"("slug");

-- CreateIndex
CREATE INDEX "ModelInstance_modelFamilyId_idx" ON "ModelInstance"("modelFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelInstance_modelFamilyId_versionMajor_versionMinor_versionPatch_versionPrerelease_key" ON "ModelInstance"("modelFamilyId", "versionMajor", "versionMinor", "versionPatch", "versionPrerelease");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionRun_modelInstanceId_benchmarkSetId_key" ON "PredictionRun"("modelInstanceId", "benchmarkSetId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionRun_id_benchmarkSetId_key" ON "PredictionRun"("id", "benchmarkSetId");

-- CreateIndex
CREATE UNIQUE INDEX "Route_contentHash_key" ON "Route"("contentHash");

-- CreateIndex
CREATE INDEX "Route_signature_idx" ON "Route"("signature");

-- CreateIndex
CREATE INDEX "PredictionCandidate_targetId_rank_idx" ON "PredictionCandidate"("targetId", "rank");

-- CreateIndex
CREATE INDEX "PredictionCandidate_predictionRunId_idx" ON "PredictionCandidate"("predictionRunId");

-- CreateIndex
CREATE INDEX "PredictionCandidate_routeId_idx" ON "PredictionCandidate"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionCandidate_predictionRunId_targetId_rank_key" ON "PredictionCandidate"("predictionRunId", "targetId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionCandidate_id_predictionRunId_targetId_benchmarkSetId_key" ON "PredictionCandidate"("id", "predictionRunId", "targetId", "benchmarkSetId");

-- CreateIndex
CREATE UNIQUE INDEX "ReactionStep_reactionHash_key" ON "ReactionStep"("reactionHash");

-- CreateIndex
CREATE INDEX "RouteNode_routeId_idx" ON "RouteNode"("routeId");

-- CreateIndex
CREATE INDEX "RouteNode_reactionStepId_idx" ON "RouteNode"("reactionStepId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteNode_id_routeId_key" ON "RouteNode"("id", "routeId");

-- CreateIndex
CREATE UNIQUE INDEX "RunEvaluation_manifestSha256_key" ON "RunEvaluation"("manifestSha256");

-- CreateIndex
CREATE INDEX "RunEvaluation_predictionRunId_idx" ON "RunEvaluation"("predictionRunId");

-- CreateIndex
CREATE INDEX "RunEvaluation_stockId_idx" ON "RunEvaluation"("stockId");

-- CreateIndex
CREATE UNIQUE INDEX "RunEvaluation_predictionRunId_metricLabel_key" ON "RunEvaluation"("predictionRunId", "metricLabel");

-- CreateIndex
CREATE UNIQUE INDEX "RunEvaluation_id_predictionRunId_benchmarkSetId_key" ON "RunEvaluation"("id", "predictionRunId", "benchmarkSetId");

-- CreateIndex
CREATE INDEX "TargetEvaluation_targetId_idx" ON "TargetEvaluation"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetEvaluation_runEvaluationId_targetId_key" ON "TargetEvaluation"("runEvaluationId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetEvaluation_id_runEvaluationId_predictionRunId_targetId_benchmarkSetId_key" ON "TargetEvaluation"("id", "runEvaluationId", "predictionRunId", "targetId", "benchmarkSetId");

-- CreateIndex
CREATE INDEX "CandidateEvaluation_candidateId_idx" ON "CandidateEvaluation"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateEvaluation_runEvaluationId_candidateId_key" ON "CandidateEvaluation"("runEvaluationId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateEvaluation_targetEvaluationId_candidateId_key" ON "CandidateEvaluation"("targetEvaluationId", "candidateId");

-- CreateIndex
CREATE INDEX "CandidateTierResult_tier_status_idx" ON "CandidateTierResult"("tier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateTierResult_candidateEvaluationId_tier_key" ON "CandidateTierResult"("candidateEvaluationId", "tier");

-- CreateIndex
CREATE INDEX "MetricEstimate_metricKey_stratum_idx" ON "MetricEstimate"("metricKey", "stratum");

-- CreateIndex
CREATE UNIQUE INDEX "MetricEstimate_runEvaluationId_metricKey_stratum_key" ON "MetricEstimate"("runEvaluationId", "metricKey", "stratum");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_name_key" ON "Stock"("name");

-- CreateIndex
CREATE INDEX "StockItem_stockId_source_ppg_idx" ON "StockItem"("stockId", "source", "ppg");

-- CreateIndex
CREATE INDEX "StockItem_stockId_ppg_idx" ON "StockItem"("stockId", "ppg");

-- CreateIndex
CREATE INDEX "StockItem_stockId_moleculeId_idx" ON "StockItem"("stockId", "moleculeId");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_stockId_moleculeId_key" ON "StockItem"("stockId", "moleculeId");
