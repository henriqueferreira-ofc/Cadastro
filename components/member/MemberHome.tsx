import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Clock,
  FolderOpen,
  Inbox,
  Landmark,
  MessageSquarePlus,
  Paperclip,
  Search,
  Sparkles,
  Download,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { MemberService, type MemberOverview, type MemberPost } from '../../member_service';

type Destination = 'WORK' | 'SECRETARY' | 'FINANCE' | 'PROFILE';
type Category = MemberPost['category'];

interface MemberHomeProps {
  overview: MemberOverview;
  onNavigate: (page: Destination) => void;
}

const PAGE_SIZE = 6;
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const categoryMeta: Record<
  Category,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    chip: string;
    dot: string;
    bar: string;
  }
> = {
  INSTITUCIONAL: {
    label: 'AAFAB',
    icon: Landmark,
    chip: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-600',
    bar: 'from-blue-600 to-blue-400',
  },
  TRABALHO: {
    label: 'Trabalhos',
    icon: Briefcase,
    chip: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-600',
    bar: 'from-emerald-600 to-emerald-400',
  },
  SECRETARIA: {
    label: 'Secretaria',
    icon: FolderOpen,
    chip: 'bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
    bar: 'from-amber-500 to-amber-300',
  },
  FINANCEIRO: {
    label: 'Financeiro',
    icon: Wallet,
    chip: 'bg-violet-50 text-violet-700',
    dot: 'bg-violet-600',
    bar: 'from-violet-600 to-violet-400',
  },
};

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const monthTitle = (value: string) => {
  const text = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const dueText = (value: string) => value.slice(0, 10).split('-').reverse().join('/');

// Lembra a última visita só neste navegador, para destacar o que chegou depois dela.
function readLastVisit(profileId: number): number {
  try {
    return Number(window.localStorage.getItem(`aafab_home_seen_${profileId}`)) || 0;
  } catch {
    return 0;
  }
}

function writeLastVisit(profileId: number) {
  try {
    window.localStorage.setItem(`aafab_home_seen_${profileId}`, String(Date.now()));
  } catch {
    // Sem armazenamento disponível: o aviso de "novo" apenas deixa de persistir.
  }
}

function PostReader({ post, onClose }: { post: MemberPost; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState('');
  const meta = categoryMeta[post.category];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-title"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <article className="home-rise flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <div className={`h-1.5 shrink-0 bg-gradient-to-r ${meta.bar}`} aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${meta.chip}`}
              >
                <meta.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {meta.label}
              </span>
              <span className="text-xs text-slate-400">{shortDate(post.publishedAt)}</span>
            </div>
            <h2
              id="reader-title"
              className="mt-3 text-xl font-bold leading-snug text-slate-900 sm:text-2xl"
            >
              {post.title}
            </h2>
            {post.summary && (
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
                {post.summary}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar leitura"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">
          <p className="whitespace-pre-line text-[15px] leading-7 text-slate-700">{post.content}</p>
          {!!post.attachments?.length && (
            <div className="mt-6 space-y-2 border-t border-slate-100 pt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Arquivos e resultados
              </p>
              {post.attachments.map((attachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  onClick={() =>
                    MemberService.downloadPostAttachment(attachment.id, attachment.fileName).catch(
                      (caught) => setError(caught.message),
                    )
                  }
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 text-left text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{attachment.title}</span>
                </button>
              ))}
              {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

export default function MemberHome({ overview, onNavigate }: MemberHomeProps) {
  const { profile, posts, secretary, finance } = overview;
  const [filter, setFilter] = useState<Category | 'TODOS'>('TODOS');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [reading, setReading] = useState<MemberPost | null>(null);

  // Lido antes de registrar a visita atual, para que o "Novo" apareça nesta abertura.
  const lastVisit = useMemo(() => readLastVisit(profile.id), [profile.id]);
  useEffect(() => {
    const timer = window.setTimeout(() => writeLastVisit(profile.id), 4000);
    return () => window.clearTimeout(timer);
  }, [profile.id]);

  const isNew = (post: MemberPost) => {
    const published = new Date(post.publishedAt).getTime();
    return lastVisit ? published > lastVisit : Date.now() - published < NEW_WINDOW_MS;
  };

  const sorted = useMemo(
    () =>
      [...posts].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      ),
    [posts],
  );
  const counts = useMemo(() => {
    const result: Record<Category, number> = {
      INSTITUCIONAL: 0,
      TRABALHO: 0,
      SECRETARIA: 0,
      FINANCEIRO: 0,
    };
    for (const post of posts) result[post.category] += 1;
    return result;
  }, [posts]);

  const featured = sorted[0];
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return sorted
      .filter((post) => post !== featured || filter !== 'TODOS' || term)
      .filter((post) => filter === 'TODOS' || post.category === filter)
      .filter(
        (post) =>
          !term || normalize(`${post.title} ${post.summary} ${post.content}`).includes(term),
      );
  }, [sorted, featured, filter, query]);

  const shown = filtered.slice(0, visible);
  const groups = useMemo(() => {
    const result: Array<{ title: string; items: MemberPost[] }> = [];
    for (const post of shown) {
      const title = monthTitle(post.publishedAt);
      const last = result[result.length - 1];
      if (last && last.title === title) last.items.push(post);
      else result.push({ title, items: [post] });
    }
    return result;
  }, [shown]);

  const newCount = sorted.filter(isNew).length;
  const yearPrefix = `${finance.currentYear ?? new Date().getFullYear()}-`;
  const yearFees = finance.fees.filter((fee) => fee.competence.startsWith(yearPrefix));
  const overdue = yearFees.filter((fee) => fee.status === 'VENCIDO').length;
  const open = yearFees.filter((fee) => fee.status === 'ABERTO').length;
  const inReview = yearFees.filter((fee) => fee.status === 'EM_ANALISE').length;
  const nextDue = yearFees
    .filter((fee) => fee.status === 'VENCIDO' || fee.status === 'ABERTO')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const pendingRequests = secretary.entries.filter((entry) => entry.status !== 'CONCLUIDO').length;
  const firstName = profile.nome.split(' ')[0];
  const lastUpdate = sorted[0] ? shortDate(sorted[0].publishedAt) : null;

  const filterOptions: Array<{ id: Category | 'TODOS'; label: string; count: number }> = [
    { id: 'TODOS', label: 'Tudo', count: posts.length },
    ...(Object.keys(categoryMeta) as Category[])
      .filter((category) => counts[category] > 0)
      .map((category) => ({
        id: category,
        label: categoryMeta[category].label,
        count: counts[category],
      })),
  ];

  const attention = overdue
    ? {
        tone: 'border-red-200 bg-red-50 text-red-800',
        text: `Você tem ${overdue} mensalidade${overdue > 1 ? 's' : ''} vencida${overdue > 1 ? 's' : ''}.`,
        action: 'Ver financeiro',
        go: 'FINANCE' as Destination,
      }
    : inReview
      ? {
          tone: 'border-blue-200 bg-blue-50 text-blue-800',
          text: `${inReview} comprovante${inReview > 1 ? 's' : ''} aguardando a conferência da Secretaria.`,
          action: 'Acompanhar',
          go: 'FINANCE' as Destination,
        }
      : pendingRequests
        ? {
            tone: 'border-amber-200 bg-amber-50 text-amber-900',
            text: `${pendingRequests} atendimento${pendingRequests > 1 ? 's' : ''} em andamento com a Secretaria.`,
            action: 'Abrir Secretaria',
            go: 'SECRETARY' as Destination,
          }
        : null;

  const shortcuts: Array<{
    label: string;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
    go: Destination;
  }> = [
    {
      label: 'Pagar mensalidade',
      hint: 'Pix e comprovante',
      icon: CircleDollarSign,
      go: 'FINANCE',
    },
    {
      label: 'Falar com a Secretaria',
      hint: 'Dúvidas e solicitações',
      icon: MessageSquarePlus,
      go: 'SECRETARY',
    },
    { label: 'Pedir isenção', hint: 'Com laudo ou documento', icon: Sparkles, go: 'SECRETARY' },
    { label: 'Meus dados', hint: 'Conferir cadastro', icon: UserRound, go: 'PROFILE' },
  ];

  const summaryCard = (
    <section
      className="home-rise rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
      style={{ animationDelay: '120ms' }}
      aria-label="Seu resumo"
    >
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">Seu resumo</h3>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Vencidas', value: overdue, tone: 'text-red-600' },
          { label: 'Em aberto', value: open, tone: 'text-amber-600' },
          { label: 'Em análise', value: inReview, tone: 'text-blue-600' },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate('FINANCE')}
            className="rounded-2xl bg-slate-50 px-2 py-3 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          >
            <span className={`block text-2xl font-extrabold ${item.tone}`}>{item.value}</span>
            <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">
              {item.label}
            </span>
          </button>
        ))}
      </div>
      {nextDue && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            Próximo vencimento:{' '}
            <strong className="text-slate-900">{dueText(nextDue.dueDate)}</strong>
          </span>
        </p>
      )}
      <p className="mt-2 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
        <FolderOpen className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span>
          Atendimentos em andamento: <strong className="text-slate-900">{pendingRequests}</strong>
        </span>
      </p>
    </section>
  );

  return (
    <div className="space-y-5">
      {/* Boas-vindas e aviso mais importante do momento */}
      <section className="home-rise relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-blue-100 to-transparent"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
              Central do associado
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Tudo o que a AAFAB está fazendo, em um só lugar
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {newCount
                ? `${newCount} novidade${newCount > 1 ? 's' : ''} desde a sua última visita, ${firstName}.`
                : `Você está em dia com as publicações, ${firstName}.`}
              {lastUpdate && (
                <span className="text-slate-400"> Última atualização em {lastUpdate}.</span>
              )}
            </p>
          </div>
        </div>
        {attention && (
          <div
            role="status"
            className={`relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${attention.tone}`}
          >
            <span>{attention.text}</span>
            <button
              type="button"
              onClick={() => onNavigate(attention.go)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/80 px-3 text-xs font-bold transition hover:bg-white"
            >
              {attention.action}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Coluna principal: destaque, filtros e linha do tempo */}
        <div className="min-w-0 space-y-5">
          <div className="lg:hidden">{summaryCard}</div>
          {featured && filter === 'TODOS' && !query.trim() && (
            <article
              className="home-rise card-live group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              style={{ animationDelay: '80ms' }}
            >
              <div
                className={`h-1.5 bg-gradient-to-r ${categoryMeta[featured.category].bar}`}
                aria-hidden="true"
              />
              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    Em destaque
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${categoryMeta[featured.category].chip}`}
                  >
                    {categoryMeta[featured.category].label}
                  </span>
                  {isNew(featured) && (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-green-700">
                      Novo
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{shortDate(featured.publishedAt)}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl">
                  {featured.title}
                </h3>
                {featured.summary && (
                  <p className="mt-2 text-base font-medium leading-relaxed text-slate-600">
                    {featured.summary}
                  </p>
                )}
                <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                  {featured.content}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReading(featured)}
                    className="group/btn inline-flex min-h-11 items-center gap-2 rounded-full bg-blue-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                  >
                    Ler completo
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
                      aria-hidden="true"
                    />
                  </button>
                  {!!featured.attachments?.length && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                      <Paperclip className="h-4 w-4" aria-hidden="true" />
                      {featured.attachments.length} arquivo
                      {featured.attachments.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </article>
          )}

          {/* Filtros e busca (só aparecem quando há o que filtrar) */}
          {posts.length > 1 && (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVisible(PAGE_SIZE);
                  }}
                  placeholder="Buscar nas publicações"
                  aria-label="Buscar nas publicações"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>
              {filterOptions.length > 2 && (
                <div
                  className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                  role="tablist"
                  aria-label="Filtrar por assunto"
                >
                  {filterOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={filter === option.id}
                      onClick={() => {
                        setFilter(option.id);
                        setVisible(PAGE_SIZE);
                      }}
                      className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
                        filter === option.id
                          ? 'border-blue-900 bg-blue-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-900'
                      }`}
                    >
                      {option.label}
                      <span
                        className={`rounded-full px-1.5 text-[11px] ${filter === option.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {option.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Linha do tempo agrupada por mês */}
          {groups.length > 0 && (
            <div className="space-y-7">
              {groups.map((group) => (
                <section key={group.title} aria-label={group.title}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {group.title}
                  </h3>
                  <ol className="relative space-y-3 border-l-2 border-slate-200 pl-5 sm:pl-6">
                    {group.items.map((post, index) => {
                      const meta = categoryMeta[post.category];
                      return (
                        <li key={post.id} className="relative">
                          <span
                            aria-hidden="true"
                            className={`absolute -left-[27px] top-5 h-3 w-3 rounded-full ring-4 ring-slate-50 sm:-left-[31px] ${meta.dot}`}
                          />
                          <article
                            className="home-rise card-live rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                            style={{ animationDelay: `${Math.min(index, 5) * 60}ms` }}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${meta.chip}`}
                              >
                                <meta.icon className="h-3.5 w-3.5" aria-hidden="true" />
                                {meta.label}
                              </span>
                              {isNew(post) && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                                  Novo
                                </span>
                              )}
                              <span className="text-xs text-slate-400">
                                {shortDate(post.publishedAt)}
                              </span>
                            </div>
                            <h4 className="mt-3 text-base font-bold leading-snug text-slate-900 sm:text-lg">
                              {post.title}
                            </h4>
                            {post.summary && (
                              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
                                {post.summary}
                              </p>
                            )}
                            <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm leading-relaxed text-slate-500">
                              {post.content}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setReading(post)}
                                className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                              >
                                Ler mais
                                <ChevronDown className="h-4 w-4 -rotate-90" aria-hidden="true" />
                              </button>
                              {!!post.attachments?.length && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                                  <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                                  {post.attachments.length}
                                </span>
                              )}
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
              {filtered.length > visible && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisible((current) => current + PAGE_SIZE)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                  >
                    Carregar mais ({filtered.length - visible})
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Estados vazios */}
          {!posts.length && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Inbox className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-slate-900">As novidades chegam aqui</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                Quando a Secretaria publicar comunicados, trabalhos e andamentos, eles aparecerão
                nesta linha do tempo, organizados por data e assunto.
              </p>
            </div>
          )}
          {!!posts.length && !filtered.length && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="font-bold text-slate-800">Nada encontrado</p>
              <p className="mt-1 text-sm text-slate-500">
                Tente outra palavra ou volte para “Tudo”.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('TODOS');
                }}
                className="mt-4 min-h-10 rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:border-blue-300"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Coluna lateral: resumo pessoal e atalhos */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="hidden lg:block">{summaryCard}</div>

          <section
            className="home-rise rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"
            style={{ animationDelay: '180ms' }}
            aria-label="Atalhos"
          >
            <h3 className="px-2 pb-2 pt-2 text-sm font-bold uppercase tracking-wide text-slate-400">
              Atalhos
            </h3>
            <ul className="space-y-1">
              {shortcuts.map(({ label, hint, icon: Icon, go }) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => onNavigate(go)}
                    className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:scale-110 group-hover:bg-blue-900 group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900">{label}</span>
                      <span className="block text-xs text-slate-500">{hint}</span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-700"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {posts.length > 0 && (
            <section
              className="home-rise rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              style={{ animationDelay: '240ms' }}
              aria-label="Publicações por assunto"
            >
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                Publicações por assunto
              </h3>
              <ul className="mt-3 space-y-2.5">
                {(Object.keys(categoryMeta) as Category[])
                  .filter((category) => counts[category] > 0)
                  .map((category) => {
                    const meta = categoryMeta[category];
                    return (
                      <li key={category}>
                        <button
                          type="button"
                          onClick={() => {
                            setFilter(category);
                            setVisible(PAGE_SIZE);
                          }}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${meta.dot}`}
                            aria-hidden="true"
                          />
                          <span className="flex-1 text-sm font-semibold text-slate-700">
                            {meta.label}
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {counts[category]}
                          </span>
                        </button>
                        <span
                          aria-hidden="true"
                          className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100"
                        >
                          <span
                            className={`block h-full rounded-full bg-gradient-to-r ${meta.bar}`}
                            style={{
                              width: `${Math.max(8, (counts[category] / posts.length) * 100)}%`,
                            }}
                          />
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {reading && <PostReader post={reading} onClose={() => setReading(null)} />}
    </div>
  );
}
