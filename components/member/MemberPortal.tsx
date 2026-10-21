import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileText,
  FolderOpen,
  Home,
  LogOut,
  Mail,
  MapPin,
  MessageSquarePlus,
  Phone,
  RefreshCw,
  UserRound,
  Wallet,
  Download,
  Upload,
  X,
} from 'lucide-react';
import {
  MemberFee,
  MemberOverview,
  MemberPost,
  MemberSecretaryEntry,
  MemberService,
  memberFileBase64,
} from '../../member_service';
import { memberSession } from '../../member_session';
import { memberFinance, type FinanceFilter } from '../../member_finance';
import { formatCEP, formatCPF, formatPhone } from '../../utils';
import AafabPixPayment from '../AafabPixPayment';
import PaymentProofForm from './PaymentProofForm';
import ExemptionRequestForm from './ExemptionRequestForm';
import MemberHome from './MemberHome';

type MemberPage = 'HOME' | 'WORK' | 'SECRETARY' | 'FINANCE' | 'PROFILE';

const feeColors: Record<MemberFee['status'], string> = {
  PAGO: 'text-green-700',
  ABERTO: 'text-amber-700',
  VENCIDO: 'text-red-700',
  EM_ANALISE: 'text-blue-700',
  ISENTO: 'text-violet-700',
};

const pages: Array<{
  id: MemberPage;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'HOME', label: 'Início', shortLabel: 'Início', icon: Home },
  { id: 'WORK', label: 'Trabalhos e comunicados', shortLabel: 'AAFAB', icon: Bell },
  { id: 'SECRETARY', label: 'Secretaria', shortLabel: 'Secretaria', icon: FolderOpen },
  { id: 'FINANCE', label: 'Meu financeiro', shortLabel: 'Financeiro', icon: Wallet },
  { id: 'PROFILE', label: 'Meus dados', shortLabel: 'Dados', icon: UserRound },
];

const categoryLabels: Record<MemberPost['category'], string> = {
  INSTITUCIONAL: 'AAFAB',
  TRABALHO: 'Trabalhos',
  SECRETARIA: 'Secretaria',
  FINANCEIRO: 'Financeiro',
};

const statusLabels: Record<MemberSecretaryEntry['status'], string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
};

const statusStyle: Record<MemberSecretaryEntry['status'], string> = {
  ABERTO: 'bg-amber-50 text-amber-800',
  EM_ANDAMENTO: 'bg-blue-50 text-blue-700',
  CONCLUIDO: 'bg-green-50 text-green-700',
};

const money = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      })
    : '—';
const dateOnly = (value?: string | null) =>
  value ? value.slice(0, 10).split('-').reverse().join('/') : '—';
const month = (value: string) => {
  const [year, rawMonth] = value.split('-').map(Number);
  if (!year || !rawMonth) return value;
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(year, rawMonth - 1, 1),
  );
};

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center">
      <Icon aria-hidden="true" className="mx-auto h-9 w-9 text-gray-300" />
      <h3 className="mt-3 font-bold text-gray-800">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-gray-500">{text}</p>
    </div>
  );
}

function PostCard({ post }: { post: MemberPost; key?: React.Key }) {
  const [downloadError, setDownloadError] = useState('');
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">
          {categoryLabels[post.category]}
        </span>
        <span className="text-xs text-gray-400">{date(post.publishedAt)}</span>
      </div>
      <h3 className="mt-3 text-lg font-bold text-gray-900">{post.title}</h3>
      <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600">{post.summary}</p>
      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-700">{post.content}</p>
      {!!post.attachments?.length && (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
            Arquivos e resultados
          </p>
          {post.attachments.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() =>
                MemberService.downloadPostAttachment(attachment.id, attachment.fileName).catch(
                  (caught) => setDownloadError(caught.message),
                )
              }
              className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 text-left text-sm font-semibold text-blue-800"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{attachment.title}</span>
            </button>
          ))}
          {downloadError && <p className="text-xs font-semibold text-red-600">{downloadError}</p>}
        </div>
      )}
    </article>
  );
}

function EntryCard({
  entry,
  onReply,
}: {
  entry: MemberSecretaryEntry;
  onReply: (id: number, content: string) => Promise<void>;
  key?: React.Key;
}) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !reply.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onReply(entry.id, reply);
      setReply('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
            {entry.kind === 'SOLICITACAO'
              ? 'Solicitação'
              : entry.kind === 'PENDENCIA'
                ? 'Pendência'
                : entry.kind === 'ISENCAO'
                  ? 'Pedido de isenção'
                  : 'Atendimento'}
          </p>
          <h3 className="mt-1 font-bold text-gray-900">{entry.title}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[entry.status]}`}>
          {statusLabels[entry.status]}
        </span>
      </div>
      {entry.messages?.length ? (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          {entry.messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[92%] rounded-lg px-3 py-2 text-sm ${message.sender === 'MEMBER' ? 'ml-auto bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              <p className="mb-1 text-[10px] font-bold uppercase opacity-70">
                {message.sender === 'MEMBER' ? 'Você' : 'Secretaria'} · {date(message.createdAt)}
              </p>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">
          {entry.description}
        </p>
      )}
      {!!entry.attachments?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.attachments.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() =>
                MemberService.downloadEntryAttachment(file.id, file.fileName).catch((caught) =>
                  setError(caught instanceof Error ? caught.message : 'Falha ao baixar.'),
                )
              }
              className="min-h-10 text-xs font-semibold text-blue-700 underline"
            >
              Baixar anexo enviado: {file.fileName}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-400">
        <span>Aberto em {date(entry.createdAt)}</span>
        {entry.dueDate && <span>Prazo: {date(entry.dueDate)}</span>}
      </div>
      {entry.status !== 'CONCLUIDO' && (
        <form onSubmit={submit} className="mt-4 border-t border-gray-100 pt-4">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Responder à Secretaria
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              required
              maxLength={5000}
              rows={3}
              placeholder="Escreva uma nova mensagem sobre este atendimento."
              className="mt-2 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal normal-case tracking-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !reply.trim()}
            className="mt-2 min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Enviando…' : 'Enviar mensagem'}
          </button>
        </form>
      )}
    </article>
  );
}

interface MemberPortalProps {
  onLogout: () => void;
}

export default function MemberPortal({ onLogout }: MemberPortalProps) {
  const [page, setPage] = useState<MemberPage>('HOME');
  const [overview, setOverview] = useState<MemberOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [financeFilter, setFinanceFilter] = useState<FinanceFilter>('TODOS');
  const [paymentFee, setPaymentFee] = useState<MemberFee | null>(null);
  const [paymentMode, setPaymentMode] = useState<'PIX' | 'PROOF'>('PIX');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [financeMessage, setFinanceMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    MemberService.overview(controller.signal)
      .then(setOverview)
      .catch((caught) => {
        if (controller.signal.aborted) return;
        const message =
          caught instanceof Error ? caught.message : 'Não foi possível abrir o portal.';
        setError(message);
        if (!memberSession.get()) onLogout();
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision, onLogout]);

  const years = useMemo(
    () =>
      Array.from(
        new Set<string>([
          String(overview?.finance.currentYear ?? new Date().getFullYear()),
          ...[...(overview?.finance.fees || []), ...(overview?.finance.standaloneProofs || [])].map(
            (item) => item.competence.slice(0, 4),
          ),
        ]),
      ).sort((a, b) => b.localeCompare(a)),
    [overview],
  );
  const {
    fees: filteredFees,
    proofs: filteredProofs,
    categories: financeGroups,
    exempt: exemptFees,
  } = memberFinance(
    overview?.finance.fees || [],
    year,
    financeFilter,
    overview?.finance.standaloneProofs || [],
  );

  const logout = async () => {
    try {
      await MemberService.logout();
    } catch {
      // A sessão local é removida mesmo se a API estiver temporariamente indisponível.
    }
    memberSession.clear();
    onLogout();
  };

  async function createRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSending(true);
    setRequestError('');
    setRequestSuccess('');
    try {
      await MemberService.createSecretaryRequest(
        String(form.get('title')),
        String(form.get('description')),
      );
      formElement.reset();
      setRequestSuccess('Sua solicitação foi enviada à Secretaria.');
      setRevision((current) => current + 1);
    } catch (caught) {
      setRequestError(caught instanceof Error ? caught.message : 'Não foi possível enviar.');
    } finally {
      setSending(false);
    }
  }

  async function replyRequest(id: number, content: string) {
    await MemberService.replySecretaryRequest(id, content);
    setRequestSuccess('Sua mensagem foi enviada à Secretaria.');
    setRevision((current) => current + 1);
  }

  function openPayment(fee: MemberFee, mode: 'PIX' | 'PROOF' = 'PIX') {
    setPaymentFee(fee);
    setPaymentMode(mode);
    setPaymentError('');
    setPaymentLoading(false);
  }

  async function sendProof(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentLoading || !paymentFee) return;
    const form = new FormData(event.currentTarget);
    const file = form.get('proof') as File;
    setPaymentError('');
    setPaymentLoading(true);
    try {
      if (!file?.size || file.size > 5 * 1024 * 1024) {
        throw new Error('Escolha um comprovante de até 5 MB.');
      }
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
        throw new Error('O comprovante deve ser PDF, JPG ou PNG.');
      }
      await MemberService.sendPaymentProof(paymentFee.id, {
        fileName: file.name,
        mimeType: file.type,
        content: await memberFileBase64(file),
      });
      setPaymentFee(null);
      setFinanceMessage(
        'Comprovante enviado. A mensalidade ficará “Em análise” até a conferência da Secretaria.',
      );
      setRevision((current) => current + 1);
    } catch (caught) {
      setPaymentError(
        caught instanceof Error ? caught.message : 'Não foi possível enviar o comprovante.',
      );
    } finally {
      setPaymentLoading(false);
    }
  }

  if (loading && !overview) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="mt-4 text-sm font-semibold text-gray-600">Carregando seu portal…</p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Não foi possível abrir o portal</h2>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setRevision((current) => current + 1)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600"
          >
            Voltar ao acesso
          </button>
        </div>
      </div>
    );
  }

  const { profile, posts, secretary } = overview;
  const firstName = profile.nome.trim().split(/\s+/)[0] || 'Associado';
  const pendingRequests = secretary.entries.filter((entry) => entry.status !== 'CONCLUIDO').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 px-5 py-6 text-white shadow-lg sm:px-8 sm:py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
              Área exclusiva do associado
            </p>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Olá, {firstName}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">
              Aqui você acompanha informações da AAFAB, seus atendimentos, mensalidades e dados
              pessoais.
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Sair com segurança
          </button>
        </div>
      </section>

      <nav
        aria-label="Portal do Associado"
        className="grid grid-cols-5 gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm sm:gap-2 sm:p-2"
      >
        {pages.map(({ id, label, shortLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPage(id)}
            aria-current={page === id ? 'page' : undefined}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-bold transition-colors sm:min-h-11 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm ${
              page === id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate sm:hidden">{shortLabel}</span>
            <span className="hidden truncate sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Alguns dados podem estar desatualizados. {error}
        </div>
      )}

      {page === 'HOME' && <MemberHome overview={overview} onNavigate={setPage} />}

      {page === 'WORK' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AAFAB: trabalhos e comunicados</h2>
            <p className="mt-1 text-sm text-gray-500">
              Acompanhe ações realizadas, atividades em andamento e avisos da Associação.
            </p>
          </div>
          {posts.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="Ainda não há publicações"
              text="A administração poderá publicar aqui os trabalhos e comunicados destinados aos associados."
            />
          )}
        </section>
      )}

      {page === 'SECRETARY' && (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Secretaria</h2>
            <p className="mt-1 text-sm text-gray-500">
              Envie uma solicitação e acompanhe apenas os registros ligados ao seu cadastro.
            </p>
          </div>
          <form
            onSubmit={createRequest}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
          >
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-gray-900">Nova solicitação</h3>
            </div>
            <div className="mt-4 grid gap-4">
              <label className="text-sm font-semibold text-gray-700">
                Assunto
                <input
                  name="title"
                  required
                  maxLength={160}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ex.: correção de telefone"
                />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Descrição
                <textarea
                  name="description"
                  required
                  maxLength={3000}
                  rows={4}
                  className="mt-1.5 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Explique o que você precisa para que a Secretaria possa atender."
                />
              </label>
            </div>
            {requestError && (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
                {requestError}
              </p>
            )}
            {requestSuccess && (
              <p role="status" className="mt-3 text-sm font-semibold text-green-700">
                {requestSuccess}
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="mt-4 min-h-11 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {sending ? 'Enviando…' : 'Enviar à Secretaria'}
            </button>
          </form>

          <ExemptionRequestForm onSent={() => setRevision((current) => current + 1)} />

          <div>
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              Meus atendimentos e solicitações
            </h3>
            {secretary.entries.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {secretary.entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} onReply={replyRequest} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FolderOpen}
                title="Nenhum atendimento registrado"
                text="Suas solicitações e os atendimentos da Secretaria aparecerão aqui."
              />
            )}
          </div>
        </section>
      )}

      {page === 'FINANCE' && (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Meu financeiro</h2>
              <p className="mt-1 text-sm text-gray-500">
                Consulte suas mensalidades e os pagamentos registrados pela AAFAB.
              </p>
            </div>
            <label className="text-xs font-bold text-gray-600">
              Ano
              <select
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="ml-2 min-h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="TODOS">Todos</option>
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {financeMessage && (
            <div
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800"
            >
              {financeMessage}
            </div>
          )}

          <PaymentProofForm
            fees={overview.finance.fees}
            proofs={overview.finance.standaloneProofs || []}
            currentYear={overview.finance.currentYear}
            onSent={() => {
              setFinanceMessage(
                'Comprovante enviado à Secretaria. O pagamento ficará em análise até a aprovação.',
              );
              setFinanceFilter('EM_ANALISE');
              setRevision((current) => current + 1);
            }}
          />

          <div
            className={`grid grid-cols-2 gap-3 ${exemptFees.length ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}
          >
            {[
              ...financeGroups,
              ...(exemptFees.length
                ? [
                    {
                      status: 'ISENTO' as const,
                      label: 'Isento',
                      fees: exemptFees,
                      proofs: [],
                      count: exemptFees.length,
                      total: exemptFees.reduce((sum, fee) => sum + fee.amountCents, 0),
                    },
                  ]
                : []),
            ].map((group) => (
              <button
                key={group.status}
                type="button"
                aria-pressed={financeFilter === group.status}
                aria-controls="finance-fees"
                onClick={() => setFinanceFilter(group.status)}
                className={`rounded-xl border bg-white p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${financeFilter === group.status ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300'}`}
              >
                <span className="block text-xs font-medium text-gray-500">{group.label}</span>
                <span className={`mt-1 block text-3xl font-extrabold ${feeColors[group.status]}`}>
                  {group.count}
                  <span className="ml-1.5 text-sm font-semibold text-gray-400">
                    {group.count === 1 ? 'mensalidade' : 'mensalidades'}
                  </span>
                </span>
                <span className="mt-1 block text-sm font-semibold text-gray-500">
                  {money(group.total)}
                </span>
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {group.fees.length || group.proofs.length ? (
                    [
                      ...group.fees.map((fee) => ({ ...fee, key: `fee-${fee.id}` })),
                      ...group.proofs.map((proof) => ({ ...proof, key: `proof-${proof.id}` })),
                    ].map((item) => (
                      <span
                        key={item.key}
                        className="rounded-md bg-gray-50 px-2 py-1 text-xs capitalize text-gray-700"
                      >
                        {month(item.competence)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">Nenhum mês nesta situação</span>
                  )}
                </span>
                <span className="mt-3 block text-xs font-semibold text-blue-700">
                  Ver mensalidades
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm font-semibold text-gray-600">
              {financeFilter === 'TODOS'
                ? 'Todas as situações'
                : financeGroups.find((group) => group.status === financeFilter)?.label}
              {' · '}
              {filteredFees.length} mensalidade(s)
              {!!filteredProofs.length && ` · ${filteredProofs.length} comprovante(s) enviado(s)`}
            </p>
            <button
              type="button"
              onClick={() => setFinanceFilter('TODOS')}
              aria-pressed={financeFilter === 'TODOS'}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Ver todas as situações
            </button>
          </div>

          <div id="finance-fees">
            {filteredFees.length ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="hidden grid-cols-[1.1fr_1fr_1fr_1fr_auto] gap-3 border-b bg-gray-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 sm:grid">
                  <span>Referência</span>
                  <span>Vencimento</span>
                  <span>Valor</span>
                  <span>Situação</span>
                  <span>Ação</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {filteredFees.map((fee) => (
                    <article
                      key={fee.id}
                      className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-[1.1fr_1fr_1fr_1fr_auto] sm:items-center sm:px-5"
                    >
                      <div>
                        <p className="text-xs font-medium text-gray-400 sm:hidden">Referência</p>
                        <p className="font-bold capitalize text-gray-900">
                          {month(fee.competence)}
                        </p>
                        {fee.notes && <p className="mt-1 text-xs text-gray-500">{fee.notes}</p>}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 sm:hidden">Vencimento</p>
                        <span>{dateOnly(fee.dueDate)}</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 sm:hidden">Valor</p>
                        <span className="font-semibold">{money(fee.amountCents)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:block">
                        <div>
                          <p className="text-xs font-medium text-gray-400 sm:hidden">Situação</p>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                              fee.status === 'PAGO'
                                ? 'bg-green-50 text-green-700'
                                : fee.status === 'EM_ANALISE'
                                  ? 'bg-blue-50 text-blue-700'
                                  : fee.status === 'VENCIDO'
                                    ? 'bg-red-50 text-red-700'
                                    : fee.status === 'ISENTO'
                                      ? 'bg-violet-50 text-violet-700'
                                      : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {fee.status === 'PAGO'
                              ? 'Pago'
                              : fee.status === 'EM_ANALISE'
                                ? 'Em análise'
                                : fee.status === 'VENCIDO'
                                  ? 'Vencido'
                                  : fee.status === 'ISENTO'
                                    ? 'Isento'
                                    : 'Em aberto'}
                          </span>
                        </div>
                        {fee.payment && (
                          <p className="mt-1 text-xs text-gray-400">
                            Pago em {dateOnly(fee.payment.paidAt)}
                          </p>
                        )}
                        {fee.exemption && (
                          <p className="mt-1 text-xs text-violet-700">
                            Isento pelo Financeiro: {fee.exemption.reason}
                          </p>
                        )}
                        {fee.proof?.status === 'REJECTED' && (
                          <p className="mt-1 text-xs font-semibold text-red-600">
                            Recusado: {fee.proof.rejectionReason || 'procure o Financeiro.'}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-start gap-2">
                        {!fee.payment && fee.status !== 'EM_ANALISE' && fee.status !== 'ISENTO' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void openPayment(fee)}
                              className="min-h-10 whitespace-nowrap rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"
                            >
                              Pagar via Pix
                            </button>
                            <button
                              type="button"
                              onClick={() => void openPayment(fee, 'PROOF')}
                              className="min-h-10 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-700"
                            >
                              Já paguei · Enviar comprovante
                            </button>
                          </>
                        ) : fee.status === 'EM_ANALISE' ? (
                          <span className="text-xs font-semibold text-blue-700">
                            Aguardando aprovação
                          </span>
                        ) : fee.status === 'ISENTO' ? (
                          <span className="text-xs font-semibold text-violet-700">
                            Sem cobrança
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Confirmado</span>
                        )}
                        {fee.proof && (
                          <button
                            type="button"
                            onClick={() =>
                              MemberService.downloadPaymentProof(
                                fee.proof!.id,
                                fee.proof!.fileName,
                              ).catch((caught) => setError(caught.message))
                            }
                            className="min-h-10 text-xs font-semibold text-blue-700 underline"
                          >
                            Baixar comprovante enviado
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : !filteredProofs.length ? (
              <EmptyState
                icon={CalendarDays}
                title="Nenhuma mensalidade encontrada"
                text={
                  overview.finance.fees.length
                    ? 'Não há mensalidades para o ano e a situação selecionados.'
                    : 'Não há mensalidades neste ano. Se já pagou, escolha o mês e anexe o comprovante no formulário acima.'
                }
              />
            ) : null}
          </div>
          {!!filteredProofs.length && (
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {filteredProofs.map((proof) => (
                <article
                  key={proof.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-bold capitalize text-gray-900">
                      {month(proof.competence)} · {money(proof.amountCents)}
                    </p>
                    <p
                      className={`mt-1 text-sm font-semibold ${proof.status === 'PENDING' ? 'text-blue-700' : 'text-red-700'}`}
                    >
                      {proof.status === 'PENDING'
                        ? 'Em análise · Aguardando aprovação da Secretaria'
                        : `Recusado: ${proof.rejectionReason || 'Envie um novo comprovante.'}`}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Enviado em {date(proof.submittedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      MemberService.downloadPaymentProof(proof.id, proof.fileName).catch((caught) =>
                        setError(caught.message),
                      )
                    }
                    className="min-h-10 text-sm font-semibold text-blue-700 underline"
                  >
                    Baixar comprovante enviado
                  </button>
                </article>
              ))}
            </div>
          )}
          <p className="text-xs leading-relaxed text-gray-500">
            O envio do comprovante não registra o pagamento imediatamente. O valor passa para “Em
            análise” e só aparece como “Pago” depois da aprovação da Secretaria no Financeiro da
            AAFAB.
          </p>
        </section>
      )}

      {page === 'PROFILE' && (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Meus dados</h2>
            <p className="mt-1 text-sm text-gray-500">
              Consulte os dados enviados no seu cadastro. Eles estão disponíveis somente para você.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Nome completo', profile.nome, UserRound],
                ['CPF', formatCPF(profile.cpf), FileText],
                ['RG', profile.rg || '—', FileText],
                ['E-mail', profile.email || '—', Mail],
                ['Telefone', profile.telefone ? formatPhone(profile.telefone) : '—', Phone],
                ['Turma CESD', profile.turma || '—', CalendarDays],
                ['Estado', profile.estado || '—', MapPin],
                ['Cidade', profile.cidade || '—', MapPin],
                ['CEP', profile.cep ? formatCEP(profile.cep) : '—', MapPin],
              ].map(([label, value, Icon]) => (
                <div key={String(label)} className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">
                    {React.createElement(Icon as React.ComponentType<{ className?: string }>, {
                      className: 'h-3.5 w-3.5',
                    })}
                    {String(label)}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-gray-800">
                    {String(value)}
                  </p>
                </div>
              ))}
              <div className="min-w-0 sm:col-span-2 lg:col-span-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Endereço</p>
                <p className="mt-1 break-words text-sm font-semibold text-gray-800">
                  {[profile.endereco, profile.bairro].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-bold text-blue-900">
                <CheckCircle2 className="h-5 w-5" /> Precisa corrigir alguma informação?
              </p>
              <p className="mt-1 text-sm text-blue-800">
                Envie a solicitação pelo canal da Secretaria para que a alteração seja registrada e
                acompanhada.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPage('SECRETARY')}
              className="min-h-11 shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"
            >
              Falar com a Secretaria
            </button>
          </div>
        </section>
      )}

      {paymentFee && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/60 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-dialog-title"
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="payment-dialog-title" className="text-xl font-bold text-gray-900">
                  {paymentMode === 'PIX' ? 'Pagar mensalidade' : 'Enviar comprovante'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {month(paymentFee.competence)} · {money(paymentFee.amountCents)}
                </p>
              </div>
              <button
                type="button"
                disabled={paymentLoading}
                onClick={() => setPaymentFee(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Fechar pagamento"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={sendProof} className="mt-5 space-y-5">
              {paymentMode === 'PIX' && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                  <AafabPixPayment />
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
                Após pagar, envie o comprovante abaixo. A Secretaria fará a conferência antes de
                registrar a mensalidade como paga.
              </div>
              <label className="block text-sm font-bold text-gray-700">
                Comprovante (PDF, JPG ou PNG, até 5 MB)
                <input
                  name="proof"
                  type="file"
                  required
                  accept="application/pdf,image/jpeg,image/png"
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
                />
              </label>
              {paymentError && (
                <p role="alert" className="text-sm font-semibold text-red-600">
                  {paymentError}
                </p>
              )}
              <button
                type="submit"
                disabled={paymentLoading}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {paymentLoading ? 'Enviando…' : 'Enviar comprovante para aprovação'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setRevision((current) => current + 1)}
          disabled={loading}
          className="flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-gray-500 hover:bg-white hover:text-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar meus dados
        </button>
      </div>
    </div>
  );
}
