-- CreateTable: ReactionStep (shared, deduplicated reaction data)
CREATE TABLE "ReactionStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reactionHash" TEXT NOT NULL,
    "template" TEXT,
    "metadata" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "ReactionStep_reactionHash_key" ON "ReactionStep"("reactionHash");

-- AddColumn: reactionStepId to RouteNode (nullable, no FK constraint yet — added after data migration)
ALTER TABLE "RouteNode" ADD COLUMN "reactionStepId" TEXT;

-- CreateIndex
CREATE INDEX "RouteNode_reactionStepId_idx" ON "RouteNode"("reactionStepId");
