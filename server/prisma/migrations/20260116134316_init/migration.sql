-- CreateTable
CREATE TABLE "Cadastro" (
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
    "certidao_obito" TEXT,
    "data_envio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'CONCLUÍDO'
);

-- CreateIndex
CREATE UNIQUE INDEX "Cadastro_cpf_key" ON "Cadastro"("cpf");
