-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RouteNode" (
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
INSERT INTO "new_RouteNode" ("id", "isLeaf", "metadata", "moleculeId", "parentId", "reactionHash", "routeId", "template") SELECT "id", "isLeaf", "metadata", "moleculeId", "parentId", "reactionHash", "routeId", "template" FROM "RouteNode";
DROP TABLE "RouteNode";
ALTER TABLE "new_RouteNode" RENAME TO "RouteNode";
CREATE INDEX "RouteNode_routeId_idx" ON "RouteNode"("routeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
