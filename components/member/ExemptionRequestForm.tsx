import React, { useState } from 'react';
import { HeartHandshake, Upload } from 'lucide-react';
import { MemberService, memberFileBase64 } from '../../member_service';

export default function ExemptionRequestForm({ onSent }: { onSent: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('document') as File;
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      let attachment;
      if (file?.size) {
        if (file.size > 5 * 1024 * 1024) throw new Error('O documento deve ter até 5 MB.');
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))
          throw new Error('O documento deve ser PDF, JPG ou PNG.');
        attachment = {
          fileName: file.name,
          mimeType: file.type,
          content: await memberFileBase64(file),
        };
      }
      await MemberService.createExemptionRequest({
        description: String(data.get('description')),
        period: String(data.get('period') || '').trim() || undefined,
        file: attachment,
      });
      form.reset();
      setSuccess(
        'Pedido enviado à Secretaria. Ela conferirá e encaminhará ao Financeiro, que responderá aqui mesmo.',
      );
      onSent();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar o pedido.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex items-center gap-2">
        <HeartHandshake className="h-5 w-5 text-violet-600" />
        <h3 className="font-bold text-gray-900">Pedir isenção de mensalidades</h3>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Em caso de dificuldade, como desemprego ou doença, explique a situação e, se puder, anexe um
        laudo ou documento que comprove. A Secretaria confere e o Financeiro decide.
      </p>
      <div className="mt-4 grid gap-4">
        <label className="text-sm font-semibold text-gray-700">
          Período desejado (opcional)
          <input
            name="period"
            maxLength={200}
            className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            placeholder="Ex.: de janeiro a junho de 2027"
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Justificativa
          <textarea
            name="description"
            required
            maxLength={3000}
            rows={4}
            className="mt-1.5 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            placeholder="Conte o motivo do pedido."
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Laudo ou documento comprobatório (opcional · PDF, JPG ou PNG, até 5 MB)
          <input
            type="file"
            name="document"
            accept="application/pdf,image/jpeg,image/png"
            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-3 text-sm font-semibold text-green-700">
          {success}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 flex min-h-11 items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        {busy ? 'Enviando…' : 'Enviar pedido de isenção'}
      </button>
    </form>
  );
}
