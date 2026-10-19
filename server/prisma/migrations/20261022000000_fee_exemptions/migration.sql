CREATE TABLE "FeeExemption" (
    "id" SERIAL NOT NULL,
    "feeId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL DEFAULT 'Financeiro',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeeExemption_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeeExemption_valid_reason" CHECK (char_length(btrim("reason")) BETWEEN 1 AND 1000)
);
CREATE UNIQUE INDEX "FeeExemption_feeId_key" ON "FeeExemption"("feeId");
ALTER TABLE "FeeExemption" ADD CONSTRAINT "FeeExemption_feeId_fkey"
  FOREIGN KEY ("feeId") REFERENCES "MonthlyFee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
