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
