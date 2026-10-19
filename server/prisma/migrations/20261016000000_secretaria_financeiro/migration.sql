-- CreateTable
CREATE TABLE "OfficeEntry" (
    "id" SERIAL NOT NULL,
    "cadastroId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "dueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeEvent" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssociateDocument" (
    "id" SERIAL NOT NULL,
    "cadastroId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssociateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyFee" (
    "id" SERIAL NOT NULL,
    "cadastroId" INTEGER NOT NULL,
    "competence" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePayment" (
    "id" SERIAL NOT NULL,
    "feeId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" DATE NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfficeEntry_cadastroId_createdAt_idx" ON "OfficeEntry"("cadastroId", "createdAt");

-- CreateIndex
CREATE INDEX "AssociateDocument_cadastroId_createdAt_idx" ON "AssociateDocument"("cadastroId", "createdAt");

-- CreateIndex
CREATE INDEX "MonthlyFee_competence_dueDate_idx" ON "MonthlyFee"("competence", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyFee_cadastroId_competence_key" ON "MonthlyFee"("cadastroId", "competence");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_feeId_key" ON "FeePayment"("feeId");

-- AddForeignKey
ALTER TABLE "OfficeEntry" ADD CONSTRAINT "OfficeEntry_cadastroId_fkey" FOREIGN KEY ("cadastroId") REFERENCES "Cadastro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeEvent" ADD CONSTRAINT "OfficeEvent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "OfficeEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssociateDocument" ADD CONSTRAINT "AssociateDocument_cadastroId_fkey" FOREIGN KEY ("cadastroId") REFERENCES "Cadastro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyFee" ADD CONSTRAINT "MonthlyFee_cadastroId_fkey" FOREIGN KEY ("cadastroId") REFERENCES "Cadastro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "MonthlyFee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "MonthlyFee" ADD CONSTRAINT "MonthlyFee_positive_amount" CHECK ("amountCents" > 0 AND "amountCents" <= 100000000);
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_positive_amount" CHECK ("amountCents" > 0);
ALTER TABLE "OfficeEntry" ADD CONSTRAINT "OfficeEntry_valid_kind" CHECK ("kind" IN ('ATENDIMENTO','SOLICITACAO','PENDENCIA','OBSERVACAO'));
ALTER TABLE "OfficeEntry" ADD CONSTRAINT "OfficeEntry_valid_status" CHECK ("status" IN ('ABERTO','EM_ANDAMENTO','CONCLUIDO'));
