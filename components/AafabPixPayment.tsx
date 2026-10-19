import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy } from 'lucide-react';

export const PIX_KEY = 'aafab.secretaria@gmail.com';
const PIX_QR_PAYLOAD =
  '00020126480014br.gov.bcb.pix0126aafab.secretaria@gmail.com520400005303986540540.005802BR5925ASSOCIACAO AMIGOS DA FORC6008BRASILIA62200516MensalidadeAAFAB630417E1';

const BANK_DETAILS = {
  bank: 'Caixa Econômica Federal',
  agency: '1041',
  account: '579018777-0',
  operation: '1292',
};

export default function AafabPixPayment() {
  const [copied, setCopied] = useState<'key' | 'payload' | null>(null);
  const [copyError, setCopyError] = useState('');
  const copy = async (value: string, field: 'key' | 'payload') => {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
    } catch {
      setCopyError(
        'Não foi possível copiar automaticamente. Selecione e copie a chave ou o código Pix abaixo.',
      );
    }
  };
  return (
    <div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)]">
        <div className="mx-auto w-fit self-start rounded-lg border border-amber-200 bg-white p-3 sm:mx-0">
          <QRCodeSVG value={PIX_QR_PAYLOAD} size={156} includeMargin title="QR Code Pix AAFAB" />
          <p className="mt-1 text-center text-[11px] font-semibold text-amber-800">
            QR Code Pix AAFAB
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-amber-200 bg-white p-4 text-sm">
          <h4 className="font-bold text-gray-900">Dados para pagamento</h4>
          <dl className="mt-3 grid grid-cols-[90px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-gray-700">
            <dt className="font-semibold">Valor</dt>
            <dd className="font-bold text-gray-900">R$ 40,00</dd>
            <dt className="font-semibold">Banco</dt>
            <dd>{BANK_DETAILS.bank}</dd>
            <dt className="font-semibold">Agência</dt>
            <dd>{BANK_DETAILS.agency}</dd>
            <dt className="font-semibold">Conta</dt>
            <dd>{BANK_DETAILS.account}</dd>
            <dt className="font-semibold">Operação</dt>
            <dd>{BANK_DETAILS.operation}</dd>
          </dl>

          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Chave Pix</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all text-xs font-semibold text-gray-800">
                {PIX_KEY}
              </code>
              <button
                type="button"
                onClick={() => void copy(PIX_KEY, 'key')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600"
                aria-label="Copiar chave Pix"
              >
                {copied === 'key' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void copy(PIX_QR_PAYLOAD, 'payload')}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
          >
            {copied === 'payload' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === 'payload' ? 'Código Pix copiado' : 'Copiar Pix Copia e Cola'}
          </button>
        </div>
      </div>

      <label className="mt-3 block text-xs font-semibold text-gray-600">
        Pix copia e cola
        <textarea
          readOnly
          value={PIX_QR_PAYLOAD}
          rows={3}
          onFocus={(event) => event.currentTarget.select()}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-normal"
        />
      </label>
      {copyError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {copyError}
        </p>
      )}
    </div>
  );
}
