-- CreateTable
CREATE TABLE "BridgeTransaction" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceTxHash" TEXT,
    "sourceChain" TEXT NOT NULL,
    "messageBytes" TEXT,
    "messageHash" TEXT,
    "nonce" TEXT,
    "attestation" TEXT,
    "destinationTxHash" TEXT,
    "destinationChain" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "BridgeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BridgeTransaction_userAddress_idx" ON "BridgeTransaction"("userAddress");

-- CreateIndex
CREATE INDEX "BridgeTransaction_status_idx" ON "BridgeTransaction"("status");

-- CreateIndex
CREATE INDEX "BridgeTransaction_messageHash_idx" ON "BridgeTransaction"("messageHash");

-- CreateIndex
CREATE INDEX "BridgeTransaction_createdAt_idx" ON "BridgeTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "BridgeTransaction" ADD CONSTRAINT "BridgeTransaction_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("baseAddress") ON DELETE RESTRICT ON UPDATE CASCADE;
