ALTER TABLE "PaymentProof" ALTER COLUMN "feeId" DROP NOT NULL;
ALTER TABLE "PaymentProof" ADD COLUMN "cadastroId" INTEGER,
  ADD COLUMN "competence" TEXT, ADD COLUMN "amountCents" INTEGER;

UPDATE "PaymentProof" AS proof SET "cadastroId" = fee."cadastroId",
  "competence" = fee."competence", "amountCents" = fee."amountCents"
FROM "MonthlyFee" AS fee WHERE proof."feeId" = fee."id";

ALTER TABLE "PaymentProof" ALTER COLUMN "cadastroId" SET NOT NULL,
  ALTER COLUMN "competence" SET NOT NULL, ALTER COLUMN "amountCents" SET NOT NULL;
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_cadastroId_fkey"
  FOREIGN KEY ("cadastroId") REFERENCES "Cadastro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_valid_amount" CHECK ("amountCents" > 0),
  ADD CONSTRAINT "PaymentProof_valid_competence" CHECK ("competence" ~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "PaymentProof_approved_has_fee" CHECK ("status" <> 'APPROVED' OR "feeId" IS NOT NULL);
CREATE INDEX "PaymentProof_cadastroId_competence_idx" ON "PaymentProof"("cadastroId", "competence");
CREATE UNIQUE INDEX "PaymentProof_one_pending_per_member_month"
  ON "PaymentProof"("cadastroId", "competence") WHERE "status" = 'PENDING';
