-- Drop deprecated columns from RouteNode (now stored in ReactionStep)
-- Requires SQLite >= 3.35.0 for ALTER TABLE DROP COLUMN support.

-- Refuse to drop legacy columns until every RouteNode carrying inline reaction
-- data has been backfilled to ReactionStep.
CREATE TEMP TABLE "__reactionstep_backfill_guard" (
    "ok" INTEGER NOT NULL,
    CONSTRAINT "reactionstep_backfill_required" CHECK ("ok" = 1)
);

INSERT INTO "__reactionstep_backfill_guard" ("ok")
SELECT CASE
    WHEN EXISTS (
        SELECT 1
        FROM "RouteNode"
        WHERE "reactionStepId" IS NULL
          AND (
              "reactionHash" IS NOT NULL
              OR "template" IS NOT NULL
              OR "metadata" IS NOT NULL
          )
    ) THEN 0
    ELSE 1
END;

DROP TABLE "__reactionstep_backfill_guard";

-- Drop the old inline reaction data columns
ALTER TABLE "RouteNode" DROP COLUMN "reactionHash";
ALTER TABLE "RouteNode" DROP COLUMN "template";
ALTER TABLE "RouteNode" DROP COLUMN "metadata";
