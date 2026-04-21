-- Remove Route.contentHash now that SynthArena treats route identity as topology-only.
-- Also add the missing foreign key for RouteNode.reactionStepId while rebuilding the table.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signature" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "isConvergent" BOOLEAN NOT NULL
);

INSERT INTO "new_Route" ("id", "isConvergent", "length", "signature")
SELECT "id", "isConvergent", "length", "signature"
FROM "Route";

DROP TABLE "Route";
ALTER TABLE "new_Route" RENAME TO "Route";
CREATE UNIQUE INDEX "Route_signature_key" ON "Route"("signature");

CREATE TABLE "new_RouteNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "moleculeId" TEXT NOT NULL,
    "parentId" TEXT,
    "reactionStepId" TEXT,
    "isLeaf" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RouteNode_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RouteNode_moleculeId_fkey" FOREIGN KEY ("moleculeId") REFERENCES "Molecule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RouteNode_reactionStepId_fkey" FOREIGN KEY ("reactionStepId") REFERENCES "ReactionStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RouteNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RouteNode" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

INSERT INTO "new_RouteNode" ("id", "isLeaf", "moleculeId", "parentId", "reactionStepId", "routeId")
SELECT "id", "isLeaf", "moleculeId", "parentId", "reactionStepId", "routeId"
FROM "RouteNode";

DROP TABLE "RouteNode";
ALTER TABLE "new_RouteNode" RENAME TO "RouteNode";
CREATE INDEX "RouteNode_routeId_idx" ON "RouteNode"("routeId");
CREATE INDEX "RouteNode_reactionStepId_idx" ON "RouteNode"("reactionStepId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
