-- Código de acesso temporário para o primeiro cadastro.
-- Os campos são opcionais para preservar todos os registros existentes.
ALTER TABLE "Member"
  ADD COLUMN "accessCodeHash" TEXT,
  ADD COLUMN "accessCodeExpiresAt" TIMESTAMP(3),
  ADD COLUMN "accessCodeUsedAt" TIMESTAMP(3);

CREATE INDEX "Member_accessCodeExpiresAt_idx" ON "Member"("accessCodeExpiresAt");
