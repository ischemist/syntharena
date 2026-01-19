-- This is a one-off script to correct historical naming inconsistencies
-- in the ModelFamily data after the initial migration.

-- ============================================================================
-- MERGE 1: 'synplanner-1.3.2-mcts-rollout' INTO 'synplanner-mcts'
-- ============================================================================

-- Step 1.1: Identify the IDs
-- Canonical Family (KEEP): 'synplanner-mcts' -> 'cmkln7ht80008y5dff2pujo7l'
-- Orphaned Family (DELETE): 'synplanner-1.3.2-mcts-rollout' -> 'cmkln7ht8000by5df40wom8w0'
-- Instance to update: 'synp-m-v1-3-2' -> 'cmkkq8vjl00000tdfa6rxkd29'

-- Step 1.2: Re-point the ModelInstance to the canonical family.
UPDATE "ModelInstance"
SET "modelFamilyId" = 'cmkln7ht80008y5dff2pujo7l' -- <-- ID of 'synplanner-mcts'
WHERE "id" = 'cmkkq8vjl00000tdfa6rxkd29';

-- Step 1.3: Delete the now-empty, orphaned family.
DELETE FROM "ModelFamily"
WHERE "id" = 'cmkln7ht8000by5df40wom8w0'; -- <-- ID of 'synplanner-1.3.2-mcts-rollout'

-- Step 1.4 (Recommended): Clean up the canonical family's name for clarity.
UPDATE "ModelFamily"
SET
    "name" = 'SynPlanner MCTS Rollout',
    "slug" = 'synplanner-mcts-rollout'
WHERE "id" = 'cmkln7ht80008y5dff2pujo7l';


-- ============================================================================
-- MERGE 2: 'synplanner-1.3.2-mcts-val' INTO 'synplanner-eval'
-- ============================================================================

-- Step 2.1: Identify the IDs
-- Canonical Family (KEEP): 'synplanner-eval' -> 'cmkln7ht80009y5df73smzngy'
-- Orphaned Family (DELETE): 'synplanner-1.3.2-mcts-val' -> 'cmkln7ht9000dy5dfec5a784v'
-- Instance to update: 'synp-mv-v1-3-2' -> 'cmkkqhlr50000ygdfefgqgdix'

-- Step 2.2: Re-point the ModelInstance to the canonical family.
UPDATE "ModelInstance"
SET "modelFamilyId" = 'cmkln7ht80009y5df73smzngy' -- <-- ID of 'synplanner-eval'
WHERE "id" = 'cmkkqhlr50000ygdfefgqgdix';

-- Step 2.3: Delete the now-empty, orphaned family.
DELETE FROM "ModelFamily"
WHERE "id" = 'cmkln7ht9000dy5dfec5a784v'; -- <-- ID of 'synplanner-1.3.2-mcts-val'

-- Step 2.4 (Recommended): Clean up the canonical family's name.
UPDATE "ModelFamily"
SET
    "name" = 'SynPlanner MCTS Val',
    "slug" = 'synplanner-mcts-val'
WHERE "id" = 'cmkln7ht80009y5df73smzngy';
