-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "destinationAccountId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_destinationAccountId_idx" ON "transactions"("destinationAccountId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
