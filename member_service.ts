import { getBackendUrl } from './utils';
import { memberSession } from './member_session';

export interface MemberProfile {
  id: number;
  cpf: string;
  nome: string;
  estado: string;
  turma: string;
  rg: string;
  email: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
  cep: string;
  dataCadastro: string;
  status: string;
}

export interface MemberPost {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: 'INSTITUCIONAL' | 'TRABALHO' | 'SECRETARIA' | 'FINANCEIRO';
  publishedAt: string;
  attachments: Array<{
    id: number;
    title: string;
    fileName: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }>;
}

export interface MemberSecretaryEntry {
  id: number;
  kind: 'ATENDIMENTO' | 'SOLICITACAO' | 'PENDENCIA' | 'ISENCAO';
  attachments?: Array<{ id: number; fileName: string; mimeType: string; size: number }>;
  title: string;
  description: string;
  status: 'ABERTO' | 'EM_ANDAMENTO' | 'CONCLUIDO';
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: number;
    sender: 'MEMBER' | 'ADMIN';
    content: string;
    createdAt: string;
  }>;
}

export interface MemberFee {
  id: number;
  competence: string;
  amountCents: number;
  dueDate: string;
  notes: string;
  status: 'PAGO' | 'ABERTO' | 'VENCIDO' | 'EM_ANALISE' | 'ISENTO';
  exemption?: null | { reason: string; grantedBy: string; createdAt: string };
  proof: null | {
    id: number;
    fileName: string;
    mimeType: string;
    size: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    submittedAt: string;
    reviewedAt: string | null;
    rejectionReason: string | null;
  };
  payment: null | {
    amountCents: number;
    paidAt: string;
    method: string;
  };
}

export interface MemberOverview {
  profile: MemberProfile;
  posts: MemberPost[];
  secretary: { entries: MemberSecretaryEntry[] };
  finance: {
    currentYear?: number;
    fees: MemberFee[];
    standaloneProofs: StandalonePaymentProof[];
    receivedCents: number;
    openCents: number;
    overdueCents: number;
    reviewCents: number;
  };
}

export type StandalonePaymentProof = NonNullable<MemberFee['proof']> & {
  competence: string;
  amountCents: number;
};

export interface PixCharge {
  key: string;
  receiverName: string;
  receiverCity: string;
  amountCents: number;
  txid: string;
  payload: string;
}

type MemberAuthentication = {
  token: string;
  expiresIn: string;
  profile: MemberProfile;
};

async function publicRequest<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getBackendUrl()}/member${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Servidor indisponível. Aguarde alguns instantes e tente novamente.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir o acesso.');
  return data as T;
}

async function authenticatedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = memberSession.get();
  if (!token) throw new Error('Sua sessão expirou. Entre novamente no portal.');
  let response: Response;
  try {
    response = await fetch(`${getBackendUrl()}/member${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error('Não foi possível comunicar com o servidor. Tente novamente.');
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    memberSession.clear();
    throw new Error('Sua sessão expirou. Entre novamente no portal.');
  }
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data as T;
}

async function authenticatedDownload(path: string, fileName: string): Promise<void> {
  const token = memberSession.get();
  if (!token) throw new Error('Sua sessão expirou. Entre novamente no portal.');
  const response = await fetch(`${getBackendUrl()}/member${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    memberSession.clear();
    throw new Error('Sua sessão expirou. Entre novamente no portal.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Não foi possível baixar o arquivo.');
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function memberFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}

export type ActivationEmailResult =
  | { status: 'EMAIL_SENT'; maskedEmail: string; expiresInMinutes: number }
  | { status: 'WAIT'; retryInSeconds: number }
  | { status: 'NOT_FOUND' | 'NEEDS_REGISTRATION' | 'HAS_PASSWORD' | 'CONTACT_SECRETARY' };

export const MemberService = {
  requestActivationEmail(cpf: string): Promise<ActivationEmailResult> {
    return publicRequest<ActivationEmailResult>('/activation-email', { cpf });
  },

  async login(cpf: string, password: string): Promise<MemberAuthentication> {
    const result = await publicRequest<MemberAuthentication>('/login', { cpf, password });
    memberSession.set(result.token);
    return result;
  },

  async activate(cpf: string, code: string, password: string): Promise<MemberAuthentication> {
    const result = await publicRequest<MemberAuthentication>('/activate', {
      cpf,
      code,
      password,
    });
    memberSession.set(result.token);
    return result;
  },

  overview(signal?: AbortSignal): Promise<MemberOverview> {
    return authenticatedRequest<MemberOverview>('/overview', { signal });
  },

  createSecretaryRequest(title: string, description: string): Promise<MemberSecretaryEntry> {
    return authenticatedRequest<MemberSecretaryEntry>('/secretaria/requests', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
  },

  replySecretaryRequest(id: number, content: string): Promise<MemberSecretaryEntry> {
    return authenticatedRequest<MemberSecretaryEntry>(`/secretaria/requests/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  pixForFee(id: number): Promise<PixCharge> {
    return authenticatedRequest<PixCharge>(`/finance/fees/${id}/pix`);
  },

  sendPaymentProof(
    feeId: number,
    file: { fileName: string; mimeType: string; content: string },
  ): Promise<{ id: number; status: 'PENDING' }> {
    return authenticatedRequest('/finance/proofs', {
      method: 'POST',
      body: JSON.stringify({ feeId, ...file }),
    });
  },

  downloadPaymentProof(id: number, fileName: string): Promise<void> {
    return authenticatedDownload(`/finance/proofs/${id}/file`, fileName);
  },

  sendPaymentProofForMonth(
    competence: string,
    file: { fileName: string; mimeType: string; content: string },
  ): Promise<{ id: number; status: 'PENDING' }> {
    return authenticatedRequest('/finance/proofs', {
      method: 'POST',
      body: JSON.stringify({ competence, ...file }),
    });
  },

  createExemptionRequest(request: {
    description: string;
    period?: string;
    file?: { fileName: string; mimeType: string; content: string };
  }): Promise<{ id: number }> {
    return authenticatedRequest('/secretaria/exemption-requests', {
      method: 'POST',
      body: JSON.stringify({
        description: request.description,
        ...(request.period ? { period: request.period } : {}),
        ...request.file,
      }),
    });
  },

  downloadEntryAttachment(id: number, fileName: string): Promise<void> {
    return authenticatedDownload(`/secretaria/attachments/${id}/file`, fileName);
  },

  downloadPostAttachment(id: number, fileName: string): Promise<void> {
    return authenticatedDownload(`/comunicados/anexos/${id}/arquivo`, fileName);
  },

  async logout(): Promise<void> {
    await authenticatedRequest<{ success: boolean }>('/logout', { method: 'POST' });
  },
};
