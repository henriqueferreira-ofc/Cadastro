/*
  Warnings:

  - Added the required column `cep` to the `Cadastro` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cadastro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cpf" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "turma_cesd" TEXT NOT NULL,
    "rg" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "certidao_obito" TEXT,
    "data_envio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'CONCLUÍDO'
);
INSERT INTO "new_Cadastro" ("bairro", "certidao_obito", "cidade", "cpf", "data_envio", "email", "endereco", "estado", "id", "nome", "rg", "status", "telefone", "turma_cesd") SELECT "bairro", "certidao_obito", "cidade", "cpf", "data_envio", "email", "endereco", "estado", "id", "nome", "rg", "status", "telefone", "turma_cesd" FROM "Cadastro";
DROP TABLE "Cadastro";
ALTER TABLE "new_Cadastro" RENAME TO "Cadastro";
CREATE UNIQUE INDEX "Cadastro_cpf_key" ON "Cadastro"("cpf");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
