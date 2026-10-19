-- Registros antigos da Secretaria permanecem privados por padrão.
ALTER TABLE "OfficeEntry"
  ADD COLUMN "visibleToMember" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "OfficeEntry_cadastroId_visibleToMember_createdAt_idx"
  ON "OfficeEntry"("cadastroId", "visibleToMember", "createdAt");
