import { getBackendUrl } from './utils';
import type { CadastroEnviado } from './types';
import { adminSession } from './admin_session';

export type Associate = CadastroEnviado;
export type EntryStatus = 'ABERTO' | 'EM_ANDAMENTO' | 'CONCLUIDO';
export type EntryKind = 'ATENDIMENTO' | 'SOLICITACAO' | 'PENDENCIA' | 'OBSERVACAO' | 'ISENCAO';
export interface EntryAttachment {
  id: number;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}
export interface ExemptionRequest {
  id: number;
  title: string;
  description: string;
  status: EntryStatus;
  createdAt: string;
  forwardedToFinanceAt: string | null;
  cadastro: { id: number; nome: string; cpf: string };
  messages: { id: number; sender: 'MEMBER' | 'ADMIN'; content: string; createdAt: string }[];
  attachments: EntryAttachment[];
}
export interface OfficeEntry {
  id: number;
  cadastroId: number;
  kind: EntryKind;
  title: string;
  description: string;
  status: EntryStatus;
  visibleToMember: boolean;
  forwardedToFinanceAt?: string | null;
  attachments?: EntryAttachment[];
  dueDate: string | null;
  createdAt: string;
  events: { id: number; status: EntryStatus; note: string; createdAt: string }[];
  messages: { id: number; sender: 'MEMBER' | 'ADMIN'; content: string; createdAt: string }[];
}
export interface AssociateDocument {
  id: number;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}
export interface OfficeData {
  entries: OfficeEntry[];
  documents: AssociateDocument[];
}
export interface MonthlyFee {
  id: number;
  cadastroId: number;
  competence: string;
  amountCents: number;
  dueDate: string;
  notes: string;
  createdAt: string;
  cadastro: { id: number; cpf: string; nome: string };
  payment: null | {
    id: number;
    amountCents: number;
    paidAt: string;
    method: string;
    reference: string;
    createdAt: string;
  };
  exemption: null | { id: number; reason: string; grantedBy: string; createdAt: string };
  proofs: PaymentProofSummary[];
}

export interface PaymentProofSummary {
  id: number;
  feeId: number | null;
  fileName: string;
  mimeType: string;
  size: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface AdminPaymentProof extends PaymentProofSummary {
  reviewedBy?: string | null;
  competence: string;
  amountCents: number;
  cadastro: { id: number; cpf: string; nome: string };
  fee: {
    id: number;
    competence: string;
    amountCents: number;
    dueDate: string;
    payment: MonthlyFee['payment'];
    cadastro: { id: number; cpf: string; nome: string };
  } | null;
}

export const kindLabels: Record<EntryKind, string> = {
  ATENDIMENTO: 'Atendimento',
  SOLICITACAO: 'Solicitação',
  PENDENCIA: 'Pendência',
  OBSERVACAO: 'Observação',
  ISENCAO: 'Pedido de isenção',
};
export const statusLabels: Record<EntryStatus, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
};
export const paymentMethods: Record<string, string> = {
  PIX: 'Pix',
  TRANSFERENCIA: 'Transferência',
  DINHEIRO: 'Dinheiro',
  BOLETO: 'Boleto',
  CARTAO: 'Cartão',
  OUTRO: 'Outro',
};
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const money = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const shortDate = (value?: string | null) =>
  value ? value.slice(0, 10).split('-').reverse().join('/') : '—';
export const dateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
export const monthLabel = (value: string) => value.split('-').reverse().join('/');
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function matchesAssociate(associate: { nome: string; cpf: string }, search: string) {
  const query = search.trim();
  const digits = query.replace(/\D/g, '');
  return (
    normalizeSearch(associate.nome).includes(normalizeSearch(query)) ||
    (!!digits && /^[\d.\-\s]+$/.test(query) && associate.cpf.includes(digits))
  );
}
export function parseMoney(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(/^R\$/, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized))
    throw new Error('Informe o valor em reais, por exemplo: 50,00.');
  const [whole, fraction = ''] = normalized.replace(/\./g, '').split(',');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000)
    throw new Error('Informe um valor entre R$ 0,01 e R$ 1.000.000,00.');
  return cents;
}
export function feeStatus(
  fee: Pick<MonthlyFee, 'payment' | 'dueDate'> & { exemption?: MonthlyFee['exemption'] },
): 'PAGO' | 'ISENTO' | 'ABERTO' | 'VENCIDO' {
  if (fee.payment) return 'PAGO';
  if (fee.exemption) return 'ISENTO';
  return fee.dueDate.slice(0, 10) < today() ? 'VENCIDO' : 'ABERTO';
}
// Meses consecutivos a partir de "AAAA-MM", para isentar vários meses de uma vez.
export function monthRange(start: string, count: number): string[] {
  const [year, month] = start.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const total = year * 12 + (month - 1) + index;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}

async function request(path: string, options: RequestInit = {}) {
  const token = adminSession.get();
  if (!token) throw new Error('Sua sessão expirou. Volte ao início e entre novamente no painel.');
  const response = await fetch(`${getBackendUrl()}/gestao${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401)
      throw new Error('Sua sessão expirou. Volte ao início e entre novamente no painel.');
    throw new Error(data.error || 'Não foi possível acessar o servidor. Tente novamente.');
  }
  return response;
}

async function download(path: string, fileName: string) {
  const response = await request(path);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function managementApi<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await request(path, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal,
  });
  return response.json();
}
export async function downloadDocument(document: AssociateDocument) {
  await download(`/documentos/${document.id}/arquivo`, document.fileName);
}
export async function downloadPaymentProof(proof: PaymentProofSummary) {
  await download(`/comprovantes/${proof.id}/arquivo`, proof.fileName);
}
export async function downloadEntryAttachment(attachment: EntryAttachment) {
  await download(`/secretaria/anexos/${attachment.id}/arquivo`, attachment.fileName);
}
export async function downloadPostAttachment(attachment: { id: number; fileName: string }) {
  await download(`/comunicados/anexos/${attachment.id}/arquivo`, attachment.fileName);
}
export function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}

export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const safe = /^[\t\r\n]|^\s*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
