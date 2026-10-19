export class InputError extends Error {}
export class ConflictError extends Error {}

export const kinds = ['ATENDIMENTO', 'SOLICITACAO', 'PENDENCIA', 'OBSERVACAO'] as const;
export const statuses = ['ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO'] as const;
export const methods = ['PIX', 'TRANSFERENCIA', 'DINHEIRO', 'BOLETO', 'CARTAO', 'OUTRO'] as const;

export function textField(value: unknown, label: string, max: number, required = true): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw new InputError(`${label}: informe ${required ? 'de 1 a' : 'até'} ${max} caracteres.`);
  }
  return value.trim();
}

export function positiveInt(value: unknown, label = 'Identificador'): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > 2147483647
  ) {
    throw new InputError(`${label} inválido.`);
  }
  return value;
}

export function choice(value: unknown, options: readonly string[], label: string): string {
  if (typeof value !== 'string' || !options.includes(value))
    throw new InputError(`${label} inválido.`);
  return value;
}

export function dateOnly(value: unknown, label: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new InputError(`${label} inválida.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value < '2000-01-01' ||
    value > '2100-12-31'
  ) {
    throw new InputError(`${label} inválida.`);
  }
  return date;
}

export function month(value: unknown): string {
  if (typeof value !== 'string' || !/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value))
    throw new InputError('Mês de referência inválido.');
  return value;
}

export function cents(value: unknown): number {
  const amount = positiveInt(value, 'Valor');
  if (amount > 100000000) throw new InputError('Valor acima do limite de R$ 1.000.000,00.');
  return amount;
}

export function paymentDate(value: unknown): Date {
  const date = dateOnly(value, 'Data de pagamento');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  if (date.toISOString().slice(0, 10) > today)
    throw new InputError('O pagamento não pode ter uma data futura.');
  return date;
}

export function decodeDocument(value: unknown, mimeType: unknown): Buffer {
  choice(mimeType, ['application/pdf', 'image/jpeg', 'image/png'], 'Formato do documento');
  if (
    typeof value !== 'string' ||
    !value.length ||
    value.length > 7_000_000 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    throw new InputError('Arquivo inválido. Envie PDF, JPG ou PNG de até 5 MB.');
  }
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024 || buffer.toString('base64') !== value)
    throw new InputError('Arquivo inválido ou maior que 5 MB.');
  const valid =
    mimeType === 'application/pdf'
      ? buffer.subarray(0, 5).toString() === '%PDF-'
      : mimeType === 'image/png'
        ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (!valid) throw new InputError('O conteúdo do arquivo não corresponde ao formato informado.');
  return buffer;
}
