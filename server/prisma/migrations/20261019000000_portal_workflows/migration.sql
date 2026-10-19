-- Fluxos integrados de comunicação, Secretaria e comprovantes financeiros.
-- Migração aditiva: nenhum cadastro, atendimento ou pagamento existente é alterado.

CREATE TABLE "AssociationPostAttachment" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssociationPostAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficeMessage" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfficeMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentProof" (
    "id" SERIAL NOT NULL,
    "feeId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssociationPostAttachment_postId_createdAt_idx" ON "AssociationPostAttachment"("postId", "createdAt");
CREATE INDEX "OfficeMessage_entryId_createdAt_idx" ON "OfficeMessage"("entryId", "createdAt");
CREATE INDEX "PaymentProof_feeId_submittedAt_idx" ON "PaymentProof"("feeId", "submittedAt");
CREATE INDEX "PaymentProof_status_submittedAt_idx" ON "PaymentProof"("status", "submittedAt");
CREATE UNIQUE INDEX "PaymentProof_one_pending_per_fee" ON "PaymentProof"("feeId") WHERE "status" = 'PENDING';

ALTER TABLE "AssociationPostAttachment" ADD CONSTRAINT "AssociationPostAttachment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "AssociationPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficeMessage" ADD CONSTRAINT "OfficeMessage_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "OfficeEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_feeId_fkey"
  FOREIGN KEY ("feeId") REFERENCES "MonthlyFee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssociationPostAttachment" ADD CONSTRAINT "AssociationPostAttachment_valid_mime"
  CHECK ("mimeType" IN ('application/pdf', 'image/jpeg', 'image/png'));
ALTER TABLE "AssociationPostAttachment" ADD CONSTRAINT "AssociationPostAttachment_valid_size"
  CHECK ("size" > 0 AND "size" <= 5242880);
ALTER TABLE "OfficeMessage" ADD CONSTRAINT "OfficeMessage_valid_sender"
  CHECK ("sender" IN ('MEMBER', 'ADMIN'));
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_valid_status"
  CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_valid_mime"
  CHECK ("mimeType" IN ('application/pdf', 'image/jpeg', 'image/png'));
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_valid_size"
  CHECK ("size" > 0 AND "size" <= 5242880);
