-- Migration: Polygon Migration & CCTP Removal
-- Description: 
--   1. Rename User.baseAddress to User.polygonAddress
--   2. Add Bot.isActive field
--   3. Drop BridgeTransaction table

-- Step 1: Drop foreign key constraint on BridgeTransaction
ALTER TABLE "BridgeTransaction" DROP CONSTRAINT IF EXISTS "BridgeTransaction_userAddress_fkey";

-- Step 2: Drop BridgeTransaction table
DROP TABLE IF EXISTS "BridgeTransaction";

-- Step 3: Rename baseAddress to polygonAddress in User table
ALTER TABLE "User" RENAME COLUMN "baseAddress" TO "polygonAddress";

-- Step 4: Update foreign key reference in Bot table
-- (The constraint name may vary, so we drop and recreate)
ALTER TABLE "Bot" DROP CONSTRAINT IF EXISTS "Bot_creator_fkey";

-- Step 5: Recreate foreign key with new column name
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_creator_fkey" 
  FOREIGN KEY ("creator") REFERENCES "User"("polygonAddress") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 6: Add isActive column to Bot table with default false
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false;

-- Step 7: Add index on isActive for efficient querying
CREATE INDEX IF NOT EXISTS "Bot_isActive_idx" ON "Bot"("isActive");


