import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import {
  MemberService,
  memberFileBase64,
  type MemberFee,
  type StandalonePaymentProof,
} from '../../member_service';

export default function PaymentProofForm({
  fees,
  proofs,
  onSent,
}: {
  fees: MemberFee[];
  proofs: StandalonePaymentProof[];
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fee = fees.find((item) => item.competence === competence);
  const pending =
    fee?.status === 'EM_ANALISE' ||
    proofs.some((item) => item.competence === competence && item.status === 'PENDING');
  const paid = fee?.status === 'PAGO';
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
        Escolha o mês do pagamento e anexe o comprovante. Você pode enviar mesmo que a mensalidade
        ainda não apareça na lista.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <label className="text-sm font-bold text-gray-700">
            Mês do pagamento
            <input
              type="month"
              name="competence"
              required
              min="2000-01"
              max="2100-12"
              value={competence}
              disabled={busy}
              onChange={(event) => {
                setCompetence(event.target.value);
                setError('');
              }}
              className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3"
            />
          </label>
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
              ? 'Este mês já está pago.'
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
