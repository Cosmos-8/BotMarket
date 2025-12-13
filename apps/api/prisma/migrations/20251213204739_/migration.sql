-- DropForeignKey
ALTER TABLE "Bot" DROP CONSTRAINT "Bot_creator_fkey";

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_creator_fkey" FOREIGN KEY ("creator") REFERENCES "User"("polygonAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "User_baseAddress_key" RENAME TO "User_polygonAddress_key";
