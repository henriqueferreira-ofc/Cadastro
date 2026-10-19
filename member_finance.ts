import type { MemberFee, StandalonePaymentProof } from './member_service';

export type FinanceFilter = 'TODOS' | MemberFee['status'];

export const financeCategories: Array<{
  status: MemberFee['status'];
  label: string;
}> = [
  { status: 'PAGO', label: 'Pago' },
  { status: 'ABERTO', label: 'Em aberto' },
  { status: 'VENCIDO', label: 'Vencido' },
  { status: 'EM_ANALISE', label: 'Em análise' },
];

export function memberFinance(
  fees: MemberFee[],
  year: string,
  status: FinanceFilter,
  proofs: StandalonePaymentProof[] = [],
) {
  const yearFees = fees.filter((fee) => year === 'TODOS' || fee.competence.slice(0, 4) === year);
  const yearProofs = proofs.filter(
    (proof) => year === 'TODOS' || proof.competence.slice(0, 4) === year,
  );
  const categories = financeCategories.map((category) => {
    const categoryFees = yearFees.filter((fee) => fee.status === category.status);
    const categoryProofs =
      category.status === 'EM_ANALISE'
        ? yearProofs.filter((proof) => proof.status === 'PENDING')
        : [];
    return {
      ...category,
      fees: categoryFees,
      proofs: categoryProofs,
      count: categoryFees.length + categoryProofs.length,
      total:
        categoryFees.reduce((sum, fee) => sum + (fee.payment?.amountCents ?? fee.amountCents), 0) +
        categoryProofs.reduce((sum, proof) => sum + proof.amountCents, 0),
    };
  });
  return {
    exempt: yearFees.filter((fee) => fee.status === 'ISENTO'),
    categories,
    fees: yearFees.filter((fee) => status === 'TODOS' || fee.status === status),
    proofs: yearProofs.filter(
      (proof) => status === 'TODOS' || (status === 'EM_ANALISE' && proof.status === 'PENDING'),
    ),
  };
}
