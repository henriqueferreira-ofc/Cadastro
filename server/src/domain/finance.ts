import { Prisma } from '@prisma/client';

export const MONTHLY_AMOUNT_CENTS = 4000;

// Também protege comprovantes enviados antes de existir uma mensalidade.
export async function lockFinancialAccount(tx: Prisma.TransactionClient, cadastroId: number) {
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') || 'public';
  const table = Prisma.raw(`"${schema.replace(/"/g, '""')}"."Cadastro"`);
  await tx.$queryRaw`SELECT "id" FROM ${table} WHERE "id" = ${cadastroId} FOR UPDATE`;
}

// Serializa comprovantes e baixas da mesma mensalidade dentro da transação.
export async function lockMonthlyFee(tx: Prisma.TransactionClient, feeId: number) {
  // Conexões agrupadas podem reutilizar um search_path de outra sessão.
  // Use o mesmo schema das consultas Prisma, inclusive nos ambientes isolados.
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') || 'public';
  const table = Prisma.raw(`"${schema.replace(/"/g, '""')}"."MonthlyFee"`);
  await tx.$queryRaw`SELECT "id" FROM ${table} WHERE "id" = ${feeId} FOR UPDATE`;
}

export const DUE_DAY = 15;

// Data civil de Brasília: o vencimento (dia 15) vale até o fim desse dia.
export function saoPauloToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Garante as 12 competências do ano do associado, com vencimento no dia 15.
// Idempotente: a chave única (cadastroId, competence) impede duplicidade e nunca altera
// mensalidades já lançadas. Comprovantes avulsos do mesmo mês passam a apontar para a mensalidade.
export async function ensureYearFees(
  prisma: import('@prisma/client').PrismaClient,
  cadastroId: number,
  year: number,
): Promise<void> {
  const prefix = `${year}-`;
  const existing = await prisma.monthlyFee.count({
    where: { cadastroId, competence: { startsWith: prefix } },
  });
  if (existing >= 12) return;
  await prisma.$transaction(
    async (tx) => {
      await lockFinancialAccount(tx, cadastroId);
      await tx.monthlyFee.createMany({
        skipDuplicates: true,
        data: Array.from({ length: 12 }, (_, index) => {
          const mm = String(index + 1).padStart(2, '0');
          return {
            cadastroId,
            competence: `${year}-${mm}`,
            amountCents: MONTHLY_AMOUNT_CENTS,
            dueDate: new Date(`${year}-${mm}-${DUE_DAY}T00:00:00.000Z`),
          };
        }),
      });
      const loose = await tx.paymentProof.findMany({
        where: { cadastroId, feeId: null, competence: { startsWith: prefix } },
        select: { id: true, competence: true },
      });
      for (const proof of loose) {
        const fee = await tx.monthlyFee.findUnique({
          where: { cadastroId_competence: { cadastroId, competence: proof.competence } },
          select: { id: true },
        });
        if (fee) await tx.paymentProof.update({ where: { id: proof.id }, data: { feeId: fee.id } });
      }
    },
    { maxWait: 10000, timeout: 15000 },
  );
}
