-- Portal do Associado: contas vinculadas aos cadastros existentes.
-- Migração aditiva, sem alterar ou excluir registros atuais.
CREATE TABLE "MemberAccount" (
    "id" SERIAL NOT NULL,
    "cadastroId" INTEGER NOT NULL,
    "passwordHash" TEXT,
    "passwordCreatedAt" TIMESTAMP(3),
    "activationCodeHash" TEXT,
    "activationCodeExpiresAt" TIMESTAMP(3),
    "activationCodeUsedAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssociationPost" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'INSTITUCIONAL',
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "audience" TEXT NOT NULL DEFAULT 'ASSOCIADOS',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssociationPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberAccount_cadastroId_key" ON "MemberAccount"("cadastroId");
CREATE INDEX "MemberAccount_activationCodeExpiresAt_idx" ON "MemberAccount"("activationCodeExpiresAt");
CREATE INDEX "MemberAccount_lockedUntil_idx" ON "MemberAccount"("lockedUntil");
CREATE INDEX "AssociationPost_status_publishedAt_idx" ON "AssociationPost"("status", "publishedAt");
CREATE INDEX "AssociationPost_category_publishedAt_idx" ON "AssociationPost"("category", "publishedAt");

ALTER TABLE "MemberAccount" ADD CONSTRAINT "MemberAccount_cadastroId_fkey"
  FOREIGN KEY ("cadastroId") REFERENCES "Cadastro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MemberAccount" ADD CONSTRAINT "MemberAccount_nonnegative_login_failures"
  CHECK ("failedLoginCount" >= 0 AND "failedLoginCount" <= 1000);
ALTER TABLE "AssociationPost" ADD CONSTRAINT "AssociationPost_valid_category"
  CHECK ("category" IN ('INSTITUCIONAL', 'TRABALHO', 'SECRETARIA', 'FINANCEIRO'));
ALTER TABLE "AssociationPost" ADD CONSTRAINT "AssociationPost_valid_status"
  CHECK ("status" IN ('RASCUNHO', 'PUBLICADO', 'ARQUIVADO'));
ALTER TABLE "AssociationPost" ADD CONSTRAINT "AssociationPost_valid_audience"
  CHECK ("audience" IN ('ASSOCIADOS', 'TODOS'));
