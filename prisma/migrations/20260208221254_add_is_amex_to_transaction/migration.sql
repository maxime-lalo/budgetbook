-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "isAmex" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "transactions_isAmex_status_idx" ON "transactions"("isAmex", "status");

-- Data migration: mark AMEX transactions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "accounts" WHERE "type" = 'CREDIT_CARD' AND "linkedAccountId" IS NULL) THEN
    RAISE EXCEPTION 'CREDIT_CARD sans linkedAccountId trouvé';
  END IF;
END $$;

-- Marquer les transactions AMEX
UPDATE "transactions" t SET "isAmex" = true
FROM "accounts" a WHERE t."accountId" = a."id" AND a."type" = 'CREDIT_CARD';

-- Déplacer vers le compte courant lié
UPDATE "transactions" t SET "accountId" = a."linkedAccountId"
FROM "accounts" a WHERE t."accountId" = a."id" AND a."type" = 'CREDIT_CARD';

-- Supprimer le compte AMEX
DELETE FROM "accounts" WHERE "type" = 'CREDIT_CARD';
