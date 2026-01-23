import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode } from 'lucide-react';

const PIX_KEY = 'aafab.secretaria@gmail.com';
// Payload EMV "Pix Copia e Cola" (pagável via QR). Mantém exatamente como fornecido.
const PIX_QR_PAYLOAD =
  '00020126480014br.gov.bcb.pix0126aafab.secretaria@gmail.com520400005303986540540.005802BR5925ASSOCIACAO AMIGOS DA FORC6008BRASILIA62200516MensalidadeAAFAB630417E1';

const BANK_DETAILS = {
  bank: 'Caixa Econômica Federal',
  agency: '1041',
  account: '579018777-0',
  operation: '1292',
};

type BlockedCpfPixNoticeProps = {
  className?: string;
};

const isPixFeatureEnabled = () => {
  const raw = (import.meta as any)?.env?.VITE_SHOW_PIX_ON_BLOCKED_CPF;
  // Default ON to satisfy the requested behavior; set to 'false' to disable.
  return String(raw ?? 'true').toLowerCase() !== 'false';
};

const BlockedCpfPixNotice: React.FC<BlockedCpfPixNoticeProps> = ({ className }) => {
  if (!isPixFeatureEnabled()) return null;

  return (
    <div
      className={
        className ||
        'mt-4 bg-red-50 border border-red-200 rounded-lg p-4 sm:p-5 text-red-700'
      }
      role="note"
      aria-label="Instruções para liberação do CPF"
    >
      <div className="flex items-start gap-3">
        <div className="bg-red-100 rounded-md p-2 flex-shrink-0">
          <QrCode className="w-5 h-5 text-red-700" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm sm:text-base text-red-700">CPF Bloqueado ou Não Encontrado</p>
          <p className="text-xs sm:text-sm mt-1 leading-relaxed">
            Após o pagamento, apresente o comprovante para o Lider do Estado e terá liberação da
            AAFAB.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-4 sm:items-start">
        <div className="bg-white rounded-lg border border-red-200 p-3 w-fit">
          <QRCodeSVG value={PIX_QR_PAYLOAD} size={156} includeMargin />
          <p className="mt-2 text-[10px] text-red-700 text-center">QR Code (Pix)</p>
        </div>

        <div className="flex-1">
          <p className="font-semibold text-xs sm:text-sm text-red-700">Dados para pagamento (AAFAB)</p>
          <div className="mt-2 text-xs sm:text-sm space-y-1">
            <p>
              <span className="font-semibold">Banco:</span> {BANK_DETAILS.bank}
            </p>
            <p>
              <span className="font-semibold">Ag.:</span> {BANK_DETAILS.agency}
            </p>
            <p>
              <span className="font-semibold">CC.:</span> {BANK_DETAILS.account}
            </p>
            <p>
              <span className="font-semibold">Operação:</span> {BANK_DETAILS.operation}
            </p>
            <p className="pt-2">
              <span className="font-semibold">Pix:</span>{' '}
              <span className="font-mono break-all select-all">{PIX_KEY}</span>
            </p>

            <p className="pt-2">
              <span className="font-semibold">Pix (Copia e Cola):</span>{' '}
              <span className="font-mono break-all select-all">{PIX_QR_PAYLOAD}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockedCpfPixNotice;
