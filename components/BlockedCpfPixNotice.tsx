import React from 'react';
import { Mail, QrCode } from 'lucide-react';
import AafabPixPayment, { PIX_KEY } from './AafabPixPayment';

export default function BlockedCpfPixNotice() {
  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:p-5"
      role="note"
      aria-label="Instruções para pagamento e liberação do cadastro"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
          <QrCode aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold">Pagamento da mensalidade para liberação</h3>
          <p className="mt-1 text-sm leading-relaxed">
            Seu CPF consta na relação da AAFAB e ainda precisa ser liberado para o cadastro. Faça o
            pagamento, envie o comprovante à Secretaria e aguarde o código de liberação.
          </p>
        </div>
      </div>

      <AafabPixPayment />

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="flex items-center gap-2 font-bold">
          <Mail aria-hidden="true" className="h-4 w-4" /> Depois do pagamento
        </p>
        <p className="mt-1 leading-relaxed">
          Envie o comprovante para a Secretaria da AAFAB. Após a conferência, a Secretaria libera o
          CPF e envia o código. Volte a esta tela, consulte novamente e informe o código recebido.
        </p>
        <a
          href={`mailto:${PIX_KEY}?subject=Comprovante%20de%20mensalidade%20AAFAB`}
          className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white"
        >
          Abrir e-mail da Secretaria
        </a>
      </div>
    </div>
  );
}
