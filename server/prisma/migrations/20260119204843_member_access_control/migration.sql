-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('BLOCKED', 'ACTIVE');

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "cpf" TEXT NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'BLOCKED',
    "unlockedAt" TIMESTAMP(3),
    "unlockedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_cpf_key" ON "Member"("cpf");
