import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import {
  MemberService,
  memberFileBase64,
  type MemberFee,
  type StandalonePaymentProof,
} from '../../member_service';

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const statusLabels: Record<MemberFee['status'], string> = {
  PAGO: 'Pago',
  ABERTO: 'Em aberto',
  VENCIDO: 'Vencido',
  EM_ANALISE: 'Em análise',
  ISENTO: 'Isento',
};

export default function PaymentProofForm({
  fees,
  proofs,
  currentYear,
  onSent,
}: {
  fees: MemberFee[];
  proofs: StandalonePaymentProof[];
  currentYear?: number;
  onSent: () => void;
}) {
  const [competence, setCompetence] = useState(() =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date())
      .slice(0, 7),
  );
  const nowYear = currentYear ?? new Date().getFullYear();
  // Ano vigente (muda sozinho em janeiro) e anos anteriores com histórico.
  const years = Array.from(
    new Set([nowYear, ...fees.map((item) => Number(item.competence.slice(0, 4)))]),
  )
    .filter((value) => value <= nowYear)
    .sort((a, b) => b - a);
  const [selectedYear, selectedMonth] = competence.split('-');
  const statusOf = (value: string): MemberFee['status'] | null => {
    const found = fees.find((item) => item.competence === value);
    if (found) return found.status;
    return proofs.some((item) => item.competence === value && item.status === 'PENDING')
      ? 'EM_ANALISE'
      : null;
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fee = fees.find((item) => item.competence === competence);
  const pending = statusOf(competence) === 'EM_ANALISE';
  const paid = fee?.status === 'PAGO' || fee?.status === 'ISENTO';
  const amount = ((fee?.amountCents ?? 4000) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || paid || pending) return;
    const form = event.currentTarget;
    const file = new FormData(form).get('proof') as File;
    setError('');
    setBusy(true);
    try {
      if (!file?.size || file.size > 5 * 1024 * 1024)
        throw new Error('Escolha um comprovante de até 5 MB.');
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))
        throw new Error('O comprovante deve ser PDF, JPG ou PNG.');
      await MemberService.sendPaymentProofForMonth(competence, {
        fileName: file.name,
        mimeType: file.type,
        content: await memberFileBase64(file),
      });
      form.reset();
      onSent();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar o comprovante.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="proof-upload-title"
      className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5"
    >
      <h3 id="proof-upload-title" className="text-lg font-bold text-blue-950">
        Já paguei · Enviar comprovante
      </h3>
      <p className="mt-1 text-sm text-blue-900">
        Escolha o mês do pagamento e anexe o comprovante. Cada mês mostra a situação atual; meses já
        pagos ou em análise não aceitam novo envio.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[300px_1fr]">
          <div className="text-sm font-bold text-gray-700">
            <label htmlFor="proof-month">Mês do pagamento</label>
            <div className="mt-2 grid grid-cols-[1fr_92px] gap-2">
              <select
                id="proof-month"
                name="competence"
                required
                value={competence}
                disabled={busy}
                onChange={(event) => {
                  setCompetence(event.target.value);
                  setError('');
                }}
                className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal"
              >
                {monthNames.map((name, index) => {
                  const value = `${selectedYear}-${String(index + 1).padStart(2, '0')}`;
                  const status = statusOf(value);
                  return (
                    <option key={value} value={value}>
                      {name}
                      {status ? ` · ${statusLabels[status]}` : ''}
                    </option>
                  );
                })}
              </select>
              <select
                aria-label="Ano do pagamento"
                value={selectedYear}
                disabled={busy}
                onChange={(event) => {
                  setCompetence(`${event.target.value}-${selectedMonth}`);
                  setError('');
                }}
                className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 font-normal"
              >
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="text-sm font-bold text-gray-700">
            Anexar comprovante (PDF, JPG ou PNG, até 5 MB)
            <input
              type="file"
              name="proof"
              required
              disabled={busy || paid || pending}
              accept="application/pdf,image/jpeg,image/png"
              className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
        </div>
        <p className="text-sm text-blue-950">
          Valor da mensalidade: <strong>{amount}</strong>. A Secretaria precisa aprovar o
          comprovante para confirmar o pagamento.
        </p>
        {(paid || pending) && (
          <p role="status" className="text-sm font-semibold text-blue-900">
            {paid
              ? fee?.status === 'ISENTO'
                ? 'Este mês está isento pelo Financeiro.'
                : 'Este mês já está pago.'
              : 'O comprovante deste mês já está em análise. Aguarde a Secretaria.'}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || paid || pending || !competence}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {busy ? 'Enviando…' : 'Enviar comprovante para a Secretaria'}
        </button>
      </form>
    </section>
  );
}
