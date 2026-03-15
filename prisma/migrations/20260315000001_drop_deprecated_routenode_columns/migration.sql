-- Drop deprecated columns from RouteNode (now stored in ReactionStep)
-- Requires SQLite >= 3.35.0 for ALTER TABLE DROP COLUMN support.

-- Drop the old inline reaction data columns
ALTER TABLE "RouteNode" DROP COLUMN "reactionHash";
ALTER TABLE "RouteNode" DROP COLUMN "template";
ALTER TABLE "RouteNode" DROP COLUMN "metadata";
