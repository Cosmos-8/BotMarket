-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "baseAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "parentBotId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "metadataURI" TEXT,
    "configHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotConfig" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "configJSON" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotKey" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "encryptedPrivKey" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,
    "parsedSignalJSON" JSONB NOT NULL,
    "signalType" TEXT NOT NULL,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT,
    "tokenId" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fill" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "fillAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fillId" TEXT,

    CONSTRAINT "Fill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotMetrics" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "pnlUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roiPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_baseAddress_key" ON "User"("baseAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_botId_key" ON "Bot"("botId");

-- CreateIndex
CREATE INDEX "Bot_creator_idx" ON "Bot"("creator");

-- CreateIndex
CREATE INDEX "Bot_parentBotId_idx" ON "Bot"("parentBotId");

-- CreateIndex
CREATE INDEX "Bot_visibility_idx" ON "Bot"("visibility");

-- CreateIndex
CREATE INDEX "BotConfig_botId_idx" ON "BotConfig"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "BotKey_botId_key" ON "BotKey"("botId");

-- CreateIndex
CREATE INDEX "BotKey_botId_idx" ON "BotKey"("botId");

-- CreateIndex
CREATE INDEX "Signal_botId_idx" ON "Signal"("botId");

-- CreateIndex
CREATE INDEX "Signal_receivedAt_idx" ON "Signal"("receivedAt");

-- CreateIndex
CREATE INDEX "Order_botId_idx" ON "Order"("botId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_placedAt_idx" ON "Order"("placedAt");

-- CreateIndex
CREATE INDEX "Fill_botId_idx" ON "Fill"("botId");

-- CreateIndex
CREATE INDEX "Fill_orderId_idx" ON "Fill"("orderId");

-- CreateIndex
CREATE INDEX "Fill_fillAt_idx" ON "Fill"("fillAt");

-- CreateIndex
CREATE UNIQUE INDEX "BotMetrics_botId_key" ON "BotMetrics"("botId");

-- CreateIndex
CREATE INDEX "BotMetrics_botId_idx" ON "BotMetrics"("botId");

-- CreateIndex
CREATE INDEX "BotMetrics_roiPct_idx" ON "BotMetrics"("roiPct");

-- CreateIndex
CREATE INDEX "BotMetrics_pnlUsd_idx" ON "BotMetrics"("pnlUsd");

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_creator_fkey" FOREIGN KEY ("creator") REFERENCES "User"("baseAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_parentBotId_fkey" FOREIGN KEY ("parentBotId") REFERENCES "Bot"("botId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotConfig" ADD CONSTRAINT "BotConfig_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("botId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotKey" ADD CONSTRAINT "BotKey_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("botId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("botId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("botId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("botId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotMetrics" ADD CONSTRAINT "BotMetrics_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("botId") ON DELETE CASCADE ON UPDATE CASCADE;
